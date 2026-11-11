import { normalizeChainKey } from "../../../../utils/chains";

type RouteEnd = { chainId: string | number; token: string | number };

/**
 * Whether a route would send a token to itself on its own chain. Chain ids
 * are compared as keys, not numbers: Number() turns every non-EVM key into
 * NaN, and NaN equals nothing, so a Solana-to-Solana self-transfer used to
 * pass.
 */
export function isSameChainSelfTransfer(from: RouteEnd, to: RouteEnd): boolean {
  return (
    String(from.token).toLowerCase() === String(to.token).toLowerCase() &&
    normalizeChainKey(from.chainId) === normalizeChainKey(to.chainId)
  );
}
