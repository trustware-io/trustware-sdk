import { useEffect, useMemo } from "react";

import type { Token, YourTokenData } from "../../../context/DepositContext";
import { getUsdAmountRangeError } from "../../../hooks";
import { decimalToRaw, rawToDecimal } from "../../../helpers/tokenAmount";

const BALANCE_TOLERANCE = 1e-9;

type UseDepositAmountModelArgs = {
  amount: string;
  setAmount: (amount: string) => void;
  amountInputMode: "usd" | "token";
  setAmountInputMode: React.Dispatch<React.SetStateAction<"usd" | "token">>;
  fixedFromAmountString?: string | null;
  isReady: boolean | undefined;
  selectedToken: Token | YourTokenData | null;
  minAmountUsd?: number | null;
  maxAmountUsd?: number | null;
};

type AmountComputation = {
  fromAmountWei: bigint | null;
  tokenAmount: string | null;
  usdAmount: string | null | undefined;
  parseError: string | null;
};

export function useDepositAmountModel({
  amount,
  setAmount,
  amountInputMode,
  setAmountInputMode,
  fixedFromAmountString,
  isReady,
  selectedToken,
  minAmountUsd,
  maxAmountUsd,
}: UseDepositAmountModelArgs) {
  const tokenPriceUSD =
    typeof selectedToken?.usdPrice === "number" &&
    Number.isFinite(selectedToken.usdPrice) &&
    selectedToken.usdPrice > 0
      ? selectedToken.usdPrice
      : 0;

  const hasUsdPrice =
    typeof tokenPriceUSD === "number" &&
    Number.isFinite(tokenPriceUSD) &&
    tokenPriceUSD > 0;

  const normalizedTokenBalance = useMemo(() => {
    if (!selectedToken?.balance) return 0;
    const normalized = Number(
      rawToDecimal(selectedToken.balance, selectedToken.decimals ?? 18)
    );
    return Number.isFinite(normalized) ? normalized : 0;
  }, [selectedToken?.balance, selectedToken?.decimals]);

  useEffect(() => {
    if (fixedFromAmountString) return;
    if (isReady && !hasUsdPrice && amountInputMode === "usd") {
      setAmountInputMode("token");
    }
  }, [
    amountInputMode,
    fixedFromAmountString,
    hasUsdPrice,
    isReady,
    setAmountInputMode,
  ]);

  useEffect(() => {
    if (!fixedFromAmountString) return;
    if (amount !== fixedFromAmountString) {
      setAmount(fixedFromAmountString);
    }
    if (amountInputMode !== "usd") {
      setAmountInputMode("usd");
    }
  }, [
    amount,
    amountInputMode,
    fixedFromAmountString,
    setAmount,
    setAmountInputMode,
  ]);

  const amountComputation = useMemo<AmountComputation>(() => {
    const rawAmount = (fixedFromAmountString ?? amount)?.trim();
    if (!rawAmount) {
      return {
        fromAmountWei: null,
        tokenAmount: null,
        usdAmount: null,
        parseError: "Enter an amount greater than 0.",
      };
    }

    if (!/^\d*\.?\d*$/.test(rawAmount)) {
      return {
        fromAmountWei: null,
        tokenAmount: null,
        usdAmount: null,
        parseError: "Use numbers only for amount.",
      };
    }

    const tokenDecimals = selectedToken?.decimals ?? 18;
    const parsedAmount = Number(rawAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return {
        fromAmountWei: null,
        tokenAmount: null,
        usdAmount: null,
        parseError: "Enter an amount greater than 0.",
      };
    }

    if (amountInputMode === "usd") {
      if (!hasUsdPrice) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: rawAmount,
          parseError:
            "USD pricing is unavailable for this token. Switch to token amount mode.",
        };
      }

      const tokenUnits = parsedAmount / tokenPriceUSD;
      if (!Number.isFinite(tokenUnits) || tokenUnits <= 0) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: rawAmount,
          parseError: "Unable to convert USD to token amount.",
        };
      }

      return {
        fromAmountWei: BigInt(decimalToRaw(String(tokenUnits), tokenDecimals)),
        tokenAmount: String(tokenUnits),
        usdAmount: rawAmount,
        parseError: null,
      };
    }

    return {
      fromAmountWei: BigInt(decimalToRaw(rawAmount, tokenDecimals)),
      tokenAmount: rawAmount,
      usdAmount: hasUsdPrice ? String(parsedAmount * tokenPriceUSD) : undefined,
      parseError: null,
    };
  }, [
    amount,
    amountInputMode,
    fixedFromAmountString,
    hasUsdPrice,
    selectedToken?.decimals,
    tokenPriceUSD,
  ]);

  const requestedTokenAmount = useMemo(() => {
    const tokenAmount = Number(amountComputation.tokenAmount);
    return Number.isFinite(tokenAmount) ? tokenAmount : 0;
  }, [amountComputation.tokenAmount]);

  const amountValidationError = useMemo(() => {
    if (amountComputation.parseError) {
      return amountComputation.parseError;
    }

    if (
      requestedTokenAmount > 0 &&
      requestedTokenAmount - normalizedTokenBalance > BALANCE_TOLERANCE
    ) {
      return `Balance: ${normalizedTokenBalance.toLocaleString(undefined, {
        maximumFractionDigits: 6,
      })} ${selectedToken?.symbol ?? ""}`.trim();
    }

    const usdAmount = Number(amountComputation.usdAmount);
    if ((minAmountUsd != null || maxAmountUsd != null) && !hasUsdPrice) {
      return "USD pricing is unavailable, so min/max limits cannot be validated for this token.";
    }

    if (Number.isFinite(usdAmount) && usdAmount > 0) {
      return getUsdAmountRangeError(
        usdAmount,
        minAmountUsd ?? undefined,
        maxAmountUsd ?? undefined
      );
    }

    return null;
  }, [
    amountComputation.parseError,
    amountComputation.usdAmount,
    hasUsdPrice,
    maxAmountUsd,
    minAmountUsd,
    normalizedTokenBalance,
    requestedTokenAmount,
    selectedToken?.symbol,
  ]);

  const amountWei = amountValidationError
    ? 0n
    : (amountComputation.fromAmountWei ?? 0n);

  const parsedAmount = parseFloat(fixedFromAmountString ?? amount) || 0;

  const maxTokenAmount = useMemo(
    () => Math.min(normalizedTokenBalance, 10000),
    [normalizedTokenBalance]
  );

  const maxUsdAmount = useMemo(() => {
    if (!hasUsdPrice) return undefined;
    return Math.min(maxTokenAmount * tokenPriceUSD, 10000);
  }, [hasUsdPrice, maxTokenAmount, tokenPriceUSD]);

  const minAmountForMode = useMemo(() => {
    if (minAmountUsd == null) return 0;
    if (amountInputMode === "usd") {
      return minAmountUsd;
    }
    if (!hasUsdPrice || tokenPriceUSD <= 0) return 0;
    return minAmountUsd / tokenPriceUSD;
  }, [amountInputMode, hasUsdPrice, minAmountUsd, tokenPriceUSD]);

  const sliderMax = amountInputMode === "usd" ? maxUsdAmount : maxTokenAmount;

  const effectiveSliderMax = useMemo(() => {
    if (sliderMax == null || !Number.isFinite(sliderMax)) return undefined;
    return Math.max(sliderMax, 0);
  }, [sliderMax]);

  const effectiveSliderMin = useMemo(() => {
    if (
      effectiveSliderMax == null ||
      !Number.isFinite(effectiveSliderMax) ||
      effectiveSliderMax <= 0
    ) {
      return 0;
    }

    if (minAmountForMode > 0 && minAmountForMode < effectiveSliderMax) {
      return minAmountForMode;
    }

    return 0;
  }, [effectiveSliderMax, minAmountForMode]);

  return {
    amountComputation,
    amountValidationError,
    amountWei,
    effectiveSliderMax,
    effectiveSliderMin,
    hasUsdPrice,
    maxTokenAmount,
    maxUsdAmount,
    minAmountForMode,
    normalizedTokenBalance,
    parsedAmount,
    requestedTokenAmount,
    tokenPriceUSD,
  };
}
