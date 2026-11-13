import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchNativePriceUsd, fetchTokenPriceUsd } from "../prices";
import { estimateRelayFeeInToken } from "../../smart-account/uniswap";
import { ResponseShapeError } from "../wire";
import { HttpError } from "../http";
import { TrustwareConfigStore } from "../../config/store";

const realFetch = globalThis.fetch;
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

type Reply = { status?: number; body: unknown };

/** Serves `replies` by path, recording every URL asked for. */
function serve(replies: Record<string, Reply>) {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const path = new URL(url).pathname;
    const reply = replies[path];
    if (!reply) throw new Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return urls;
}

const nativeV2 = (priceUsd: string): Reply => ({
  body: { data: { priceUsd, chainId: "8453" } },
});

describe("price endpoints", () => {
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("reads priceUsd of GET /price/native from /api/v2", async () => {
    const urls = serve({ "/api/v2/price/native": nativeV2("3000.12500000") });

    assert.equal(await fetchNativePriceUsd(8453), 3000.125);
    assert.deepEqual(urls, [
      "https://api.trustware.io/api/v2/price/native?chainId=8453",
    ]);
  });

  it("reads priceUsd of GET /price/token from /api/v2", async () => {
    const urls = serve({
      "/api/v2/price/token": {
        body: {
          data: { priceUsd: "0.99970000", chainId: "8453", address: USDC },
        },
      },
    });

    assert.equal(await fetchTokenPriceUsd(8453, USDC), 0.9997);
    assert.deepEqual(urls, [
      `https://api.trustware.io/api/v2/price/token?chainId=8453&address=${USDC}`,
    ]);
  });

  it("throws naming priceUsd when the body still says priceUSD", async () => {
    serve({
      "/api/v2/price/native": {
        body: { data: { priceUSD: "3000.00000000", chainId: "8453" } },
      },
    });

    await assert.rejects(
      () => fetchNativePriceUsd(8453),
      (error: unknown) =>
        error instanceof ResponseShapeError &&
        error.field === "data.priceUsd" &&
        error.message ===
          'GET /price/native: field "data.priceUsd" must be a non-empty string, received nothing (missing)'
    );
  });

  it("throws a plain error for a price of zero, which is the backend having none", async () => {
    serve({ "/api/v2/price/native": nativeV2("0") });

    await assert.rejects(
      () => fetchNativePriceUsd(8453),
      (error: unknown) =>
        error instanceof Error &&
        !(error instanceof ResponseShapeError) &&
        error.message ===
          'GET /price/native: priceUsd is not a positive price: "0"'
    );
  });

  it("throws the HTTP error of a refused request", async () => {
    serve({
      "/api/v2/price/native": {
        status: 503,
        body: { error: "price source unavailable", requestId: "r-1" },
      },
    });

    await assert.rejects(
      () => fetchNativePriceUsd(8453),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 503 &&
        error.serverMessage === "price source unavailable"
    );
  });
});

describe("estimateRelayFeeInToken", () => {
  const valueWei = 1_000_000_000_000_000n; // 0.001 ETH
  const fromAmountWei = 100_000_000n; // 100 USDC

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("prices the fee from the route's USD amount and the v2 native price", async () => {
    serve({ "/api/v2/price/native": nativeV2("3000.00000000") });

    // 0.001 ETH * $3000 = $3; 100 USDC for $100 is 1e6 units a dollar; +25%.
    assert.equal(
      await estimateRelayFeeInToken(valueWei, fromAmountWei, "100", 8453),
      3_750_000n
    );
  });

  it("prices the token itself when the route has no USD amount", async () => {
    const urls = serve({
      "/api/v2/price/native": nativeV2("3000.00000000"),
      "/api/v2/price/token": {
        body: { data: { priceUsd: "1.00000000", chainId: "8453" } },
      },
    });

    assert.equal(
      await estimateRelayFeeInToken(
        valueWei,
        fromAmountWei,
        undefined,
        8453,
        USDC,
        6
      ),
      3_750_000n
    );
    assert.equal(urls.length, 2);
  });

  it("answers 0n when the price source is down, as before", async () => {
    serve({
      "/api/v2/price/native": { status: 503, body: { error: "down" } },
    });

    assert.equal(
      await estimateRelayFeeInToken(valueWei, fromAmountWei, "100", 8453),
      0n
    );
  });

  it("throws, not 0n, when the body breaks the contract", async () => {
    serve({
      "/api/v2/price/native": {
        body: { data: { priceUSD: "3000.00000000" } },
      },
    });

    await assert.rejects(
      () => estimateRelayFeeInToken(valueWei, fromAmountWei, "100", 8453),
      (error: unknown) =>
        error instanceof ResponseShapeError && error.field === "data.priceUsd"
    );
  });
});
