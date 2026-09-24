import { apiBase, jsonHeaders, assertOK, rateLimitedFetch } from "./http";
import type { TxRequest } from "./routes";

/** One lookback window's yield breakdown, as vaults.fyi reports it. */
export type VaultAPYWindow = {
  base: number;
  reward: number;
  total: number;
};

export type VaultAPY = {
  "1hour": VaultAPYWindow;
  "1day": VaultAPYWindow;
  "7day": VaultAPYWindow;
  "30day": VaultAPYWindow;
};

export type VaultTVL = {
  usd: string;
  native: string;
};

/**
 * vaults.fyi's reputation composite. `networkScore` is deliberately not a
 * field here — vaults.fyi documents it as deprecated and excluded from the
 * composite, so exposing it would suggest it still contributes.
 */
export type VaultScore = {
  vaultScore: number;
  vaultTvlScore: number;
  protocolTvlScore: number;
  holderScore: number;
  assetScore: number;
  totalScorePenalty: number;
};

/** A structured risk/status flag, e.g. "utilization is high, withdrawals may be delayed." */
export type VaultFlag = {
  content: string;
  severity: string;
  /** Unix timestamp; absent means the flag carries no expiry. */
  endDate?: number;
};

/** One vault as the backend's vaults.fyi proxy describes it — enough to render a picker/detail card. */
export type VaultSummary = {
  vaultId: string;
  address: string;
  name: string;
  network: { name: string; chainId: number };
  asset: { address: string; name: string; symbol: string; decimals: number };
  protocol: { protocolId: string; name: string; displayName: string };
  curator: { name: string; displayName: string; websiteUrl: string };
  tags: string[];
  apy: VaultAPY;
  tvl: VaultTVL;
  score: VaultScore;
  isTransactional: boolean;
  warnings: string[];
  flags: VaultFlag[];
};

export type VaultSearchParams = {
  allowedAssets?: string[];
  allowedNetworks?: string[];
  allowedProtocols?: string[];
  disallowedProtocols?: string[];
  minTvl?: number;
  minApy?: number;
  /** Passed through to the backend as-is (e.g. "apy7day", "tvl") — not validated against an enum here. */
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type VaultSearchResult = {
  vaults: VaultSummary[];
  /** Absent on the last page — pass its value as `page` to fetch the next one. */
  nextPage?: number;
};

function appendEach(q: URLSearchParams, key: string, values?: string[]) {
  for (const v of values ?? []) q.append(key, v);
}

/**
 * Search vaults through the backend's vaults.fyi proxy (BVT-398) — backs the
 * widget's "open discovery" mode and, filtered to a client's own whitelist,
 * curated-mode detail display too.
 *
 * Calls the backend, not vaults.fyi directly: vaults.fyi's API is
 * credit-metered behind an API key that must never reach a browser.
 */
export async function searchVaults(
  params: VaultSearchParams = {}
): Promise<VaultSearchResult> {
  const q = new URLSearchParams();
  appendEach(q, "allowedAssets", params.allowedAssets);
  appendEach(q, "allowedNetworks", params.allowedNetworks);
  appendEach(q, "allowedProtocols", params.allowedProtocols);
  appendEach(q, "disallowedProtocols", params.disallowedProtocols);
  if (params.minTvl !== undefined) q.set("minTvl", String(params.minTvl));
  if (params.minApy !== undefined) q.set("minApy", String(params.minApy));
  if (params.sortBy) q.set("sortBy", params.sortBy);
  if (params.sortOrder) q.set("sortOrder", params.sortOrder);
  if (params.page !== undefined) q.set("page", String(params.page));
  if (params.perPage !== undefined) q.set("perPage", String(params.perPage));

  const qs = q.toString();
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/routes/vaults${qs ? `?${qs}` : ""}`,
    { headers: jsonHeaders() }
  );
  await assertOK(r);
  const j = await r.json();
  return j.data as VaultSearchResult;
}

/**
 * Fetch full detail for one vault — the picker's detail card, and the
 * preview step for a manually entered vaultId ("find your own vault" in
 * open mode).
 */
export async function getVaultDetails(
  network: string,
  vaultId: string
): Promise<VaultSummary> {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/routes/vaults/${encodeURIComponent(network)}/${encodeURIComponent(vaultId)}`,
    { headers: jsonHeaders() }
  );
  await assertOK(r);
  const j = await r.json();
  return j.data as VaultSummary;
}

/**
 * A wallet's current balance in one vault. Confirmed against a live response
 * (2026-09-23): `asset.balanceUsd` is the wallet's TOTAL balance of that
 * asset token, repeated identically on every position row — it is NOT this
 * position's value. `lpToken.balanceUsd` is the real per-position USD value
 * (the vault share balance's own worth); use that for display, never
 * `asset.balanceUsd`.
 */
export type PositionAsset = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  /** The wallet's TOTAL balance of this asset — same value on every position row, not this position's value. */
  balanceUsd: string;
  positionValueInAsset: string;
};

export type LPToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balanceNative: string;
  /** This position's real USD value. */
  balanceUsd: string;
};

export type Position = {
  vaultId: string;
  address: string;
  name: string;
  network: { name: string; chainId: number };
  asset: PositionAsset;
  protocol: { protocolId: string; name: string; displayName: string };
  lpToken: LPToken;
  isTransactional: boolean;
  /** A single flat window — unlike VaultSummary.apy, a live position has no 1hour/1day/7day/30day breakdown. */
  apy: VaultAPYWindow;
};

/**
 * Fetch every vault a wallet currently holds a balance in — the widget's
 * "Your positions" section. Same backend-proxy reasoning as
 * searchVaults/getVaultDetails: never calls vaults.fyi directly.
 */
export async function getVaultPositions(address: string): Promise<Position[]> {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/routes/vaults/positions/${encodeURIComponent(address)}`,
    { headers: jsonHeaders() }
  );
  await assertOK(r);
  const j = await r.json();
  return (j.data ?? []) as Position[];
}

/** One step of a redeem action sequence — the frontend signs and submits
 * `tx` directly. Unlike a vault deposit, redeem never rides `buildRoute`: it
 * is a same-chain transaction with the final amount already known (the
 * caller's own share balance), so there is no bridge, no postHook, and
 * nothing for the routing engine to do. */
export type VaultRedeemAction = {
  name: string;
  tx: TxRequest;
};

/**
 * `amount` is required unless `all` is true — enforced here at the type
 * level (rather than left as a runtime check both the widget and the
 * backend would otherwise have to remember) since the two are mutually
 * exclusive by construction, exactly like `all=true` vs `amount=` on the
 * backend's own query string.
 */
export type VaultRedeemParams = {
  /** The wallet redeeming — also where the redeemed asset lands; vaults.fyi
   * has no separate receiver override for redeem, same as deposit. */
  address: string;
  network: string;
  vaultId: string;
  /** Required even for a full redeem — vaults.fyi doesn't infer it from the vault. */
  assetAddress: string;
} & ({ all: true; amount?: never } | { all?: false; amount: string });

/**
 * Fetch the unsigned redeem (withdraw) transaction for a wallet's vault
 * position — the widget's "Withdraw" action on a position row (BVT-398).
 * Same backend-proxy reasoning as searchVaults/getVaultDetails/
 * getVaultPositions: never calls vaults.fyi directly.
 */
export async function getVaultRedeemActions(
  params: VaultRedeemParams
): Promise<VaultRedeemAction[]> {
  const q = new URLSearchParams();
  q.set("address", params.address);
  q.set("assetAddress", params.assetAddress);
  if (params.all) {
    q.set("all", "true");
  } else {
    q.set("amount", params.amount);
  }

  const r = await rateLimitedFetch(
    `${apiBase()}/v1/routes/vaults/redeem/${encodeURIComponent(params.network)}/${encodeURIComponent(params.vaultId)}?${q.toString()}`,
    { headers: jsonHeaders() }
  );
  await assertOK(r);
  const j = await r.json();
  return (j.data ?? []) as VaultRedeemAction[];
}
