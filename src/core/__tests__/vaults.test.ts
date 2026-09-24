import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  searchVaults,
  getVaultDetails,
  getVaultPositions,
  getVaultRedeemActions,
} from "../vaults";
import { TrustwareConfigStore } from "../../config/store";

const VAULT_ID = "0xbeef0e0834849aCC03f0089F01f4F1Eeb06873C9";

/** A trimmed real vaults.fyi vault, via the backend's proxy shape (BVT-398). */
function vaultSummary(overrides: Record<string, unknown> = {}) {
  return {
    vaultId: VAULT_ID,
    address: VAULT_ID,
    name: "Steakhouse Prime Instant",
    network: { name: "base", chainId: 8453 },
    asset: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
    },
    protocol: {
      protocolId: "morpho-v2",
      name: "morpho",
      displayName: "Morpho",
    },
    curator: {
      name: "Steakhouse Financial",
      displayName: "Steakhouse Financial",
      websiteUrl: "https://www.steakhouse.financial/",
    },
    tags: ["Lending"],
    apy: {
      "1hour": { base: 0.02, reward: 0, total: 0.02 },
      "1day": { base: 0.02, reward: 0, total: 0.02 },
      "7day": { base: 0.02, reward: 0, total: 0.02 },
      "30day": { base: 0.02, reward: 0, total: 0.02 },
    },
    tvl: { usd: "100000000", native: "100000000000000" },
    score: {
      vaultScore: 75,
      vaultTvlScore: 60,
      protocolTvlScore: 78,
      holderScore: 85,
      assetScore: 96,
      totalScorePenalty: 0,
    },
    isTransactional: true,
    warnings: [],
    flags: [],
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchStub = {
  urls: string[];
  restore: () => void;
};

function stubFetch(handler: (url: string) => Response): FetchStub {
  const real = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    urls.push(url);
    return handler(url);
  }) as typeof globalThis.fetch;
  return { urls, restore: () => (globalThis.fetch = real) };
}

describe("vault discovery", () => {
  let fetchStub: FetchStub | null = null;

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test_api_key",
      mode: "deposit",
      routes: { toChain: "8453", toToken: "USDC" },
    });
  });

  afterEach(() => {
    fetchStub?.restore();
    fetchStub = null;
  });

  it("searchVaults hits the backend proxy, not vaults.fyi directly", async () => {
    fetchStub = stubFetch(() =>
      jsonResponse(200, { data: { vaults: [vaultSummary()] } })
    );

    const result = await searchVaults({
      allowedNetworks: ["base"],
      allowedAssets: ["USDC"],
    });

    assert.equal(fetchStub.urls.length, 1);
    assert.match(fetchStub.urls[0], /\/v1\/routes\/vaults\?/);
    // Never vaults.fyi's own domain — the whole point is the key stays server-side.
    assert.doesNotMatch(fetchStub.urls[0], /vaults\.fyi/);
    assert.equal(result.vaults.length, 1);
    assert.equal(result.vaults[0].vaultId, VAULT_ID);
  });

  it("searchVaults sends every filter as a query param", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: { vaults: [] } }));

    await searchVaults({
      allowedAssets: ["USDC", "USDT"],
      allowedNetworks: ["base"],
      allowedProtocols: ["morpho"],
      disallowedProtocols: ["scam-protocol"],
      minTvl: 1000,
      minApy: 0.02,
      sortBy: "apy7day",
      sortOrder: "desc",
      page: 1,
      perPage: 10,
    });

    const url = new URL(fetchStub.urls[0]);
    assert.deepEqual(url.searchParams.getAll("allowedAssets"), [
      "USDC",
      "USDT",
    ]);
    assert.equal(url.searchParams.get("allowedNetworks"), "base");
    assert.equal(url.searchParams.get("allowedProtocols"), "morpho");
    assert.equal(url.searchParams.get("disallowedProtocols"), "scam-protocol");
    assert.equal(url.searchParams.get("minTvl"), "1000");
    assert.equal(url.searchParams.get("minApy"), "0.02");
    assert.equal(url.searchParams.get("sortBy"), "apy7day");
    assert.equal(url.searchParams.get("sortOrder"), "desc");
    assert.equal(url.searchParams.get("page"), "1");
    assert.equal(url.searchParams.get("perPage"), "10");
  });

  it("searchVaults with no params sends no query string", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: { vaults: [] } }));
    await searchVaults();
    assert.doesNotMatch(fetchStub.urls[0], /\?/);
  });

  it("searchVaults throws with the backend's error message on failure", async () => {
    fetchStub = stubFetch(() =>
      jsonResponse(502, {
        error: "vault discovery is not configured on this server",
      })
    );
    await assert.rejects(
      () => searchVaults(),
      /vault discovery is not configured on this server/
    );
  });

  it("getVaultDetails requests the network/vaultId path and returns the vault", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: vaultSummary() }));

    const v = await getVaultDetails("base", VAULT_ID);

    assert.equal(fetchStub.urls.length, 1);
    assert.match(
      fetchStub.urls[0],
      new RegExp(`/v1/routes/vaults/base/${VAULT_ID}$`)
    );
    assert.equal(v.name, "Steakhouse Prime Instant");
    assert.equal(v.network.name, "base");
  });

  it("getVaultDetails URL-encodes its path segments", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: vaultSummary() }));
    await getVaultDetails("base network", "vault/with/slash");
    assert.match(fetchStub.urls[0], /base%20network/);
    assert.match(fetchStub.urls[0], /vault%2Fwith%2Fslash/);
  });

  it("getVaultDetails throws naming the vault on a 404", async () => {
    fetchStub = stubFetch(() =>
      jsonResponse(502, {
        error: "vault details for 0xMissing on base: not found",
      })
    );
    await assert.rejects(
      () => getVaultDetails("base", "0xMissing"),
      /0xMissing/
    );
  });

  it("getVaultPositions requests the wallet's path and returns its positions", async () => {
    const WALLET = "0x40695edf6e3c6be65122162b7d7b7f6c5418037b";
    fetchStub = stubFetch(() =>
      jsonResponse(200, {
        data: [
          {
            vaultId: VAULT_ID,
            address: VAULT_ID,
            name: "Steakhouse Prime Instant",
            network: { name: "base", chainId: 8453 },
            asset: {
              address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              symbol: "USDC",
              decimals: 6,
              // Confirmed real quirk: the wallet's total balance, not this position's value.
              balanceUsd: "2.10025345",
              positionValueInAsset: "2509",
            },
            protocol: {
              protocolId: "morpho-v2",
              name: "morpho",
              displayName: "Morpho",
            },
            lpToken: {
              address: VAULT_ID,
              symbol: "sparkUSDC",
              decimals: 18,
              balanceNative: "2323341045053217",
              balanceUsd: "0.00250878314713",
            },
            isTransactional: true,
            apy: { base: 0.0396, reward: 0, total: 0.0396 },
          },
        ],
      })
    );

    const positions = await getVaultPositions(WALLET);

    assert.equal(fetchStub.urls.length, 1);
    assert.match(
      fetchStub.urls[0],
      new RegExp(`/v1/routes/vaults/positions/${WALLET}$`)
    );
    assert.equal(positions.length, 1);
    assert.equal(positions[0].name, "Steakhouse Prime Instant");
    // The real per-position value is lpToken.balanceUsd, not asset.balanceUsd.
    assert.equal(positions[0].lpToken.balanceUsd, "0.00250878314713");
  });

  it("getVaultPositions with no holdings returns an empty array, not undefined", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: [] }));
    const positions = await getVaultPositions("0xEmptyWallet");
    assert.deepEqual(positions, []);
  });

  it("getVaultPositions URL-encodes the address", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: [] }));
    await getVaultPositions("0x with a space");
    assert.match(fetchStub.urls[0], /0x%20with%20a%20space/);
  });

  it("getVaultRedeemActions with all:true sends all=true, no amount", async () => {
    const ADDRESS = "0x40695edf6e3c6be65122162b7d7b7f6c5418037b";
    const ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    fetchStub = stubFetch(() =>
      jsonResponse(200, {
        data: [
          {
            name: "Redeem all USDC from Spark USDC Vault vault",
            tx: {
              to: VAULT_ID,
              chainId: 8453,
              data: "0xba087652deadbeef",
              value: "",
            },
          },
        ],
      })
    );

    const actions = await getVaultRedeemActions({
      address: ADDRESS,
      network: "base",
      vaultId: VAULT_ID,
      assetAddress: ASSET,
      all: true,
    });

    assert.equal(fetchStub.urls.length, 1);
    const url = new URL(fetchStub.urls[0]);
    assert.match(
      url.pathname,
      new RegExp(`/v1/routes/vaults/redeem/base/${VAULT_ID}$`)
    );
    assert.equal(url.searchParams.get("address"), ADDRESS);
    assert.equal(url.searchParams.get("assetAddress"), ASSET);
    assert.equal(url.searchParams.get("all"), "true");
    assert.equal(url.searchParams.has("amount"), false);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].tx.to, VAULT_ID);
  });

  it("getVaultRedeemActions with an explicit amount sends amount, not all", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: [] }));

    await getVaultRedeemActions({
      address: "0xWallet",
      network: "base",
      vaultId: VAULT_ID,
      assetAddress: "0xAsset",
      amount: "1000000000000000",
    });

    const url = new URL(fetchStub.urls[0]);
    assert.equal(url.searchParams.get("amount"), "1000000000000000");
    assert.equal(url.searchParams.has("all"), false);
  });

  it("getVaultRedeemActions with no holdings returns an empty array, not undefined", async () => {
    fetchStub = stubFetch(() => jsonResponse(200, { data: [] }));
    const actions = await getVaultRedeemActions({
      address: "0xWallet",
      network: "base",
      vaultId: VAULT_ID,
      assetAddress: "0xAsset",
      all: true,
    });
    assert.deepEqual(actions, []);
  });

  it("getVaultRedeemActions throws with the backend's error message on failure", async () => {
    fetchStub = stubFetch(() =>
      jsonResponse(400, { error: "assetAddress is required" })
    );
    await assert.rejects(
      () =>
        getVaultRedeemActions({
          address: "0xWallet",
          network: "base",
          vaultId: VAULT_ID,
          assetAddress: "0xAsset",
          all: true,
        }),
      /assetAddress is required/
    );
  });
});
