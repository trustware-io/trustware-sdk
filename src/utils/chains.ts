import type { ChainDef, ChainType } from "../types";

export const NATIVE_EVM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export const NATIVE_SOLANA =
  "So11111111111111111111111111111111111111111";

const CHAIN_TYPE_ALIASES: Record<string, ChainType> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  sei: "cosmos",
  "pacific-1": "cosmos",
};

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
  return CHAIN_TYPE_ALIASES[normalized] ?? normalized;
}

export function getNativeTokenAddress(chainType?: ChainType | null) {
  return normalizeChainType(chainType) === "solana" ? NATIVE_SOLANA : NATIVE_EVM;
}

export function normalizeAddress(address: string, chainType?: ChainType | null) {
  const trimmed = address.trim();
  if (normalizeChainType(chainType) === "solana") {
    return trimmed.startsWith("0x") ? trimmed.toLowerCase() : trimmed;
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
    normalized === normalizeAddress(getNativeTokenAddress(chainType), chainType) ||
    normalized === "0x0000000000000000000000000000000000000000"
  );
}
