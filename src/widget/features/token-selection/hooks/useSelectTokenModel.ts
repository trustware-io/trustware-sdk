import { useCallback, useMemo } from "react";

import { getBalances } from "../../../../core/balances";
import type { ChainDef } from "../../../../types";
import type {
  Chain,
  Token,
  YourTokenData,
} from "../../../context/DepositContext";
import {
  normalizeAddress,
  normalizeChainType,
} from "../../../helpers/chainHelpers";
import { resolveChainLabel } from "../../../../utils";

type UseSelectTokenModelArgs = {
  goBack: () => void;
  searchQuery: string;
  selectedChain: ChainDef | null;
  setSelectedChain: (chain: ChainDef | null) => void;
  setSelectedToken: (token: Token | YourTokenData | null) => void;
  walletAddress: string | null;
  yourWalletTokens: YourTokenData[];
};

export function useSelectTokenModel({
  goBack,
  searchQuery,
  selectedChain,
  setSelectedChain,
  setSelectedToken,
  walletAddress,
  yourWalletTokens,
}: UseSelectTokenModelArgs) {
  const handleChainSelect = (chain: ChainDef) => {
    const chainId = Number(chain.chainId ?? chain.id);
    setSelectedChain({
      ...chain,
      chainId,
      name: resolveChainLabel(chain),
      shortName:
        chain.nativeCurrency?.symbol ??
        resolveChainLabel(chain).slice(0, 3).toUpperCase(),
      iconUrl: chain.chainIconURI,
      isPopular: [1, 137, 8453].includes(chainId),
      nativeToken: chain.nativeCurrency?.symbol,
      explorerUrl: chain.blockExplorerUrls?.[0],
    } as Chain);
  };

  const handleTokenSelect = useCallback(
    async (token: Token) => {
      if (token.balance !== undefined) {
        setSelectedToken(token);
        goBack();
        return;
      }

      const balance = await getBalances(
        selectedChain?.chainId as string | number,
        walletAddress as string
      );
      const chainType = normalizeChainType(selectedChain);

      const match = balance.find(
        (item) =>
          normalizeAddress(item.contract ?? item.address ?? "", chainType) ===
          normalizeAddress(token.address, chainType)
      );

      setSelectedToken({
        ...token,
        balance: match?.balance?.toString?.() ?? "0",
        chainData: selectedChain as Chain,
      } as unknown as YourTokenData);

      goBack();
    },
    [goBack, selectedChain, setSelectedToken, walletAddress]
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
    const chainId = Number(chain.chainId ?? chain.id);
    return selectedChain.chainId === chainId;
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
        Number(token.chainId) === Number(selectedChain.chainId) &&
        matchesSearch(token)
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
