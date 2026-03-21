import type React from "react";

import { colors, fontSize } from "../../../styles";
import { tokenConversionRowStyle } from "./cryptoPayAmountStyles";

type AmountInputMode = "usd" | "token";

type AmountComputationLike = {
  tokenAmount?: number | string | null;
  usdAmount?: number | string | null;
};

export interface AmountConversionRowProps {
  amountComputation: AmountComputationLike;
  amountInputMode: AmountInputMode;
  hasUsdPrice: boolean;
  isFixedAmount: boolean;
  selectedTokenSymbol?: string;
  setAmountInputMode: React.Dispatch<React.SetStateAction<AmountInputMode>>;
}

function formatTokenAmount(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (amount <= 0) return "0";

  return parseFloat(String(value ?? 0)).toLocaleString(undefined, {
    maximumFractionDigits: 5,
  });
}

function formatUsdAmount(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (amount <= 0) return "USD pricing unavailable";

  return `$${parseFloat(String(value ?? 0)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AmountConversionRow({
  amountComputation,
  amountInputMode,
  hasUsdPrice,
  isFixedAmount,
  selectedTokenSymbol,
  setAmountInputMode,
}: AmountConversionRowProps): React.ReactElement {
  return (
    <div style={tokenConversionRowStyle}>
      <span
        style={{
          fontSize: fontSize.lg,
          color: colors.mutedForeground,
        }}
      >
        {amountInputMode === "usd" ? (
          <>
            {formatTokenAmount(amountComputation.tokenAmount)}{" "}
            {selectedTokenSymbol}
          </>
        ) : (
          <>
            {hasUsdPrice
              ? formatUsdAmount(amountComputation.usdAmount)
              : "USD pricing unavailable"}
          </>
        )}
      </span>
      <svg
        style={{
          width: "1rem",
          height: "1rem",
          color: colors.mutedForeground,
          cursor: isFixedAmount ? "not-allowed" : "pointer",
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        onClick={() => {
          if (isFixedAmount) return;
          setAmountInputMode((mode) => (mode === "usd" ? "token" : "usd"));
        }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    </div>
  );
}
