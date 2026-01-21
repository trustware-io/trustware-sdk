import { useState, useEffect, useMemo } from "react";
import { Registry } from "../../registry";
import { apiBase } from "../../core/http";
import type { ChainDef } from "../../types/";
import { resolveChainLabel } from "../../utils";

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
}

/** Chain IDs for popular chains */
const POPULAR_CHAIN_IDS = new Set([
  1, // Ethereum Mainnet
  137, // Polygon
  8453, // Base
]);

/**
 * Hook to load available chains from the registry.
 * Returns chains split into popular and other categories.
 */
export function useChains(): UseChainsResult {
  const [chains, setChains] = useState<ChainDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const registry = useMemo(() => new Registry(apiBase()), []);

  useEffect(() => {
    let cancelled = false;

    const loadChains = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await registry.ensureLoaded();

        if (cancelled) return;

        // Filter and sort chains
        const loadedChains = registry
          .chains()
          .filter((chain) => chain.visible !== false)
          .filter((chain) => {
            // Only include EVM chains
            const type = (chain.type ?? chain.chainType)
              ?.toString()
              .toLowerCase();
            return !type || type === "evm";
          })
          .sort((a, b) =>
            resolveChainLabel(a).localeCompare(resolveChainLabel(b))
          );

        setChains(loadedChains);
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
  }, [registry]);

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
    popularChains,
    otherChains,
    isLoading,
    error,
  };
}
