import { useEffect, useRef, useState } from "react";

import type { BalanceRow, ChainDef } from "../../../types";
import { getBalancesByAddress } from "../../../core/balances";
import { useChains, useTokens } from "../../hooks";
import {
  canonicalTokenAddressForChain,
  getNativeTokenAddress,
  normalizeChainKey,
} from "../../helpers/chainHelpers";

import type { Token, YourTokenData } from "./types";

type WalletTokenStateArgs = {
  walletAddress: string | null;
  selectedChain: ChainDef | null;
  setSelectedChain: (chain: ChainDef | null) => void;
  selectedToken: Token | null | YourTokenData;
  setSelectedToken: (token: Token | null | YourTokenData) => void;
};

export function useWalletTokenState({
  walletAddress,
  selectedChain,
  setSelectedChain,
  selectedToken,
  setSelectedToken,
}: WalletTokenStateArgs) {
  const [yourWalletTokens, setYourWalletTokens] = useState<YourTokenData[]>([]);
  const [walletTokensReloadNonce, setWalletTokensReloadNonce] = useState(0);
  const lastLoadedWalletRef = useRef<string | null>(null);
  const { tokens } = useTokens(null);
  const { chains } = useChains();

  useEffect(() => {
    if (!walletAddress || chains.length === 0 || tokens.length === 0) {
      setYourWalletTokens([]);
      if (!walletAddress) {
        lastLoadedWalletRef.current = null;
      }
      return;
    }

    const loadKey = `${walletAddress}:${walletTokensReloadNonce}`;
    const currentWalletAddress = walletAddress;
    if (lastLoadedWalletRef.current === loadKey) {
      return;
    }

    let cancelled = false;

    async function loadWalletTokens() {
      try {
        const balances = await getBalancesByAddress(currentWalletAddress);
        const updatedTokens = mapWalletTokens(balances, chains, tokens);

        if (cancelled) {
          return;
        }

        const sortedTokens = updatedTokens.sort(
          (a, b) => Number(b.balance) - Number(a.balance)
        );
        setYourWalletTokens(sortedTokens);

        const selectedTokenStillExists =
          selectedToken &&
          sortedTokens.some(
            (token) =>
              normalizeChainKey(token.chainId) ===
                normalizeChainKey(selectedToken.chainId) &&
              token.address === selectedToken.address
          );

        const nextSelectedToken =
          selectedTokenStillExists && selectedToken
            ? selectedToken
            : (sortedTokens.find((token) => Number(token.balance) > 0) ?? null);

        setSelectedToken(nextSelectedToken);

        if (
          nextSelectedToken &&
          (!selectedChain ||
            normalizeChainKey(selectedChain.chainId) !==
              normalizeChainKey(
                hasChainData(nextSelectedToken)
                  ? (nextSelectedToken.chainData?.chainId ?? null)
                  : nextSelectedToken.chainId
              ))
        ) {
          setSelectedChain(
            hasChainData(nextSelectedToken)
              ? (nextSelectedToken.chainData ?? null)
              : null
          );
        }

        lastLoadedWalletRef.current = loadKey;
      } catch {
        if (!cancelled) {
          setYourWalletTokens([]);
        }
      }
    }

    void loadWalletTokens();

    return () => {
      cancelled = true;
    };
  }, [
    chains,
    selectedChain,
    selectedToken,
    setSelectedChain,
    setSelectedToken,
    tokens,
    walletAddress,
    walletTokensReloadNonce,
  ]);

  const reloadWalletTokens = () => {
    setWalletTokensReloadNonce((prev) => prev + 1);
  };

  return {
    yourWalletTokens,
    setYourWalletTokens,
    reloadWalletTokens,
  };
}

function hasChainData(token: Token | YourTokenData): token is YourTokenData {
  return "chainData" in token;
}

function mapWalletTokens(
  balances: Awaited<ReturnType<typeof getBalancesByAddress>>,
  chains: ChainDef[],
  tokens: ReturnType<typeof useTokens>["tokens"]
): YourTokenData[] {
  const flattenedBalances = balances.flatMap((chainBalances) =>
    (chainBalances.balances ?? []).flatMap((balance) => {
      if (!balance || !chainBalances?.chain_id) {
        return [];
      }

      return [
        {
          ...balance,
          chain_id: chainBalances.chain_id,
        },
      ];
    })
  );

  const tokensByCanonicalKey = new Map<string, (typeof tokens)[number]>();
  for (const token of tokens) {
    const tokenChain = chains.find(
      (chain) =>
        normalizeChainKey(chain.chainId) === normalizeChainKey(token.chainId)
    );
    if (!tokenChain) {
      continue;
    }

    const canonicalAddress = canonicalTokenAddressForChain(
      tokenChain,
      token.address,
      tokens
    );
    const key = `${normalizeChainKey(token.chainId)}:${canonicalAddress}`;
    tokensByCanonicalKey.set(key, token);
  }

  return flattenedBalances.flatMap((balanceRow) => {
    const chain = chains.find(
      (candidate) =>
        normalizeChainKey(candidate.chainId) ===
        normalizeChainKey(balanceRow.chain_id)
    );
    if (!chain) {
      return [];
    }

    const balanceAddress =
      balanceRow.contract ??
      (balanceRow as BalanceRow & { address?: string }).address;

    const canonicalBalanceAddress = canonicalTokenAddressForChain(
      chain,
      balanceAddress,
      tokens
    );
    const canonicalKey = `${normalizeChainKey(balanceRow.chain_id)}:${canonicalBalanceAddress}`;
    let foundToken = tokensByCanonicalKey.get(canonicalKey);

    if (!foundToken && balanceRow.category === "native") {
      const nativeAddress = canonicalTokenAddressForChain(
        chain,
        getNativeTokenAddress(chain.type),
        tokens
      );
      const nativeKey = `${normalizeChainKey(balanceRow.chain_id)}:${nativeAddress}`;
      foundToken = tokensByCanonicalKey.get(nativeKey);
    }

    if (!foundToken?.name || !foundToken.symbol || !foundToken.address) {
      return [];
    }

    return [
      {
        ...balanceRow,
        symbol: foundToken.symbol,
        decimals: foundToken.decimals,
        name: foundToken.name,
        iconUrl: foundToken.iconUrl ?? foundToken.logoURI ?? "",
        chainId: balanceRow.chain_id,
        usdPrice: foundToken.usdPrice,
        address: foundToken.address,
        chainIconURI: chain.chainIconURI || "",
        chainData: chain,
      },
    ];
  });
}
