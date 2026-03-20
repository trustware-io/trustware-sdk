import type { ChainDef, ChainType } from "../types";

export const NATIVE_EVM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export const NATIVE_SOLANA = "So11111111111111111111111111111111111111111";

const CHAIN_TYPE_ALIASES: Record<string, ChainType> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  sei: "cosmos",
  "pacific-1": "cosmos",
};

function inferChainTypeFromValue(normalized: string): ChainType | undefined {
  if (!normalized) return undefined;

  const aliased = CHAIN_TYPE_ALIASES[normalized];
  if (aliased) return aliased;

  if (
    normalized === "evm" ||
    normalized === "solana" ||
    normalized === "cosmos" ||
    normalized === "bitcoin"
  ) {
    return normalized;
  }

  if (/^eip155:\d+$/.test(normalized) || /^\d+$/.test(normalized)) {
    return "evm";
  }

  if (normalized.startsWith("solana:") || normalized.includes("solana")) {
    return "solana";
  }

  if (
    normalized.startsWith("cosmos:") ||
    normalized.startsWith("sei:") ||
    normalized === "sei-evm"
  ) {
    return "cosmos";
  }

  return undefined;
}

export function normalizeChainKey(
  value: string | number | null | undefined
): string {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

export function normalizeChainType(
  chain?: ChainDef | ChainType | string | null
): ChainType | undefined {
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
  return inferChainTypeFromValue(normalized) ?? normalized;
}

export function getNativeTokenAddress(chainType?: ChainType | null) {
  return normalizeChainType(chainType) === "solana"
    ? NATIVE_SOLANA
    : NATIVE_EVM;
}

export function isSolanaNativeTokenAlias(address?: string | null) {
  if (!address) return false;
  const trimmed = address.trim();
  if (!trimmed) return false;
  return trimmed === NATIVE_SOLANA || trimmed.toLowerCase() === NATIVE_EVM;
}

export function normalizeAddress(
  address: string,
  chainType?: ChainType | null
) {
  const trimmed = address.trim();
  if (normalizeChainType(chainType) === "solana") {
    if (isSolanaNativeTokenAlias(trimmed)) {
      return NATIVE_SOLANA;
    }
    return trimmed;
  }
  return trimmed.toLowerCase();
}

export function isZeroAddressLike(
  address?: string | null,
  chainType?: ChainType | null
) {
  if (!address) return true;
  const normalized = normalizeAddress(address, chainType);
  return (
    normalized ===
      normalizeAddress(getNativeTokenAddress(chainType), chainType) ||
    normalized === "0x0000000000000000000000000000000000000000"
  );
}
