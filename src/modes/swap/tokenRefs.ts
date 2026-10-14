import type { ChainDef } from "src/types";
import type { SwapTokenRef } from "src/types/config";
import { normalizeChainKey } from "src/utils/chains";

/** Whether a host's token ref names this chain, by the catalog's chain id. */
export function refIsOnChain(ref: SwapTokenRef, chain: ChainDef): boolean {
  return normalizeChainKey(ref.chainId) === normalizeChainKey(chain.chainId);
}

/** The loaded chain a ref names, if any. */
export function chainForRef(
  chains: readonly ChainDef[],
  ref: SwapTokenRef
): ChainDef | undefined {
  return chains.find((chain) => refIsOnChain(ref, chain));
}

/** The refs that name tokens on one chain. */
export function refsOnChain(
  refs: readonly SwapTokenRef[],
  chain: ChainDef
): SwapTokenRef[] {
  return refs.filter((ref) => refIsOnChain(ref, chain));
}

/** The chains holding at least one of the refs, in their original order. */
export function chainsWithRefs(
  chains: readonly ChainDef[],
  refs: readonly SwapTokenRef[]
): ChainDef[] {
  return chains.filter((chain) => refs.some((ref) => refIsOnChain(ref, chain)));
}
