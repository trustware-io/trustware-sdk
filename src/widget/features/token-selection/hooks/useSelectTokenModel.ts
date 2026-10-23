import { useCallback, useMemo } from "react";

import { getBalances } from "../../../../core/balances";
import type { ChainDef } from "../../../../types";
import type {
  Chain,
  Token,
  YourTokenData,
} from "../../../context/DepositContext";
import {
  normalizeChainKey,
  normalizeAddress,
  normalizeChainType,
} from "../../../../utils/chains";
import { resolveChainLabel } from "../../../../utils";

/**
 * How a token picked from the catalog list gets its balance. Deposit mode
 * fetches it for the amount screen; swap mode reads balances from the loaded
 * wallet rows (`findWalletBalanceRow`) and skips the call.
 */
export type CatalogPickBalance =
  | {
      fetch: true;
      onFetchFailed: (chain: ChainDef, message: string) => void;
    }
  | { fetch: false };

/** A catalog token picked on a chain, as the amount screen reads it. */
export type PickedCatalogToken = Token & { chainData: ChainDef };

/**
 * The token to select when the user picks one from the catalog list,
 * carrying its wallet balance when that's known. A failed balance fetch
 * still selects the token, with its balance undefined (unknown, never 0),
 * and reports why.
 */
export async function catalogPick(
  token: Token,
  {
    chain,
    walletAddress,
    pickBalance,
    fetchBalances,
  }: {
    chain: ChainDef | null;
    walletAddress: string | null;
    pickBalance: CatalogPickBalance;
    fetchBalances: typeof getBalances;
  }
): Promise<Token | PickedCatalogToken> {
  if (token.balance !== undefined || !pickBalance.fetch) return token;

  // The catalog list renders only once a chain is selected.
  if (!chain) {
    throw new Error(
      `Picked ${token.symbol} (${token.address}) with no chain selected`
    );
  }
  if (!walletAddress) return { ...token, balance: "0", chainData: chain };

  let rows: Awaited<ReturnType<typeof getBalances>>;
  try {
    rows = await fetchBalances(chain.chainId, walletAddress);
  } catch (error) {
    pickBalance.onFetchFailed(
      chain,
      error instanceof Error ? error.message : String(error)
    );
    return { ...token, chainData: chain };
  }

  const chainType = normalizeChainType(chain);
  const match = rows.find(
    (item) =>
      normalizeAddress(item.contract ?? item.address ?? "", chainType) ===
      normalizeAddress(token.address, chainType)
  );
  return {
    ...token,
    balance: match?.balance?.toString?.() ?? "0",
    chainData: chain,
  };
}

type UseSelectTokenModelArgs = {
  goBack: () => void;
  pickBalance: CatalogPickBalance;
  searchQuery: string;
  selectedChain: ChainDef | null;
  setSelectedChain: (chain: ChainDef | null) => void;
  setSelectedToken: (token: Token | YourTokenData | null) => void;
  walletAddress: string | null;
  yourWalletTokens: YourTokenData[];
};

export function useSelectTokenModel({
  goBack,
  pickBalance,
  searchQuery,
  selectedChain,
  setSelectedChain,
  setSelectedToken,
  walletAddress,
  yourWalletTokens,
}: UseSelectTokenModelArgs) {
  const handleChainSelect = (chain: ChainDef) => {
    const chainId = chain.chainId ?? chain.id ?? "";
    const numericChainId = Number(chainId);
    setSelectedChain({
      ...chain,
      chainId,
      name: resolveChainLabel(chain),
      shortName:
        chain.nativeCurrency?.symbol ??
        resolveChainLabel(chain).slice(0, 3).toUpperCase(),
      iconUrl: chain.chainIconURI,
      isPopular: Number.isFinite(numericChainId)
        ? [1, 137, 8453].includes(numericChainId)
        : false,
      nativeToken: chain.nativeCurrency?.symbol,
      explorerUrl: chain.blockExplorerUrls?.[0],
    } as Chain);
  };

  const handleTokenSelect = useCallback(
    async (token: Token) => {
      setSelectedToken(
        await catalogPick(token, {
          chain: selectedChain,
          walletAddress,
          pickBalance,
          fetchBalances: getBalances,
        })
      );
      goBack();
    },
    [goBack, pickBalance, selectedChain, setSelectedToken, walletAddress]
  );

  const handleYourTokenSelect = useCallback(
    (token: YourTokenData) => {
      setSelectedToken(token);
      setSelectedChain(token.chainData as Chain);
      goBack();
    },
    [goBack, setSelectedChain, setSelectedToken]
  );

  const isChainSelected = (chain: ChainDef): boolean => {
    if (!selectedChain) return false;
    return (
      normalizeChainKey(chain.chainId ?? chain.id ?? null) ===
      normalizeChainKey(selectedChain.chainId)
    );
  };

  const normalizedSearchQuery = searchQuery.toLowerCase().trim();

  const matchesSearch = (token: {
    symbol?: string;
    name?: string;
    address?: string;
  }) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    const symbol = token.symbol?.toLowerCase() ?? "";
    const name = token.name?.toLowerCase() ?? "";
    const address = token.address?.toLowerCase() ?? "";

    return (
      symbol.includes(normalizedSearchQuery) ||
      name.includes(normalizedSearchQuery) ||
      address.includes(normalizedSearchQuery)
    );
  };

  const filteredWalletTokens = useMemo(() => {
    if (!selectedChain?.chainId) {
      return [];
    }

    return yourWalletTokens.filter(
      (token) =>
        normalizeChainKey(token.chainId) ===
          normalizeChainKey(selectedChain.chainId) && matchesSearch(token)
    );
  }, [normalizedSearchQuery, selectedChain?.chainId, yourWalletTokens]);

  return {
    filteredWalletTokens,
    handleChainSelect,
    handleTokenSelect,
    handleYourTokenSelect,
    isChainSelected,
  };
}
