import type { ChainDef } from "../../types";

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

export function isSolanaNativeTokenAlias(address?: string | null) {
  if (!address) return false;
  const trimmed = address.trim();
  if (!trimmed) return false;
  return trimmed === NATIVE_SOLANA || trimmed.toLowerCase() === NATIVE_EVM;
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
  nibiru: "cosmos",
  "cataclysm-1": "cosmos",
};

function inferChainTypeFromValue(
  normalized: string
): SquidChainType | undefined {
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
  return inferChainTypeFromValue(normalized) ?? normalized;
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
    if (isSolanaNativeTokenAlias(trimmed)) {
      return NATIVE_SOLANA;
    }
    return trimmed;
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

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Chain types that can never run an ERC20 `approve()`. */
const NON_EVM_CHAIN_TYPES = new Set(["solana", "bitcoin", "btc"]);

export function isEvmAddress(value?: string | null): value is `0x${string}` {
  return !!value && EVM_ADDRESS_RE.test(value.trim());
}

/**
 * Whether spending this token has to be approved before a route can pull it.
 *
 * Only an EVM ERC20 does. An SPL mint is base58, not a 20-byte hex contract —
 * a Solana transfer is authorized by the instruction the user signs, so there
 * is no allowance to read and nothing to approve. Same for Cosmos denoms and
 * for every chain's native asset. Deciding on the address shape (rather than
 * the chain type alone) keeps EVM chains whose registry entry types itself as
 * something else — Sei EVM normalizes to "cosmos" — on the approval path.
 */
export function needsErc20Approval(
  tokenAddress?: string | null,
  chainType?: ChainDef["type"] | null
): boolean {
  if (!isEvmAddress(tokenAddress)) return false;
  const normalizedType = normalizeChainType(chainType ?? undefined);
  if (normalizedType && NON_EVM_CHAIN_TYPES.has(normalizedType)) return false;
  return (
    !isNativeTokenAddress(tokenAddress, chainType) &&
    !isZeroAddrLike(tokenAddress, chainType)
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

  // Preserve SPL mint addresses; only collapse native SOL aliases for identity.
  if (chainType === "solana") return normalizeAddress(rawAddress, "solana");

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
