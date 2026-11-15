import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDepositAddress,
  buildRoute,
  type BuildRouteBody,
} from "../routes";
import { TrustwareConfigStore } from "../../config/store";

const realFetch = globalThis.fetch;
const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const ROUTER = "0x3333333333333333333333333333333333333333";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

const REQUEST: BuildRouteBody = {
  fromChain: "8453",
  toChain: "8453",
  fromToken: USDC,
  toToken: USDC,
  fromAmount: "1000000",
  fromAddress: FROM,
  toAddress: TO,
};

type Call = { url: string; body: Record<string, unknown> };

function serve(payload: unknown) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ data: payload }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        Date: new Date().toUTCString(),
      },
    });
  }) as typeof fetch;
  return calls;
}

describe("route requests on /api/v2", () => {
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("buildRoute posts to /api/v2/routes/route and parses the route", async () => {
    const calls = serve({
      intentId: "intent-1",
      expiresAt: "2099-01-01T00:00:00Z",
      route: {
        provider: "relay",
        estimate: { toAmountUsd: "1.00", fromAmountUsd: "1.01" },
        execution: {
          transaction: {
            to: ROUTER,
            data: "0xdeadbeef",
            value: "0",
            chainId: "8453",
          },
        },
      },
    });

    const route = await buildRoute(REQUEST);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.trustware.io/api/v2/routes/route");
    assert.equal(route.intentId, "intent-1");
    assert.equal(route.txReq.to, ROUTER);
    assert.equal(route.expiresAt.toISOString(), "2099-01-01T00:00:00.000Z");
    assert.equal(route.finalExchangeRate.fromAmountUSD, "1.01");
  });

  it("buildDepositAddress posts to /api/v2/routes/deposit-address and parses the address", async () => {
    const calls = serve({
      intentId: "intent-2",
      expiresAt: "2099-01-01T00:00:00Z",
      depositAddress: { address: FROM },
      route: { provider: "relay", estimate: { toAmountUsd: "1.00" } },
    });

    const result = await buildDepositAddress(REQUEST);

    assert.equal(
      calls[0].url,
      "https://api.trustware.io/api/v2/routes/deposit-address"
    );
    assert.equal(result.intentId, "intent-2");
    assert.equal(result.depositAddress, FROM);
  });

  for (const [name, spelling] of [
    ["fromAmountUSD", { fromAmountUSD: "12.50" }],
    ["fromAmountUsd", { fromAmountUsd: "12.50" }],
  ] as const) {
    it(`sends a caller's ${name} as fromAmountUsd, alone`, async () => {
      const calls = serve({
        intentId: "intent-3",
        expiresAt: "2099-01-01T00:00:00Z",
        depositAddress: { address: FROM },
        route: { provider: "relay", estimate: { toAmountUsd: "1.00" } },
      });

      await buildDepositAddress({ ...REQUEST, ...spelling });

      assert.equal(calls[0].body.fromAmountUsd, "12.50");
      assert.equal("fromAmountUSD" in calls[0].body, false);
    });
  }
});
