import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getBalances } from "../balances";
import { TrustwareConfigStore } from "../../config/store";

const realFetch = globalThis.fetch;
const WALLET = "0xa5cc6f03b19b7528d34e19c7cdb918bdbe6ccbf1";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("getBalances (GET /data/wallets/{chain}/{address}/balances)", () => {
  const urls: string[] = [];

  beforeEach(() => {
    urls.length = 0;
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/v2/routes/chains")) {
        return json({
          data: [
            {
              chainId: "8453",
              id: "8453",
              networkIdentifier: "base",
              chainType: "evm",
              networkName: "Base",
              nativeCurrency: { symbol: "ETH", name: "Ether", decimals: 18 },
            },
          ],
        });
      }
      if (url.endsWith("/v2/routes/tokens")) return json({ data: [] });
      if (url.includes("/v2/data/wallets/")) {
        // The v2 wire: camelCase keys on each balance (spec section 3).
        return json({
          data: [
            {
              chainKey: "base",
              category: "native",
              symbol: "ETH",
              decimals: 18,
              balance: "5000",
            },
            {
              chainKey: "base",
              category: "erc20",
              contract: USDC,
              symbol: "USDC",
              decimals: 6,
              balance: "9000000",
              logoUrl: "https://assets.trustware.io/usdc.png",
            },
          ],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("asks /api/v2 and returns rows keyed by chainKey", async () => {
    const rows = await getBalances("8453", WALLET);

    assert.equal(
      urls.at(-1),
      `https://api.trustware.io/api/v2/data/wallets/base/${WALLET}/balances`
    );
    assert.deepEqual(
      rows.map((row) => ({
        chainKey: row.chainKey,
        category: row.category,
        symbol: row.symbol,
        balance: row.balance,
      })),
      [
        {
          chainKey: "base",
          category: "erc20",
          symbol: "USDC",
          balance: "9000000",
        },
        {
          chainKey: "base",
          category: "native",
          symbol: "ETH",
          balance: "5000",
        },
      ]
    );
    for (const row of rows) {
      assert.equal("chain_key" in row, false);
    }
  });
});
