import { ChainDef } from "src/types";

export function normalizeChainKey(id: string | number | null): string {
  if (id === undefined || id === null) return "";
  return String(id).trim().toLowerCase();
}

export const NATIVE_EVM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
export const NATIVE_SOLANA =
  "So11111111111111111111111111111111111111111" as const;

export function getNativeTokenAddress(chainType?: ChainDef["type"] | null) {
  const normalized = chainType?.toLowerCase?.();
  return normalized === "solana" ? NATIVE_SOLANA : NATIVE_EVM;
}
