import { useEffect, useMemo } from "react";

import { getUsdAmountRangeError, sanitizeAmountInput } from "../../../hooks";

type UseHomeAmountModelArgs = {
  amount: string;
  setAmount: (amount: string) => void;
  amountInputMode: "usd" | "token";
  setAmountInputMode: React.Dispatch<React.SetStateAction<"usd" | "token">>;
  fixedFromAmountString?: string | null;
  isFixedAmount: boolean;
  minAmountUsd?: number | null;
  maxAmountUsd?: number | null;
};

export function useHomeAmountModel({
  amount,
  setAmount,
  amountInputMode,
  setAmountInputMode,
  fixedFromAmountString,
  isFixedAmount,
  minAmountUsd,
  maxAmountUsd,
}: UseHomeAmountModelArgs) {
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

  const parsedAmount = parseFloat(fixedFromAmountString ?? amount) || 0;

  const amountValidationMessage = useMemo(() => {
    const rawAmount = (fixedFromAmountString ?? amount)?.trim();
    if (!rawAmount) return null;
    if (!/^\d*\.?\d*$/.test(rawAmount)) {
      return "Use numbers only for amount.";
    }
    const parsed = Number(rawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "Enter an amount greater than 0.";
    }
    return getUsdAmountRangeError(
      parsed,
      minAmountUsd ?? undefined,
      maxAmountUsd ?? undefined
    );
  }, [amount, fixedFromAmountString, minAmountUsd, maxAmountUsd]);

  const handleAmountChange = (raw: string) => {
    if (isFixedAmount) return;
    if (amountInputMode !== "usd") setAmountInputMode("usd");
    setAmount(sanitizeAmountInput(raw));
  };

  return {
    amountValidationMessage,
    handleAmountChange,
    parsedAmount,
  };
}
