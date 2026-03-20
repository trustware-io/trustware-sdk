import { ChainDef } from "src/types";

export function normalizeChainKey(id: string | number | null): string {
  if (id === undefined || id === null) return "";
  return String(id).trim().toLowerCase();
}

export const NATIVE_EVM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
export const NATIVE_SOLANA =
  "So11111111111111111111111111111111111111111" as const;

type TokenAddressLookupEntry = {
  address: string;
  symbol: string;
  chainId: string | number;
};

export function getNativeTokenAddress(chainType?: ChainDef["type"] | null) {
  const normalized = chainType?.toLowerCase?.();
  return normalized === "solana" ? NATIVE_SOLANA : NATIVE_EVM;
}

export function parseDecimalToWei(
  input: string,
  decimals: number
): bigint | null {
  // accepts strings like "1", "1.", ".5", "0.1234"
  if (!input?.trim()) return null;
  const s = input.trim();
  if (!/^\d*\.?\d*$/.test(s)) return null;
  const [intPartRaw, fracRaw = ""] = s.split(".");
  const intPart = intPartRaw.length ? BigInt(intPartRaw) : 0n;
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals); // pad/right-trim
  const fracPart = frac ? BigInt(frac) : 0n;
  const base = 10n ** BigInt(decimals);
  return intPart * base + fracPart;
}

const CHAIN_TYPE_ALIASES: Record<string, SquidChainType> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  sei: "cosmos",
  "pacific-1": "cosmos",
};

export type SquidChainType = "evm" | "cosmos" | "solana" | "btc" | string;

export function normalizeChainType(
  chain?: ChainDef | SquidChainType | string | null
): SquidChainType | undefined {
  if (!chain) return undefined;
  const raw =
    typeof chain === "string"
      ? chain
      : (chain.type ??
        chain.chainType ??
        chain.networkIdentifier ??
        chain.chainId ??
        chain.id ??
        chain.networkName ??
        chain.axelarChainName);
  if (!raw) return undefined;
  const normalized = String(raw).trim().toLowerCase();
  return CHAIN_TYPE_ALIASES[normalized] ?? normalized;
}

export function canonicalChainKeyForLink(chain: ChainDef): string {
  const seiKey = canonicalSeiChainKey(chain.chainId ?? chain.id);
  if (seiKey) return seiKey;
  return normalizeChainKey(
    chain.networkIdentifier ??
      chain.axelarChainName ??
      chain.id ??
      chain.chainId ??
      chain.networkName
  );
}

const SEI_EVM_CHAIN_ID = "1329";
const SEI_COSMOS_CHAIN_ID = "pacific-1";

export function canonicalSeiChainKey(
  chainId: ChainDef["chainId"] | ChainDef["id"] | null
): string | null {
  const normalized = normalizeChainKey(chainId as string | number | null);
  if (!normalized) return null;
  if (normalized === SEI_EVM_CHAIN_ID) return "sei-evm";
  if (normalized === SEI_COSMOS_CHAIN_ID) return "sei";
  return null;
}

export function isZeroAddrLike(
  a?: string | null,
  chainType?: ChainDef["type"] | null
) {
  if (!a) return true;
  if (!chainType) return false;
  const s = normalizeAddress(a, chainType);
  return (
    s === normalizeAddress(getNativeTokenAddress(chainType), chainType) ||
    s === "0x0000000000000000000000000000000000000000"
  );
}

export function normalizeAddress(
  address: string,
  chainType?: ChainDef["type"]
) {
  if (chainType?.toLowerCase?.() === "solana") {
    const trimmed = address.trim();
    return trimmed.startsWith("0x") ? trimmed.toLowerCase() : trimmed;
  }
  return address.toLowerCase();
}

export function isNativeTokenAddress(
  address?: string | null,
  chainType?: ChainDef["type"] | null
) {
  if (!address) return false;
  if (!chainType) return false;
  return (
    normalizeAddress(address, chainType) ===
    normalizeAddress(getNativeTokenAddress(chainType), chainType)
  );
}

/**
 * Canonicalizes token identifiers across indexer and registry sources,
 * with cosmos native denom support (e.g. Sei "usei").
 */
export function canonicalTokenAddressForChain(
  chain: ChainDef,
  address?: string,
  chainTokens: TokenAddressLookupEntry[] = []
): string {
  const chainType = normalizeChainType(chain);
  const rawAddress = (address ?? "").trim();

  // Solana is base58 and case-sensitive.
  if (chainType === "solana") return rawAddress;

  if (chainType === "cosmos") {
    const chainIdKey = normalizeChainKey(chain.chainId ?? chain.id ?? "");
    const nativeSymbol = chain.nativeCurrency?.symbol?.toUpperCase?.();
    const nativeFromRegistry = chainTokens.find(
      (token) =>
        normalizeChainKey(token.chainId) === chainIdKey &&
        token.symbol?.toUpperCase?.() === nativeSymbol
    );
    const nativeDenom = (nativeFromRegistry?.address ?? "usei").toLowerCase();

    if (rawAddress.toLowerCase() === NATIVE_EVM) {
      return nativeDenom;
    }

    return rawAddress.toLowerCase();
  }

  const lowerAddress = rawAddress.toLowerCase();
  if (lowerAddress === "0x0000000000000000000000000000000000000000") {
    return NATIVE_EVM;
  }
  return lowerAddress;
}
