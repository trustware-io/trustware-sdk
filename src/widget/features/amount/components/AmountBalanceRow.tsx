import type React from "react";

import { colors, fontSize, fontWeight, spacing } from "../../../styles";
import { balanceRowStyle, maxButtonStyle } from "./cryptoPayAmountStyles";

type AmountInputMode = "usd" | "token";

export interface AmountBalanceRowProps {
  amountInputMode: AmountInputMode;
  effectiveSliderMax?: number;
  handleSliderChange: (value: number) => void;
  hasUsdPrice: boolean;
  isFixedAmount: boolean;
  normalizedTokenBalance: number;
  selectedTokenSymbol: string;
  tokenPriceUSD: number;
}

function formatBalanceLabel({
  amountInputMode,
  hasUsdPrice,
  normalizedTokenBalance,
  selectedTokenSymbol,
  tokenPriceUSD,
}: Omit<
  AmountBalanceRowProps,
  "effectiveSliderMax" | "handleSliderChange" | "isFixedAmount"
>): string {
  if (amountInputMode === "usd" && hasUsdPrice) {
    return `Balance ($) ${(
      normalizedTokenBalance * tokenPriceUSD
    ).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `Balance (${selectedTokenSymbol}) ${normalizedTokenBalance.toLocaleString(
    undefined,
    {
      maximumFractionDigits: 6,
    }
  )}`;
}

export function AmountBalanceRow({
  amountInputMode,
  effectiveSliderMax,
  handleSliderChange,
  hasUsdPrice,
  isFixedAmount,
  normalizedTokenBalance,
  selectedTokenSymbol,
  tokenPriceUSD,
}: AmountBalanceRowProps): React.ReactElement {
  return (
    <div style={balanceRowStyle}>
      <span
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: colors.primary,
          marginTop: spacing[0],
        }}
      >
        {formatBalanceLabel({
          amountInputMode,
          hasUsdPrice,
          normalizedTokenBalance,
          selectedTokenSymbol,
          tokenPriceUSD,
        })}
      </span>
      <button
        type="button"
        onClick={() => handleSliderChange(effectiveSliderMax ?? 0)}
        disabled={isFixedAmount}
        style={maxButtonStyle(isFixedAmount)}
      >
        Max
      </button>
    </div>
  );
}
