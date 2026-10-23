import type { ChainDef } from "../../types";
import {
  EVM_ZERO_ADDRESS,
  isNativeTokenAddress,
  NATIVE_EVM,
  normalizeAddress,
  normalizeChainKey,
  normalizeChainType,
} from "../../utils/chains";

type TokenAddressLookupEntry = {
  address: string;
  symbol: string;
  chainId: string | number;
};

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

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Chain types that can never run an ERC20 `approve()`. */
const NON_EVM_CHAIN_TYPES = new Set(["solana", "bitcoin", "btc"]);

/**
 * The value as given must already be a 20-byte hex address — no trimming.
 * This narrows the caller's own string, and every consumer passes that exact
 * string on to an allowance read or to viem, both of which reject padding.
 * Accepting " 0xabc… " here would hand them a value the type says is safe.
 */
export function isEvmAddress(value?: string | null): value is `0x${string}` {
  return !!value && EVM_ADDRESS_RE.test(value);
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
  return !isNativeTokenAddress(tokenAddress, chainType);
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
  if (lowerAddress === EVM_ZERO_ADDRESS) {
    return NATIVE_EVM;
  }
  return lowerAddress;
}
