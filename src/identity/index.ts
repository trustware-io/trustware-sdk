import type {
  WalletAddressResolution,
  WalletAddressSource,
  WalletIdentity,
  WalletIdentityAddress,
  WalletIdentityChainLike,
} from "../types";
import { validateAddressForChain } from "../validation/address";
import { normalizeChainKey, normalizeChainType } from "../utils/chains";

function normalizeIdentityChainId(
  chain?: WalletIdentityChainLike
): string | undefined {
  if (!chain || typeof chain === "string") return undefined;
  const raw = chain.chainId ?? chain.id;
  if (raw === undefined || raw === null) return undefined;
  const normalized = String(raw).trim();
  return normalized || undefined;
}

function identityEntryMatchesChain(
  entry: WalletIdentityAddress,
  chainType?: string,
  chainKey?: string,
  chainId?: string
) {
  if (chainKey && entry.chainKey && entry.chainKey === chainKey) return true;
  if (chainId && entry.chainId && entry.chainId === chainId) return true;
  if (chainType && entry.chainType === chainType) return true;
  return false;
}

export function createWalletIdentity(
  addresses: WalletIdentityAddress[] = []
): WalletIdentity {
  return { addresses };
}

export function upsertWalletIdentityAddress(
  identity: WalletIdentity,
  next: WalletIdentityAddress
): WalletIdentity {
  const normalizedAddress = next.address.trim();
  const normalizedChainKey = next.chainKey
    ? normalizeChainKey(next.chainKey)
    : undefined;
  const normalizedChainId = next.chainId?.trim() || undefined;

  const addresses = identity.addresses.filter((entry) => {
    if (entry.chainType !== next.chainType) return true;
    if (normalizedChainKey && entry.chainKey === normalizedChainKey)
      return false;
    if (normalizedChainId && entry.chainId === normalizedChainId) return false;
    if (!normalizedChainKey && !normalizedChainId) return false;
    return true;
  });

  if (!normalizedAddress) return createWalletIdentity(addresses);

  return createWalletIdentity([
    ...addresses,
    {
      ...next,
      address: normalizedAddress,
      chainKey: normalizedChainKey,
      chainId: normalizedChainId,
    },
  ]);
}

export function resolveWalletAddressForChain(
  identity: WalletIdentity,
  chain?: WalletIdentityChainLike
): WalletAddressResolution {
  const chainType = normalizeChainType(chain);
  const chainDef = typeof chain === "object" && chain ? chain : undefined;
  const chainKey = chainDef
    ? normalizeChainKey(
        chainDef.networkIdentifier ?? chainDef.chainId ?? chainDef.id
      )
    : typeof chain === "string"
      ? normalizeChainKey(chain)
      : undefined;
  const chainId = normalizeIdentityChainId(chain);

  if (!chainType) {
    return {
      status: "missing",
      reason: "unknown_chain_type",
      chainKey,
      chainId,
    };
  }

  const match = identity.addresses.find((entry) =>
    identityEntryMatchesChain(entry, chainType, chainKey, chainId)
  );

  if (!match) {
    return {
      status: "missing",
      reason: "missing_chain_address",
      chainType,
      chainKey,
      chainId,
    };
  }

  const validation = validateAddressForChain(
    match.address,
    chainDef ?? chainType
  );
  if (!validation.isValid) {
    return {
      status: "invalid",
      reason: validation.error ?? "invalid_chain_address",
      address: match.address,
      source: match.source,
      chainType,
      chainKey,
      chainId,
    };
  }

  return {
    status: "resolved",
    address: match.address.trim(),
    source: match.source,
    chainType,
    chainKey,
    chainId,
  };
}

export function buildWalletIdentityAddress(params: {
  address: string;
  chain: WalletIdentityChainLike;
  source: WalletAddressSource;
  providerId?: string;
}): WalletIdentityAddress | null {
  const chainType = normalizeChainType(params.chain);
  if (!chainType) return null;

  const address = params.address.trim();
  const chainId = normalizeIdentityChainId(params.chain);
  const chainDef =
    typeof params.chain === "object" && params.chain ? params.chain : undefined;
  const chainKey = chainDef
    ? normalizeChainKey(
        chainDef.networkIdentifier ?? chainDef.chainId ?? chainDef.id
      )
    : undefined;

  return {
    address,
    chainType,
    chainId,
    chainKey,
    providerId: params.providerId,
    source: params.source,
  };
}

export class IdentityStore {
  private _identity = createWalletIdentity();

  get snapshot() {
    return this._identity;
  }

  reset() {
    this._identity = createWalletIdentity();
  }

  upsert(next: WalletIdentityAddress) {
    this._identity = upsertWalletIdentityAddress(this._identity, next);
    return this._identity;
  }

  resolve(chain?: WalletIdentityChainLike) {
    return resolveWalletAddressForChain(this._identity, chain);
  }
}
