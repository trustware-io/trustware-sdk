import { useCallback, useMemo } from "react";

import type {
  Chain,
  Token,
  YourTokenData,
} from "../../../context/DepositContext";
import { normalizeAddress } from "../../../helpers/chainHelpers";
import { formatTokenBalance } from "../../../../utils";

type UseOrderedWalletTokensArgs = {
  amount: string;
  amountInputMode: "usd" | "token";
  selectedToken: Token | YourTokenData | null;
  setSelectedChain: (chain: Chain | null) => void;
  setSelectedToken: (token: Token | YourTokenData | null) => void;
  yourWalletTokens: YourTokenData[];
};

export function useOrderedWalletTokens({
  amount,
  amountInputMode,
  selectedToken,
  setSelectedChain,
  setSelectedToken,
  yourWalletTokens,
}: UseOrderedWalletTokensArgs) {
  const handleTokenChange = useCallback(
    async (token: Token | YourTokenData | null) => {
      if (token) {
        setSelectedToken(token);
        setSelectedChain((token as YourTokenData).chainData as Chain);
      }
    },
    [setSelectedChain, setSelectedToken]
  );

  const orderedTokens = useMemo(() => {
    const selectedTokenChainType =
      (selectedToken as YourTokenData | null)?.chainData?.type ??
      (selectedToken as YourTokenData | null)?.chainData?.chainType;
    const index = yourWalletTokens.findIndex(
      (token) =>
        normalizeAddress(
          token.address,
          token.chainData?.type ?? token.chainData?.chainType
        ) ===
        normalizeAddress(selectedToken?.address ?? "", selectedTokenChainType)
    );

    const baseTokens =
      index === -1
        ? [
            ...yourWalletTokens,
            ...(selectedToken ? [selectedToken as YourTokenData] : []),
          ]
        : [
            ...yourWalletTokens.slice(index),
            ...yourWalletTokens.slice(0, index),
          ];

    const normalizedTokens = baseTokens.filter(
      (token) => !!token && token.balance != null && token.decimals != null
    );

    if (!amount.trim()) return normalizedTokens;

    const parsedAmount = Number(amount.trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return normalizedTokens;
    }

    const result =
      amountInputMode === "usd"
        ? filterUsdCompatibleTokens(normalizedTokens, parsedAmount)
        : filterTokenAmountCompatibleTokens(normalizedTokens, parsedAmount);

    const selectedTokenExists = result.find(
      (token) =>
        token.symbol?.toLowerCase() === selectedToken?.symbol?.toLowerCase() &&
        token.chainData?.chainId.toString() ===
          (selectedToken as YourTokenData)?.chainData?.chainId.toString()
    );

    if (!selectedTokenExists && selectedToken) {
      return [
        selectedToken as YourTokenData,
        ...result.filter(
          (token) =>
            !(
              token.symbol?.toLowerCase() ===
                selectedToken.symbol?.toLowerCase() &&
              token.chainData?.chainId.toString() ===
                (selectedToken as YourTokenData)?.chainData?.chainId.toString()
            )
        ),
      ];
    }

    return result;
  }, [amount, amountInputMode, selectedToken, yourWalletTokens]);

  return {
    handleTokenChange,
    orderedTokens,
  };
}

function filterUsdCompatibleTokens(
  tokens: YourTokenData[],
  parsedAmount: number
) {
  const filteredTokens = tokens.filter((token) => {
    const tokenPriceUSD =
      typeof token.usdPrice === "number" &&
      Number.isFinite(token.usdPrice) &&
      token.usdPrice > 0
        ? token.usdPrice
        : 0;

    if (tokenPriceUSD <= 0) return false;

    const tokenBalance = Number(
      formatTokenBalance(token.balance, token.decimals)
    );
    const tokenUsdBalance = tokenBalance * tokenPriceUSD;

    return Number.isFinite(tokenUsdBalance) && tokenUsdBalance >= parsedAmount;
  });

  return filteredTokens.length > 0
    ? filteredTokens
    : tokens.filter(
        (token) => Number(formatTokenBalance(token.balance, token.decimals)) > 0
      );
}

function filterTokenAmountCompatibleTokens(
  tokens: YourTokenData[],
  parsedAmount: number
) {
  const filteredTokens = tokens.filter((token) => {
    const tokenBalance = Number(
      formatTokenBalance(token.balance, token.decimals)
    );
    return Number.isFinite(tokenBalance) && tokenBalance >= parsedAmount;
  });

  return filteredTokens.length > 0
    ? filteredTokens
    : tokens.filter(
        (token) => Number(formatTokenBalance(token.balance, token.decimals)) > 0
      );
}
