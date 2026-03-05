import chainPopularityMap from "../data/chainPopularity.json";
import { normalizeChainKey } from "./chainHelpers";

type ChainPopularityLookup = Record<string, number>;

const popularityByKey = chainPopularityMap as ChainPopularityLookup;

export type ChainPopularityInput = {
  chainId?: string | number | null;
  networkIdentifier?: string | number | null;
  networkName?: string | number | null;
  axelarChainName?: string | number | null;
};

export function getChainPopularityRank(
  chain: ChainPopularityInput | null | undefined
): number | null {
  if (!chain) return null;

  const aliases = [
    chain.chainId,
    chain.networkIdentifier,
    chain.networkName,
    chain.axelarChainName,
  ];

  for (const alias of aliases) {
    const key = normalizeChainKey(alias ?? null);
    if (!key) continue;

    const rank = popularityByKey[key];
    if (typeof rank === "number") {
      return rank;
    }
  }

  return null;
}
