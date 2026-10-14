import type { ChainDef, ChainType } from "../types";

export const NATIVE_EVM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
/**
 * Native SOL: the Solana System Program id. It names the native asset of
 * every Solana-VM chain (Eclipse's ETH too), and it's the address the token
 * catalog and the Relay/LiFi routers use. Not to be confused with wrapped
 * SOL (`So1111…112`), a separate SPL token.
 */
export const NATIVE_SOLANA = "11111111111111111111111111111111";
export const EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Solana mainnet-beta as the routing backend identifies it numerically. */
export const SOLANA_CHAIN_ID = "1151111081099710";

const CHAIN_TYPE_ALIASES: Record<string, ChainType> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  sei: "cosmos",
  "pacific-1": "cosmos",
  nibiru: "cosmos",
  "cataclysm-1": "cosmos",
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

  // Solana's own chain id is numeric, so it has to be claimed before the
  // "all digits means EVM" heuristic below — otherwise SPL routes get
  // classified as EVM and take ERC20 code paths that cannot work.
  if (normalized === SOLANA_CHAIN_ID) return "solana";

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

/** The catalog's Squid record and the routing wire both spell native SOL
 *  with the EVM sentinel. */
function isSolanaNativeTokenAlias(trimmedAddress: string) {
  return (
    trimmedAddress === NATIVE_SOLANA ||
    trimmedAddress.toLowerCase() === NATIVE_EVM
  );
}

const HEX_ADDRESS = /^0x[0-9a-f]+$/i;

/**
 * The comparison key for a token address on a chain: two addresses name the
 * same token exactly when their keys are equal.
 *
 * Case is meaningless in a hex EVM address but significant in a Base58 SPL
 * mint, so only the former is folded. On a Solana chain every spelling of the
 * native asset maps to `NATIVE_SOLANA`. With no chain type to go on, the
 * address format is self-describing: hex folds, anything else stays exact.
 */
export function normalizeAddress(
  address: string,
  chainType?: ChainType | null
): string {
  const trimmed = address.trim();
  const type = normalizeChainType(chainType);
  if (type === "solana") {
    return isSolanaNativeTokenAlias(trimmed) ? NATIVE_SOLANA : trimmed;
  }
  if (type) return trimmed.toLowerCase();
  return HEX_ADDRESS.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/**
 * One key per token: two tokens are the same exactly when their chains match
 * and their addresses normalize equal. `chainType` must be the token's own
 * chain type; inferring it from a bare chain id misreads Solana-VM chains
 * with numeric ids, Eclipse among them, as EVM.
 */
export function tokenIdentityKey(
  chainId: string | number,
  address: string,
  chainType: ChainType | null | undefined
): string {
  return `${normalizeChainKey(chainId)}:${normalizeAddress(address, chainType)}`;
}

/**
 * Whether the address names the chain's native asset rather than a token
 * contract or mint. The EVM zero address counts on every chain: some EVM
 * chains list their native asset there instead of at the sentinel.
 */
export function isNativeTokenAddress(
  address: string | null | undefined,
  chainType?: ChainType | null
): boolean {
  if (!address) return false;
  const key = normalizeAddress(address, chainType);
  return (
    key === normalizeAddress(getNativeTokenAddress(chainType), chainType) ||
    key === EVM_ZERO_ADDRESS
  );
}
