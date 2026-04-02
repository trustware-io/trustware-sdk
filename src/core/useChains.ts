import { useState, useEffect, useMemo } from "react";
import { getSharedRegistry } from "./registryClient";
import type { ChainDef } from "../types";
import {
  canonicalChainKeyForLink,
  canonicalSeiChainKey,
  normalizeChainType,
} from "src/widget/helpers/chainHelpers";

export interface UseChainsResult {
  /** All available chains */
  chains: ChainDef[];
  /** Popular/featured chains (Ethereum, Polygon, Base) */
  popularChains: ChainDef[];
  /** Other chains (not in popular list) */
  otherChains: ChainDef[];
  /** Whether chains are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;

  chainMap: Map<string, ChainDef>;
}

/** Chain IDs for popular chains */
const POPULAR_CHAIN_IDS = new Set([
  1, // Ethereum Mainnet
  137, // Polygon
  8453, // Base
]);

function filterSupportedChains(chains: ChainDef[]): ChainDef[] {
  const supportedChainTypes = new Set(["evm", "solana", "cosmos", "bitcoin"]);
  return chains.filter((chain) => {
    const chainType = normalizeChainType(chain);
    if (!chainType) return false;
    if (!supportedChainTypes.has(chainType)) {
      return false;
    }
    if (chainType === "evm") {
      // hide none working chains for now [Hedera]
      const evmKey = canonicalChainKeyForLink(chain);
      // console.log(
      //   "Checking EVM chain:",
      //   chain.chainId,
      //   "canonical key:",
      //   evmKey
      // );
      const disabledEvmChains = new Set(["hedera", "295"]);
      if (evmKey && disabledEvmChains.has(evmKey)) {
        return false;
      }
    }
    if (chainType === "cosmos") {
      const seiKey = canonicalSeiChainKey(chain.chainId ?? chain.id);
      if (seiKey !== "sei" && seiKey !== "pacific-1") {
        return false;
      }
    }
    // hide bitcoin for now until we have a better address resoultion for btc maybe wait for squid. or use lifi not sure yet
    if (chainType === "bitcoin") {
      return false;
    }
    return true;
  });
}

/**
 * Hook to load available chains from the registry.
 * Returns chains split into popular and other categories.
 */
export function useChains(): UseChainsResult {
  const [chains, setChains] = useState<ChainDef[]>([]);
  const [chainMap, setChainMap] = useState<Map<string, ChainDef>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const registry = getSharedRegistry();

  useEffect(() => {
    if (chains.length > 0) return;

    let cancelled = false;

    const loadChains = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await registry.ensureChainsLoaded();

        if (cancelled) return;

        // Filter and sort chains
        const loadedChains = registry.chains();
        // .filter((chain) => chain.visible !== false);
        // .filter((chain) => {
        //   // Only include EVM chains
        //   const type = (chain.type ?? chain.chainType)
        //     ?.toString()
        //     .toLowerCase();
        //   return !type || type === "evm";
        // })
        // .sort((a, b) =>
        //   resolveChainLabel(a).localeCompare(resolveChainLabel(b))
        // );
        const supportedChains = filterSupportedChains(loadedChains);
        const chainMap: Map<string, ChainDef> = new Map(
          supportedChains.map((chain) => [
            (chain.chainId ?? chain.id) as string,
            chain,
          ])
        );

        setChainMap(chainMap);

        setChains(supportedChains);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load chains";
          setError(message);
          setChains([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadChains();

    return () => {
      cancelled = true;
    };
  }, [registry, chains.length]);

  // Split chains into popular and other
  const { popularChains, otherChains } = useMemo(() => {
    const popular: ChainDef[] = [];
    const other: ChainDef[] = [];

    for (const chain of chains) {
      const chainId = Number(chain.chainId ?? chain.id);
      if (POPULAR_CHAIN_IDS.has(chainId)) {
        popular.push(chain);
      } else {
        other.push(chain);
      }
    }

    // Sort popular chains by the order in POPULAR_CHAIN_IDS
    const popularOrder = [1, 137, 8453];
    popular.sort((a, b) => {
      const aId = Number(a.chainId ?? a.id);
      const bId = Number(b.chainId ?? b.id);
      return popularOrder.indexOf(aId) - popularOrder.indexOf(bId);
    });

    return { popularChains: popular, otherChains: other };
  }, [chains]);

  return {
    chains,
    chainMap,
    popularChains,
    otherChains,
    isLoading,
    error,
  };
}
