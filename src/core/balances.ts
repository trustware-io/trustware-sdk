/* core/balances.ts */
import type { BalanceRow } from "../types/";
import { apiBase, jsonHeaders } from "./http";
import { Registry } from "../registry";

export type { BalanceRow };

/** Map chainId -> backend chain_key and return balances */
export async function getBalances(
  chainId: string | number,
  address: string,
): Promise<BalanceRow[]> {
  const reg = await ensureRegistry();
  const meta = reg.chain(chainId);
  const chainKey = meta?.networkIdentifier || String(chainId);
  const url = `${apiBase()}/data/wallets/${encodeURIComponent(chainKey)}/${address}/balances`;
  const r = await fetch(url, { 
    method: "GET",
    credentials: "omit",
    headers: jsonHeaders(),
  });
  if (!r.ok) throw new Error(`balances: HTTP ${r.status}`);
  const j = await r.json();
  const rows: BalanceRow[] = Array.isArray(j) ? j : (j.data ?? []);
  return rows;
}

/** lazily create one registry bound to current API key */
let _registry: Registry | undefined;
async function ensureRegistry(): Promise<Registry> {
  if (!_registry) {
    _registry = new Registry(apiBase());
  }
  await _registry.ensureLoaded();
  return _registry;
}
