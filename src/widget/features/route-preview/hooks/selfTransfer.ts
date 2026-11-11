import type { ChainType } from "../../../../types";
import { tokenIdentityKey } from "../../../../utils/chains";

type RouteEnd = { chainId: string | number; token: string | number };

/**
 * Whether a route would send a token to itself on its own chain, by
 * `tokenIdentityKey`: chain ids compare as keys (Number() made every non-EVM
 * key NaN, which equals nothing), EVM addresses ignore case, and Solana mints
 * keep it. `sourceChainType` is the type of `from`'s chain; it decides how
 * both tokens are read, which is right because the chains must match anyway.
 */
export function isSameChainSelfTransfer(
  from: RouteEnd,
  to: RouteEnd,
  sourceChainType: ChainType | null | undefined
): boolean {
  return (
    tokenIdentityKey(from.chainId, String(from.token), sourceChainType) ===
    tokenIdentityKey(to.chainId, String(to.token), sourceChainType)
  );
}
