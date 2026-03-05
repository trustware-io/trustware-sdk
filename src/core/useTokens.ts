import { useState, useEffect, useMemo } from "react";
import { getSharedRegistry } from "./registryClient";
import type { TokenDef } from "../types";
import type { Token } from "../widget-v2/context/DepositContext";
import { useChains } from "./useChains";
import { sortTokensByPopularity } from "../widget-v2/helpers/tokenPopularity";

export interface UseTokensResult {
  /** All available tokens for the selected chain */
  tokens: Token[];
  /** Filtered tokens based on search query */
  filteredTokens: Token[];
  /** Whether tokens are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Current search query */
  searchQuery: string;
  /** Set the search query to filter tokens */
  setSearchQuery: (query: string) => void;
}

/**
 * Convert TokenDef from registry to Token interface used by context
 */
function mapTokenDefToToken(tokenDef: TokenDef): Token {
  return {
    address: tokenDef.address,
    chainId: tokenDef.chainId,
    symbol: tokenDef.symbol,
    name: tokenDef.name,
    decimals: tokenDef.decimals,
    iconUrl: tokenDef.logoURI,
    logoURI: tokenDef.logoURI,
    // balance is populated separately when wallet is connected
    balance: undefined,
    usdPrice: tokenDef.usdPrice,
  };
}

/**
 * Hook to load available tokens for a selected chain from the registry.
 * Supports filtering tokens by name or symbol.
 */
export function useTokens(chainId: number | null | undefined): UseTokensResult {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const registry = getSharedRegistry();

  const { chainMap } = useChains();

  useEffect(() => {
    // Reset state when chainId changes
    setSearchQuery("");
    setError(null);
    setTokens([]);

    if (chainId === undefined || chainMap.size === 0) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadTokens = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await registry.ensureLoaded();

        if (cancelled) return;

        // Get tokens for the selected chain. if set to <null>, get all tokens.
        const tokenDefs =
          chainId === null ? registry.allTokens() : registry.tokens(chainId);

        const filteredTokens = tokenDefs.filter((item) =>
          chainMap.has(item.chainId.toString())
        );

        if (filteredTokens !== undefined) {
          setTokens(filteredTokens.map(mapTokenDefToToken));
        }
        // setTokens(loadedTokens);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load tokens";
          setError(message);
          setTokens([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTokens();

    return () => {
      cancelled = true;
    };
  }, [chainId, registry, chainMap]);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const source =
      query.length === 0
        ? tokens
        : tokens.filter(
            (token: Token) =>
              token.symbol.toLowerCase().includes(query) ||
              token.name.toLowerCase().includes(query) ||
              token.address.toLowerCase().includes(query)
          );

    return sortTokensByPopularity(source); 
  }, [tokens, searchQuery]);

  return {
    tokens,
    filteredTokens,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
  };
}
