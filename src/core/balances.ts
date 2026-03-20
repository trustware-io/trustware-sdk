import type {
  BalanceRow,
  WalletAddressBalanceWrapper,
  ChainDef,
} from "../types/";
import { apiBase, jsonHeaders } from "./http";
import { Registry } from "../registry";
import {
  getNativeTokenAddress,
  isZeroAddressLike,
  normalizeChainType,
} from "../utils/chains";
import { validateAddressForChain } from "../validation/address";

export type { BalanceRow };

type RawBalanceRow = Record<string, unknown>;

const balanceCache = new Map<string, BalanceRow[]>();

function toStringOrUndefined(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toNumberOrUndefined(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function fallbackTokenSymbol(address: string, chainType?: string | null) {
  if (chainType?.toLowerCase() === "solana") {
    return "SPL";
  }
  return `TOKEN-${address.slice(0, 6)}`;
}

function normalizeRows(
  rows: RawBalanceRow[],
  chain: ChainDef,
  address: string,
  registry: Registry
) {
  const chainKey = chain.networkIdentifier ?? String(chain.chainId ?? chain.id);
  const chainType = normalizeChainType(chain);
  const nativeAddress = getNativeTokenAddress(chainType);
  const map = new Map<string, BalanceRow>();

  for (const item of rows) {
    const category = toStringOrUndefined(item.category)?.toLowerCase();
    const addressRaw =
      item.contract ?? item.token_address ?? item.address ?? item.addr;
    const tokenAddress =
      typeof addressRaw === "string" ? addressRaw.trim() : undefined;
    const symbol = toStringOrUndefined(item.symbol ?? item.sym);
    const name =
      toStringOrUndefined(item.name ?? item.token_name ?? item.token) ?? symbol;
    const decimals = toNumberOrUndefined(item.decimals ?? item.dec);
    const balance = String(item.balance ?? item.bal ?? "0");
    const explicitNative = Boolean(item.native ?? item.is_native);
    const nativeFlag =
      explicitNative ||
      category === "native" ||
      isZeroAddressLike(tokenAddress, chainType);

    if (nativeFlag) {
      const nativeRow: BalanceRow = {
        chain_key: chainKey,
        category: "native",
        contract: nativeAddress,
        address: nativeAddress,
        symbol: symbol ?? chain.nativeCurrency?.symbol ?? "NATIVE",
        name: name ?? chain.nativeCurrency?.name ?? symbol,
        decimals: decimals ?? chain.nativeCurrency?.decimals ?? 18,
        balance,
      };
      map.set(`${chainKey}:${nativeAddress}`, nativeRow);
      continue;
    }

    if (!tokenAddress || decimals === undefined) continue;

    const metadata = registry.findToken(chain.chainId, tokenAddress);
    const displaySymbol =
      symbol ??
      metadata?.symbol ??
      fallbackTokenSymbol(tokenAddress, chainType);
    const displayName = name ?? metadata?.name ?? displaySymbol;
    const normalizedAddress = metadata?.address ?? tokenAddress;

    map.set(`${chainKey}:${normalizedAddress}`, {
      chain_key: chainKey,
      category:
        (category as BalanceRow["category"] | undefined) ??
        (chainType === "solana" ? "spl" : "erc20"),
      contract: normalizedAddress,
      address: normalizedAddress,
      symbol: displaySymbol,
      name: displayName,
      decimals: metadata?.decimals ?? decimals,
      balance,
      logoURI: metadata?.logoURI,
      usdPrice: metadata?.usdPrice,
    });
  }

  if (!Array.from(map.values()).some((row) => row.category === "native")) {
    map.set(`${chainKey}:${nativeAddress}`, {
      chain_key: chainKey,
      category: "native",
      contract: nativeAddress,
      address: nativeAddress,
      symbol: chain.nativeCurrency?.symbol ?? "NATIVE",
      name: chain.nativeCurrency?.name ?? chain.nativeCurrency?.symbol,
      decimals: chain.nativeCurrency?.decimals ?? 18,
      balance: "0",
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    try {
      return Number(BigInt(b.balance) - BigInt(a.balance));
    } catch {
      return 0;
    }
  });
}

/** Map chain reference -> backend chain_key and return enriched balances */
export async function getBalances(
  chainRef: string | number,
  address: string
): Promise<BalanceRow[]> {
  const reg = await ensureRegistry();
  const chain = reg.chain(chainRef);
  if (!chain) return [];

  const trimmedAddress = address.trim();
  const validation = validateAddressForChain(trimmedAddress, chain);
  if (!validation.isValid) return [];

  const chainKey = chain.networkIdentifier ?? String(chain.chainId ?? chain.id);
  const cacheKey = [
    chainKey,
    trimmedAddress,
    chain.nativeCurrency?.symbol ?? "",
    chain.nativeCurrency?.decimals ?? "",
    normalizeChainType(chain) ?? "",
  ].join(":");
  const cached = balanceCache.get(cacheKey);
  if (cached) return cached;

  const url = `${apiBase()}/v1/data/wallets/${encodeURIComponent(chainKey)}/${trimmedAddress}/balances`;
  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: jsonHeaders(),
  });
  if (!response.ok) throw new Error(`balances: HTTP ${response.status}`);
  const json = await response.json();
  const rows: RawBalanceRow[] = Array.isArray(json) ? json : (json.data ?? []);
  const normalized = normalizeRows(rows, chain, trimmedAddress, reg);
  balanceCache.set(cacheKey, normalized);
  return normalized;
}

export async function getBalancesByAddress(
  address: string
): Promise<WalletAddressBalanceWrapper[]> {
  const url = `${apiBase()}/data/balances/${address}`;
  const r = await fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: jsonHeaders(),
  });
  if (!r.ok) throw new Error(`balances: HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : (j.results ?? []);
}

let _registry: Registry | undefined;
async function ensureRegistry(): Promise<Registry> {
  if (!_registry) {
    _registry = new Registry(apiBase());
  }
  await _registry.ensureLoaded();
  return _registry;
}
