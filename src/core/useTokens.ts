import { useState, useEffect, useMemo } from "react";
import { Registry } from "../registry";
import { apiBase } from "./http";
import type { TokenDef } from "../types";
import type { Token } from "../widget-v2/context/DepositContext";

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

  const registry = useMemo(() => new Registry(apiBase()), []);

  useEffect(() => {
    // Reset state when chainId changes
    setSearchQuery("");
    setError(null);

    if (chainId === undefined || tokens.length > 0) {
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

        // console.log("[useTokens] Loaded tokens from registry:", {
        //   tokenDefs,
        //   chainId,
        // });

        // Filter, dedupe by address, and sort tokens
        const seenAddresses = new Set<string>();
        const loadedTokens = tokenDefs
          .filter((token) => token.visible !== false && token.active !== false)
          .filter((token) => {
            const lowerAddr = token.address.toLowerCase();
            if (seenAddresses.has(lowerAddr)) {
              return false;
            }
            seenAddresses.add(lowerAddr);
            return true;
          })
          .map(mapTokenDefToToken)
          .sort((a, b) => {
            // Sort stablecoins first (USDC, USDT, DAI), then by symbol
            const stablecoins = ["USDC", "USDT", "DAI", "BUSD"];
            const aIsStable = stablecoins.some((s) =>
              a.symbol.toUpperCase().includes(s)
            );
            const bIsStable = stablecoins.some((s) =>
              b.symbol.toUpperCase().includes(s)
            );

            if (aIsStable && !bIsStable) return -1;
            if (!aIsStable && bIsStable) return 1;
            return a.symbol.localeCompare(b.symbol);
          });
        // console.log({
        //   loadedTokens,
        // });
        if (loadedTokens !== undefined) {
          setTokens(loadedTokens);
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
  }, [chainId, registry]);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return tokens;
    }

    const query = searchQuery.toLowerCase().trim();
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
    );
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
