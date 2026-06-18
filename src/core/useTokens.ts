import { useState, useEffect, useMemo, startTransition } from "react";
import { getSharedRegistry } from "./registryClient";
import type { TokenDef } from "../types";
// import type { Token } from "../widget/context/DepositContext";
import { Token } from "../widget/state/deposit/types";
import { useChains } from "./useChains";
import { sortTokensByPopularity } from "../widget/helpers/tokenPopularity";
import { TrustwareConfigStore } from "../config/store";
import { NATIVE_EVM, NATIVE_SOLANA } from "../widget/helpers/chainHelpers";
import featuredAssetsData from "../widget/data/featuredAssets.json";

type FeaturedEntry = { symbol: string; address: string };
type FeaturedChain = {
  nativeAsset?: FeaturedEntry;
  top: FeaturedEntry[];
  stables: FeaturedEntry[];
};
const FEATURED = featuredAssetsData as Record<string, FeaturedChain>;

// Well-known native token addresses that always sort first
const BASE_NATIVE_ADDRESSES = new Set([
  NATIVE_EVM.toLowerCase(),
  NATIVE_SOLANA.toLowerCase(),
  // Some EVM chains (e.g. ZKsync) use the zero address for the native token
  "0x0000000000000000000000000000000000000000",
]);

const DEFAULT_PAGE_LIMIT = 100;

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
  /** Whether more tokens can be loaded for the active query */
  hasNextPage: boolean;
  /** Load the next token page when pagination is enabled */
  loadMore: () => Promise<void>;
  /** Whether an additional page request is in flight */
  isLoadingMore: boolean;
}

function mapTokenDefToToken(tokenDef: TokenDef): Token {
  return {
    address: tokenDef.address,
    chainId: tokenDef.chainId,
    symbol: tokenDef.symbol,
    name: tokenDef.name,
    decimals: tokenDef.decimals,
    iconUrl: tokenDef.logoURI,
    logoURI: tokenDef.logoURI,
    balance: undefined,
    usdPrice: tokenDef.usdPrice,
  };
}

function dedupeTokens(tokens: Token[]): Token[] {
  const byKey = new Map<string, Token>();
  for (const token of tokens) {
    byKey.set(`${token.chainId}:${token.address.toLowerCase()}`, token);
  }
  return Array.from(byKey.values());
}

export function useTokens(
  chainId: string | number | null | undefined
): UseTokensResult {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasNextPage, setHasNextPage] = useState(false);

  const registry = getSharedRegistry();
  const { chainMap } = useChains();
  const tokensPaginationEnabled =
    TrustwareConfigStore.peek()?.features.tokensPagination ?? false;
  const normalizedSearchQuery = searchQuery.trim();
  const queryDependency = tokensPaginationEnabled ? normalizedSearchQuery : "";

  useEffect(() => {
    setSearchQuery("");
    setError(null);
    setTokens([]);
    setNextCursor(undefined);
    setHasNextPage(false);
  }, [chainId]);

  useEffect(() => {
    if (chainId === undefined || chainMap.size === 0) {
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    let cancelled = false;

    const loadInitialTokens = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setTokens([]);
        setNextCursor(undefined);
        setHasNextPage(false);

        if (chainId === null || !tokensPaginationEnabled) {
          await registry.ensureLoaded();

          if (cancelled) return;

          const tokenDefs =
            chainId === null ? registry.allTokens() : registry.tokens(chainId);
          const filtered = tokenDefs.filter((item) =>
            chainMap.has(item.chainId.toString())
          );
          const mapped = filtered.map(mapTokenDefToToken);
          startTransition(() => {
            setTokens(mapped);
          });
          return;
        }

        // No search query — use the full cached token list so featuredAssets.json
        // ordering works correctly. Pagination is only useful for search results.
        if (!queryDependency) {
          await registry.ensureLoaded();
          if (cancelled) return;
          const tokenDefs = registry.tokens(chainId);
          const filtered = tokenDefs.filter((item) =>
            chainMap.has(item.chainId.toString())
          );
          const mapped = filtered.map(mapTokenDefToToken);
          startTransition(() => {
            setTokens(mapped);
            setHasNextPage(false);
          });
          return;
        }

        // User is searching — use the paginated endpoint for fast filtered results.
        const page = await registry.tokensPage(chainId, {
          q: queryDependency,
          limit: DEFAULT_PAGE_LIMIT,
        });

        if (cancelled) return;

        const filtered = page.data.filter((item) =>
          chainMap.has(item.chainId.toString())
        );
        const mapped = filtered.map(mapTokenDefToToken);
        startTransition(() => {
          setTokens(mapped);
          setNextCursor(page.pageInfo.nextCursor);
          setHasNextPage(page.pageInfo.hasNextPage);
        });
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load tokens";
          setError(message);
          setTokens([]);
          setNextCursor(undefined);
          setHasNextPage(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialTokens();

    return () => {
      cancelled = true;
    };
  }, [chainId, registry, chainMap, queryDependency, tokensPaginationEnabled]);

  const loadMore = async () => {
    if (
      chainId == null ||
      !tokensPaginationEnabled ||
      !hasNextPage ||
      !nextCursor ||
      isLoadingMore
    ) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const page = await registry.tokensPage(chainId, {
        cursor: nextCursor,
        q: queryDependency || undefined,
        limit: DEFAULT_PAGE_LIMIT,
      });
      const filtered = page.data.filter((item) =>
        chainMap.has(item.chainId.toString())
      );
      setTokens((current) =>
        dedupeTokens([...current, ...filtered.map(mapTokenDefToToken)])
      );
      setNextCursor(page.pageInfo.nextCursor);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load more tokens";
      setError(message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const chainFeatured = useMemo(() => {
    const key = chainId?.toString() ?? "";
    return FEATURED[key] ?? null;
  }, [chainId]);

  const nativeAddresses = useMemo(() => {
    const set = new Set(BASE_NATIVE_ADDRESSES);
    // Add the explicit native address from the JSON for this chain
    if (chainFeatured?.nativeAsset?.address) {
      set.add(chainFeatured.nativeAsset.address.toLowerCase());
    }
    return set;
  }, [chainFeatured]);

  const nativeSymbols = useMemo(() => {
    // Symbol fallback: covers chains not in the JSON or chains where the
    // registry uses an unexpected address for the native token
    const symbols = new Set<string>();
    if (chainFeatured?.nativeAsset?.symbol) {
      symbols.add(chainFeatured.nativeAsset.symbol.toUpperCase());
    }
    // Also use the chain definition's native currency as a fallback
    if (chainId) {
      const chainDef = chainMap.get(chainId.toString());
      const sym = chainDef?.nativeCurrency?.symbol;
      if (sym) symbols.add(sym.toUpperCase());
    }
    return symbols;
  }, [chainId, chainMap, chainFeatured]);

  const featuredAddresses = useMemo(() => {
    if (!chainFeatured) return new Map<string, number>();
    const map = new Map<string, number>();
    let order = 0;
    for (const s of chainFeatured.stables)
      map.set(s.address.toLowerCase(), order++);
    for (const t of chainFeatured.top)
      map.set(t.address.toLowerCase(), order++);
    return map;
  }, [chainFeatured]);

  const featuredSymbols = useMemo(() => {
    if (!chainFeatured) return new Map<string, number>();
    const map = new Map<string, number>();
    let order = 0;
    for (const s of chainFeatured.stables)
      map.set(s.symbol.toUpperCase(), order++);
    for (const t of chainFeatured.top) map.set(t.symbol.toUpperCase(), order++);
    return map;
  }, [chainFeatured]);

  const filteredTokens = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const source =
      query.length === 0 || tokensPaginationEnabled
        ? tokens
        : tokens.filter(
            (token: Token) =>
              token.symbol.toLowerCase().includes(query) ||
              token.name.toLowerCase().includes(query) ||
              token.address.toLowerCase().includes(query)
          );

    return sortTokensByPopularity(source, {
      nativeAddresses,
      nativeSymbols,
      featuredAddresses,
      featuredSymbols,
    });
  }, [
    tokens,
    searchQuery,
    tokensPaginationEnabled,
    nativeAddresses,
    nativeSymbols,
    featuredAddresses,
    featuredSymbols,
  ]);

  return {
    tokens,
    filteredTokens,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    hasNextPage,
    loadMore,
    isLoadingMore,
  };
}
