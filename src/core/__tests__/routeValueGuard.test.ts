import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildDepositAddress, buildRoute } from "src/core/routes";
import { sendRouteTransaction } from "src/core/tx";
import { isRouteError } from "src/core/routeError";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import type {
  BuildRouteResult,
  RouteEstimate,
  WalletInterFaceAPI,
} from "src/types";

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const ROUTER = "0x3333333333333333333333333333333333333333";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

/** The live Plume→ETH quote from c5772a2: $0.088 of fees on $0.051 of output. */
const LOSING: RouteEstimate = {
  toAmountUsd: "0.050950",
  totalFeesUsd: "0.087940",
};
const FINE: RouteEstimate = { toAmountUsd: "1.0037", totalFeesUsd: "0.039" };

/** The wire code the SDK's own verdict carries — the contract, not a constant. */
const CODE = "fees_exceed_output";

const body = {
  fromChain: "8453",
  toChain: "8453",
  fromToken: USDC,
  toToken: USDC,
  fromAmount: "1000000",
  fromAddress: FROM,
  toAddress: TO,
};

function routeResponse(estimate: RouteEstimate | undefined) {
  return {
    data: {
      intentId: "intent-1",
      route: {
        provider: "relay",
        estimate,
        execution: {
          transaction: {
            to: ROUTER,
            data: "0xdeadbeef",
            value: "0",
            chainId: "8453",
          },
        },
      },
    },
  };
}

function depositAddressResponse(estimate: RouteEstimate | undefined) {
  return {
    data: {
      intentId: "intent-1",
      depositAddress: { address: FROM },
      route: { provider: "relay", estimate },
    },
  };
}

function serve(payload: unknown) {
  return async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

function makeBuild(estimate: RouteEstimate | undefined): BuildRouteResult {
  return {
    intentId: "intent-1",
    txReq: { to: ROUTER, data: "0xdeadbeef", value: "0", chainId: "8453" },
    actions: [],
    finalExchangeRate: {},
    route: { provider: "relay", estimate },
  } as BuildRouteResult;
}

/** Records every wallet call so a test can prove none happened. */
function makeWallet(calls: string[]): WalletInterFaceAPI {
  const record = (name: string) => async () => {
    calls.push(name);
    throw new Error(`wallet.${name} must not be called`);
  };
  return {
    ecosystem: "evm",
    type: "eip1193",
    getAddress: record("getAddress"),
    getChainId: record("getChainId"),
    switchChain: record("switchChain"),
    request: record("request"),
  } as unknown as WalletInterFaceAPI;
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (err) {
    return err;
  }
  assert.fail("expected the promise to reject");
}

describe("route value guard", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  describe("buildRoute", () => {
    // The backend scores on net_usd but still returns the best of a bad set;
    // every consumer (deposit widget, swap, headless hook, runTopUp, hosts)
    // funnels through buildRoute, so this is where the whole SDK refuses it.
    it("refuses a route whose fees exceed what it delivers", async () => {
      globalThis.fetch = serve(routeResponse(LOSING)) as typeof fetch;

      const err = await rejection(buildRoute(body));

      assert.ok(isRouteError(err), "must be the structured RouteError");
      assert.equal(err.code, CODE);
      assert.deepEqual(err.providerCodes, [CODE]);
      assert.equal(err.providers[0]?.name, "relay");
      assert.equal(err.providers[0]?.outcome, "declined");
      assert.equal(err.isNoRouteAvailable, false, "a route did exist");
      assert.match(err.message, /\$0\.09.*\$0\.05/);
    });

    it("returns an ordinary route untouched", async () => {
      globalThis.fetch = serve(routeResponse(FINE)) as typeof fetch;
      const result = await buildRoute(body);
      assert.equal(result.intentId, "intent-1");
    });

    // Fails open: a provider that prices neither side is not shown to be
    // value-destroying, and blocking it would take out every such provider.
    it("returns an unpriced route", async () => {
      globalThis.fetch = serve(routeResponse(undefined)) as typeof fetch;
      const result = await buildRoute(body);
      assert.equal(result.intentId, "intent-1");
    });
  });

  describe("buildDepositAddress", () => {
    // Funds sent to a deposit address are just as gone as a signed tx.
    it("refuses a route whose fees exceed what it delivers", async () => {
      globalThis.fetch = serve(depositAddressResponse(LOSING)) as typeof fetch;

      const err = await rejection(buildDepositAddress(body));

      assert.ok(isRouteError(err));
      assert.equal(err.code, CODE);
    });

    it("returns an ordinary deposit address", async () => {
      globalThis.fetch = serve(depositAddressResponse(FINE)) as typeof fetch;
      const result = await buildDepositAddress(body);
      assert.equal(result.depositAddress, FROM);
    });
  });

  describe("sendRouteTransaction", () => {
    // The irreversible step. buildRoute already refused the route, so this
    // only matters for a BuildRouteResult a host assembled itself — and it
    // must refuse before the wallet is asked to do anything.
    it("refuses a value-destroying route before touching the wallet", async () => {
      const calls: string[] = [];
      walletManager.attachWallet(makeWallet(calls));
      // attachWallet itself reads the address; only what follows is under test.
      calls.length = 0;

      const err = await rejection(sendRouteTransaction(makeBuild(LOSING)));

      assert.ok(isRouteError(err));
      assert.equal(err.code, CODE);
      assert.deepEqual(calls, [], "wallet must not be consulted");
    });
  });
});
