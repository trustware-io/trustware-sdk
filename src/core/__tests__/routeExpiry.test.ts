import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  assertRouteNotExpired,
  parseRouteExpiresAt,
  RouteExpiredError,
} from "src/core/routeExpiry";
import { buildDepositAddress, buildRoute } from "src/core/routes";
import { sendRouteTransaction } from "src/core/tx";
import { buildRouteForReview, sendReviewedRoute } from "src/core/signTimeRoute";
import { sendRouteAsUserOperation } from "src/smart-account/send";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import type { BuildRouteResult, WalletInterFaceAPI } from "src/types";
import { mulberry32 } from "src/__tests__/seededRandom";
import {
  EVM_REQUEST,
  json,
  REVIEWED_ESTIMATE,
  ROUTER,
  routeJson,
  type Event,
} from "./routeBackendStub";

const INTENT = "intent-expiry";

describe("parseRouteExpiresAt", () => {
  const accepted: [string, number][] = [
    ["2026-10-24T10:00:00Z", Date.UTC(2026, 9, 24, 10, 0, 0)],
    ["2026-10-24T10:00:00.5Z", Date.UTC(2026, 9, 24, 10, 0, 0, 500)],
    // Go's RFC3339Nano: nine fraction digits, cut to the millisecond.
    [
      "2026-10-24T10:00:00.123456789+05:30",
      Date.UTC(2026, 9, 24, 4, 30, 0, 123),
    ],
    ["2026-10-24T10:00:00-07:00", Date.UTC(2026, 9, 24, 17, 0, 0)],
    ["2024-02-29T23:59:59Z", Date.UTC(2024, 1, 29, 23, 59, 59)],
  ];
  for (const [raw, ms] of accepted) {
    it(`reads ${raw}`, () => {
      assert.equal(parseRouteExpiresAt(raw, INTENT).getTime(), ms);
    });
  }

  const message = (why: string, raw: unknown) =>
    `The route for intent "${INTENT}" has ${why} expiresAt (got ` +
    `${JSON.stringify(raw)}); every route must carry an RFC 3339 expiry.`;

  const refused: [unknown, string][] = [
    [undefined, "no"],
    [null, "no"],
    [1792836000000, "no"],
    ["", "a malformed"],
    ["2026-10-24", "a malformed"],
    ["2026-10-24T10:00:00", "a malformed"],
    ["2026-10-24 10:00:00Z", "a malformed"],
    ["2026-10-24t10:00:00z", "a malformed"],
    ["2026-10-24T10:00Z", "a malformed"],
    ["2026-10-24T10:00:00+0530", "a malformed"],
    [" 2026-10-24T10:00:00Z", "a malformed"],
    ["2026-02-30T00:00:00Z", "an out-of-range"],
    ["2025-02-29T00:00:00Z", "an out-of-range"],
    ["2026-13-01T00:00:00Z", "an out-of-range"],
    ["2026-00-10T00:00:00Z", "an out-of-range"],
    ["2026-10-00T00:00:00Z", "an out-of-range"],
    ["2026-10-24T24:00:00Z", "an out-of-range"],
    ["2026-10-24T10:60:00Z", "an out-of-range"],
    ["2026-10-24T10:00:60Z", "an out-of-range"],
    ["2026-10-24T10:00:00+24:00", "an out-of-range"],
    ["2026-10-24T10:00:00+05:60", "an out-of-range"],
  ];
  for (const [raw, why] of refused) {
    it(`refuses ${JSON.stringify(raw)}`, () => {
      assert.throws(() => parseRouteExpiresAt(raw, INTENT), {
        message: message(why, raw),
      });
    });
  }

  it("reads every instant back exactly, in UTC and at any offset", () => {
    const random = mulberry32(251);
    // Year 1970 to 9999: the range a four-digit RFC 3339 year spans.
    const maxMs = Date.UTC(9999, 11, 31, 23, 59, 59, 999);
    for (let i = 0; i < 2000; i++) {
      const ms = Math.floor(random() * maxMs);
      const utc = new Date(ms).toISOString();
      assert.equal(parseRouteExpiresAt(utc, INTENT).getTime(), ms, utc);

      const offsetMinutes = Math.floor(random() * (2 * 23 * 60 + 1)) - 23 * 60;
      const local = new Date(ms + offsetMinutes * 60_000);
      const sign = offsetMinutes < 0 ? "-" : "+";
      const abs = Math.abs(offsetMinutes);
      const pad = (n: number) => String(n).padStart(2, "0");
      const shifted =
        local.toISOString().slice(0, -1) +
        `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
      // Only instants whose local wall time stays in years 0000-9999.
      if (!/^\d{4}-/.test(shifted)) continue;
      assert.equal(parseRouteExpiresAt(shifted, INTENT).getTime(), ms, shifted);
    }
  });
});

describe("assertRouteNotExpired", () => {
  const expiresAt = new Date(Date.UTC(2026, 9, 24, 10, 0, 0));
  const route = { intentId: INTENT, expiresAt };

  it("lets a route through until its expiry", () => {
    assertRouteNotExpired(route, expiresAt.getTime() - 1);
  });

  it("refuses it at the expiry and after, with the intent and the time", () => {
    for (const now of [expiresAt.getTime(), expiresAt.getTime() + 1]) {
      assert.throws(
        () => assertRouteNotExpired(route, now),
        (error: unknown) => {
          assert.ok(error instanceof RouteExpiredError);
          assert.equal(error.name, "RouteExpiredError");
          assert.equal(error.intentId, INTENT);
          assert.equal(error.expiresAt, expiresAt);
          assert.equal(
            error.message,
            `Route intent ${INTENT} expired at 2026-10-24T10:00:00.000Z, so ` +
              `it was not sent. Build a new route and send that instead.`
          );
          return true;
        }
      );
    }
  });

  it("refuses exactly when now has reached the expiry, over the whole range", () => {
    const random = mulberry32(433);
    for (let i = 0; i < 5000; i++) {
      const expiry = Math.floor(random() * 4_102_444_800_000);
      // Straddle the boundary densely, and cover far either side of it.
      const delta =
        random() < 0.5
          ? Math.floor(random() * 5) - 2
          : Math.floor((random() - 0.5) * 2 * 86_400_000);
      const now = expiry + delta;
      const refusedRoute = { intentId: INTENT, expiresAt: new Date(expiry) };
      let threw = false;
      try {
        assertRouteNotExpired(refusedRoute, now);
      } catch (error) {
        assert.ok(error instanceof RouteExpiredError);
        threw = true;
      }
      assert.equal(threw, now >= expiry, `expiry ${expiry}, now ${now}`);
    }
  });
});

// ── At the API boundary ─────────────────────────────────────────────────────

const realFetch = globalThis.fetch;

function initConfig() {
  TrustwareConfigStore.init({
    apiKey: "test-key",
    routes: { toChain: "8453", toToken: "USDC" },
  });
}

describe("buildRoute and buildDepositAddress carry the expiry", () => {
  beforeEach(initConfig);
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const routeBody = (expiresAt: unknown) => ({
    data: {
      intentId: INTENT,
      ...(expiresAt === undefined ? {} : { expiresAt }),
      route: {
        estimate: REVIEWED_ESTIMATE,
        execution: {
          transaction: {
            to: ROUTER,
            data: "0xaa",
            value: "0",
            chainId: "8453",
          },
        },
      },
    },
  });
  const depositBody = (expiresAt: unknown) => ({
    data: {
      intentId: INTENT,
      ...(expiresAt === undefined ? {} : { expiresAt }),
      depositAddress: { address: ROUTER, expiresAt: "2026-10-24T11:00:00Z" },
      route: { estimate: REVIEWED_ESTIMATE },
    },
  });
  const serve = (body: unknown) =>
    (async () => json(200, body)) as unknown as typeof fetch;

  it("parses the route's expiresAt", async () => {
    globalThis.fetch = serve(routeBody("2026-10-24T10:30:00Z"));
    const route = await buildRoute(EVM_REQUEST);
    assert.equal(route.expiresAt.getTime(), Date.UTC(2026, 9, 24, 10, 30));
  });

  it("refuses a route without one", async () => {
    globalThis.fetch = serve(routeBody(undefined));
    await assert.rejects(buildRoute(EVM_REQUEST), {
      message:
        `The route for intent "${INTENT}" has no expiresAt (got undefined); ` +
        `every route must carry an RFC 3339 expiry.`,
    });
  });

  it("parses the deposit-address route's top-level expiresAt, not the deposit window's", async () => {
    globalThis.fetch = serve(depositBody("2026-10-24T10:30:00Z"));
    const route = await buildDepositAddress(EVM_REQUEST);
    assert.equal(route.expiresAt.getTime(), Date.UTC(2026, 9, 24, 10, 30));
  });

  it("refuses a deposit-address route without one", async () => {
    globalThis.fetch = serve(depositBody(undefined));
    await assert.rejects(buildDepositAddress(EVM_REQUEST), {
      message:
        `The route for intent "${INTENT}" has no expiresAt (got undefined); ` +
        `every route must carry an RFC 3339 expiry.`,
    });
  });
});

/** Records every wallet call; answers only what a send needs. */
function recordingWallet(calls: string[]): WalletInterFaceAPI {
  return {
    ecosystem: "evm",
    type: "eip1193",
    getAddress: async () => {
      calls.push("getAddress");
      return "0x1111111111111111111111111111111111111111";
    },
    getChainId: async () => {
      calls.push("getChainId");
      return 8453;
    },
    switchChain: async () => {
      calls.push("switchChain");
    },
    request: async (args: { method: string }) => {
      calls.push(args.method);
      throw new Error(`Unexpected wallet request: ${args.method}`);
    },
  } as unknown as WalletInterFaceAPI;
}

function routeExpiringAt(expiresAt: Date): BuildRouteResult {
  return {
    intentId: INTENT,
    txReq: { to: ROUTER, data: "0xaa", value: "0", chainId: "8453" },
    actions: [],
    finalExchangeRate: {},
    route: { estimate: REVIEWED_ESTIMATE },
    expiresAt,
  };
}

describe("an expired route is never sent", () => {
  let calls: string[];
  beforeEach(async () => {
    initConfig();
    calls = [];
    walletManager.attachWallet(recordingWallet(calls));
    // Attaching reads the address and chain for the identity; only what a
    // send asks of the wallet counts.
    await new Promise((resolve) => setImmediate(resolve));
    calls.length = 0;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("sendRouteTransaction refuses it before consulting the wallet", async () => {
    const expiresAt = new Date(Date.now() - 1);
    await assert.rejects(
      sendRouteTransaction(routeExpiringAt(expiresAt), 8453),
      {
        name: "RouteExpiredError",
        message:
          `Route intent ${INTENT} expired at ${expiresAt.toISOString()}, so ` +
          `it was not sent. Build a new route and send that instead.`,
      }
    );
    assert.deepEqual(calls, []);
  });

  it("sendRouteTransaction refuses it when it expired during the approval", async () => {
    const sent: string[] = [];
    const expiresAt = new Date(Date.now() + 60);
    walletManager.attachWallet({
      ecosystem: "evm",
      type: "eip1193",
      getAddress: async () => "0x1111111111111111111111111111111111111111",
      getChainId: async () => 8453,
      switchChain: async () => {},
      request: async (args: { method: string; params?: unknown[] }) => {
        assert.equal(args.method, "eth_sendTransaction");
        const tx = (args.params as Record<string, string>[])[0];
        sent.push(tx.to);
        return `0x${"a".repeat(64)}`;
      },
    } as unknown as WalletInterFaceAPI);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/sdk/rpc/evm/allowance")) {
        return json(200, { success: true, data: { allowance: "0" } });
      }
      if (url.includes("/v1/sdk/rpc/evm/tx-status")) {
        // The approve takes longer to confirm than the route has left.
        await new Promise((resolve) => setTimeout(resolve, 120));
        return json(200, { success: true, data: { status: "success" } });
      }
      if (url.includes("/steps/0/receipt")) return json(200, { data: {} });
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
    const token = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
    const route: BuildRouteResult = {
      ...routeExpiringAt(expiresAt),
      route: {
        estimate: REVIEWED_ESTIMATE,
        execution: {
          approvals: [
            {
              chainId: "8453",
              tokenAddress: token,
              spender: ROUTER,
              amount: "1",
            },
          ],
        },
      },
    };

    await assert.rejects(sendRouteTransaction(route, 8453), {
      name: "RouteExpiredError",
    });
    assert.deepEqual(sent, [token], "the approve went out, the route didn't");
  });

  it("sendReviewedRoute refuses an expired EVM route: nothing signed, nothing committed", async () => {
    const events: Event[] = [];
    const expiresAt = new Date(Date.now() + 40);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/routes/route")) {
        const body = routeJson("intent-evm", REVIEWED_ESTIMATE, {
          evm: "0xaaaa",
        });
        return json(200, {
          data: { ...body.data, expiresAt: expiresAt.toISOString() },
        });
      }
      events.push({ kind: "receipt", intentId: url, txHash: "" });
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
    const reviewed = await buildRouteForReview(EVM_REQUEST);
    // The user reads the review screen past the expiry.
    await new Promise((resolve) => setTimeout(resolve, 60));

    await assert.rejects(sendReviewedRoute(reviewed, 8453), {
      name: "RouteExpiredError",
    });
    assert.deepEqual(calls, []);
    assert.deepEqual(events, []);
  });

  it("sendRouteAsUserOperation refuses it before consulting the wallet", async () => {
    const expiresAt = new Date(Date.now() - 1);
    await assert.rejects(
      sendRouteAsUserOperation({
        route: {
          ...routeExpiringAt(expiresAt),
          sponsorship: { paymaster: ROUTER } as BuildRouteResult["sponsorship"],
        },
        fromToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        fromAmountWei: 1n,
        eoaAddress: "0x1111111111111111111111111111111111111111",
        chainId: 8453,
        viemChain: {
          id: 8453,
          name: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["http://unused.invalid"] } },
        },
        eip1193Request: async (args) => {
          calls.push(args.method);
          throw new Error(`Unexpected wallet request: ${args.method}`);
        },
      }),
      { name: "RouteExpiredError" }
    );
    assert.deepEqual(calls, []);
  });
});
