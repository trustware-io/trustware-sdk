import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Registry } from "src/registry";
import { TrustwareConfigStore } from "src/config/store";
import type { ChainDef, TokenDef } from "src/types";
import { NATIVE_EVM, NATIVE_SOLANA } from "src/utils/chains";

const BASE_URL = "https://api.test/api";
const SOLANA = "solana-mainnet-beta";
const ECLIPSE = "9286185";
const BASE = "8453";

const CHAINS: ChainDef[] = [
  { chainId: SOLANA, id: "solana", chainType: "solana", networkName: "Solana" },
  {
    chainId: ECLIPSE,
    id: ECLIPSE,
    chainType: "solana",
    networkName: "Eclipse",
  },
  { chainId: BASE, id: BASE, chainType: "evm", networkName: "Base" },
] as ChainDef[];

// Native SOL as staging's catalog really lists it: Squid's record at the EVM
// sentinel with the logo and price, and Relay's at the System Program id with
// neither.
const SOL_SQUID: TokenDef = {
  address: NATIVE_EVM,
  chainId: SOLANA,
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
  type: "solana",
  logoURI: "https://assets.coingecko.com/coins/images/4128/standard/solana.png",
  usdPrice: 107.588013455,
};
const SOL_RELAY: TokenDef = {
  address: "11111111111111111111111111111111",
  chainId: SOLANA,
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
  type: "solana",
};
const WSOL: TokenDef = {
  address: "So11111111111111111111111111111111111111112",
  chainId: SOLANA,
  symbol: "WSOL",
  name: "Wrapped SOL",
  decimals: 9,
  type: "solana",
  usdPrice: 107.588013455,
};
// Two distinct mints whose addresses differ only in case.
const MINT_UPPER: TokenDef = {
  address: "AbCdEfGhJkMnPqRsTuVwXyZ123456789abcdefghijk",
  chainId: SOLANA,
  symbol: "UPPR",
  name: "Upper",
  decimals: 6,
  type: "solana",
};
const MINT_LOWER: TokenDef = {
  ...MINT_UPPER,
  address: "abcdefghjkmnpqrstuvwxyz123456789abcdefghijk",
  symbol: "LOWR",
  name: "Lower",
};
const ECLIPSE_ETH: TokenDef = {
  address: "11111111111111111111111111111111",
  chainId: ECLIPSE,
  symbol: "ETH",
  name: "Ether",
  decimals: 9,
  type: "solana",
};
const USDC_BASE: TokenDef = {
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  chainId: BASE,
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  type: "evm",
  usdPrice: 1,
};

/** Full-list order as the backend builds it: Squid first, Relay last. */
const CATALOG = [
  SOL_SQUID,
  WSOL,
  MINT_UPPER,
  MINT_LOWER,
  USDC_BASE,
  SOL_RELAY,
  ECLIPSE_ETH,
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** compareTokenString in iluvatar's token_pagination.go. */
function compareText(left: string, right: string): number {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The routes catalog endpoints as iluvatar serves them: the bare list in
 * provider order, and the chain-scoped search filtered on symbol/name/address
 * and sorted by chain, symbol, address, then name.
 */
function fakeBackend(catalog: TokenDef[]) {
  const requests: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    requests.push(url.toString());
    if (url.pathname.endsWith("/v1/routes/chains")) {
      return json({ data: CHAINS });
    }
    if (url.pathname.endsWith("/v1/routes/tokens")) {
      const chainId = url.searchParams.get("chainId");
      if (!chainId) return json({ data: catalog });
      const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const limit = Number(url.searchParams.get("limit") ?? catalog.length);
      const matches = catalog
        .filter((token) => String(token.chainId).toLowerCase() === chainId)
        .filter(
          (token) =>
            !query ||
            [token.symbol, token.name, token.address]
              .join(" ")
              .toLowerCase()
              .includes(query)
        )
        .sort(
          (a, b) =>
            compareText(String(a.chainId), String(b.chainId)) ||
            compareText(a.symbol, b.symbol) ||
            compareText(a.address, b.address) ||
            compareText(a.name, b.name)
        );
      return json({
        data: matches.slice(0, limit),
        pageInfo: { limit, hasNextPage: matches.length > limit },
      });
    }
    throw new Error(`fakeBackend: unexpected request ${url}`);
  }) as typeof globalThis.fetch;
  return { requests, restore: () => (globalThis.fetch = real) };
}

function initConfig(tokensPagination: boolean) {
  TrustwareConfigStore.init({
    apiKey: "test_api_key",
    mode: "deposit",
    routes: { toChain: BASE, toToken: "USDC" },
    features: { tokensPagination },
  });
}

function nativeSolRecords(tokens: TokenDef[]) {
  return tokens.filter((token) => token.symbol === "SOL");
}

describe("Registry catalog identity", () => {
  let backend: ReturnType<typeof fakeBackend> | null = null;

  beforeEach(() => initConfig(true));
  afterEach(() => {
    backend?.restore();
    backend = null;
  });

  it("keeps one native SOL from the full list, at NATIVE_SOLANA, with Squid's metadata", async () => {
    backend = fakeBackend(CATALOG);
    const registry = new Registry(BASE_URL);
    await registry.ensureLoaded();

    assert.deepEqual(nativeSolRecords(registry.tokens(SOLANA)), [
      { ...SOL_SQUID, address: NATIVE_SOLANA },
    ]);
  });

  it("keeps one native SOL from a search page, at NATIVE_SOLANA, with Squid's metadata", async () => {
    backend = fakeBackend(CATALOG);
    const registry = new Registry(BASE_URL);
    const page = await registry.tokensPage(SOLANA, { q: "solana", limit: 100 });

    assert.deepEqual(nativeSolRecords(page.data), [
      { ...SOL_SQUID, address: NATIVE_SOLANA },
    ]);
  });

  it("keeps wrapped SOL and case-variant mints as separate tokens", async () => {
    backend = fakeBackend(CATALOG);
    const registry = new Registry(BASE_URL);
    await registry.ensureLoaded();

    const addresses = registry.tokens(SOLANA).map((token) => token.address);
    assert.deepEqual(
      addresses.sort(),
      [
        NATIVE_SOLANA,
        WSOL.address,
        MINT_UPPER.address,
        MINT_LOWER.address,
      ].sort()
    );
  });

  it("names Eclipse's native ETH with the System Program id too", async () => {
    backend = fakeBackend(CATALOG);
    const registry = new Registry(BASE_URL);
    await registry.ensureLoaded();

    assert.deepEqual(registry.tokens(ECLIPSE), [ECLIPSE_ETH]);
  });

  it("lets a later response replace an earlier record for the same token", async () => {
    backend = fakeBackend(CATALOG);
    const registry = new Registry(BASE_URL);
    await registry.ensureLoaded();
    backend.restore();

    const repriced = { ...USDC_BASE, usdPrice: 0.9998 };
    backend = fakeBackend([repriced]);
    await registry.tokensPage(BASE, { q: "usdc", limit: 5 });

    assert.deepEqual(registry.tokens(BASE), [repriced]);
  });
});

describe("Registry.lookupToken", () => {
  let backend: ReturnType<typeof fakeBackend> | null = null;

  afterEach(() => {
    backend?.restore();
    backend = null;
  });

  for (const tokensPagination of [true, false]) {
    describe(`with tokensPagination ${tokensPagination}`, () => {
      beforeEach(() => initConfig(tokensPagination));

      it("finds native SOL by either spelling", async () => {
        backend = fakeBackend(CATALOG);
        for (const spelling of [NATIVE_EVM, NATIVE_SOLANA]) {
          const registry = new Registry(BASE_URL);
          const found = await registry.lookupToken(SOLANA, spelling);
          assert.equal(found?.address, NATIVE_SOLANA, spelling);
          assert.equal(found?.symbol, "SOL", spelling);
        }
      });

      it("matches a mint only in its exact case", async () => {
        backend = fakeBackend(CATALOG);
        const registry = new Registry(BASE_URL);
        assert.deepEqual(
          await registry.lookupToken(SOLANA, MINT_LOWER.address),
          MINT_LOWER
        );
        assert.deepEqual(
          await registry.lookupToken(SOLANA, MINT_UPPER.address),
          MINT_UPPER
        );
      });

      it("matches an EVM address in any case", async () => {
        backend = fakeBackend(CATALOG);
        const registry = new Registry(BASE_URL);
        assert.deepEqual(
          await registry.lookupToken(
            BASE,
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
          ),
          USDC_BASE
        );
      });

      it("returns undefined for an address the catalog doesn't list", async () => {
        backend = fakeBackend(CATALOG);
        const registry = new Registry(BASE_URL);
        assert.equal(
          await registry.lookupToken(SOLANA, "Not1nTheCata1og"),
          undefined
        );
      });
    });
  }

  it("searches the paginated endpoint by the address as given", async () => {
    initConfig(true);
    backend = fakeBackend(CATALOG);
    const registry = new Registry(BASE_URL);
    await registry.lookupToken(SOLANA, ` ${NATIVE_EVM} `);

    const search = backend.requests.find((url) => url.includes("q="));
    assert.ok(search, "expected a search request");
    assert.equal(new URL(search).searchParams.get("q"), NATIVE_EVM);
  });
});
