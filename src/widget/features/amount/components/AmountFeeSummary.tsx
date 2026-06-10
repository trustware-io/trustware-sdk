import type React from "react";

import { weiToDecimalString } from "../../../../utils";
import { colors, fontSize, fontWeight, spacing } from "../../../styles";
import {
  emptyFeeSummaryStyle,
  feeSummaryContainerStyle,
  feeSummaryDividerStyle,
  feeSummaryRowStyle,
  feeSummaryValueStyle,
  loadingFeeSummaryStyle,
} from "./cryptoPayAmountStyles";

export interface AmountFeeSummaryProps {
  amount: string;
  estimatedReceive?: string | null;
  gasReservationWei: bigint;
  isGasSponsored?: boolean;
  isLoadingRoute: boolean;
  parsedAmount: number;
  relayFeeUsd?: number;
  selectedTokenDecimals?: number;
}

function formatEstimatedReceive(
  estimatedReceive: string | null | undefined,
  parsedAmount: number
): string {
  if (estimatedReceive) {
    return `~$${parseFloat(estimatedReceive).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (parsedAmount > 0) {
    return `~$${(parsedAmount * 0.99).toFixed(2)}`;
  }

  return "—";
}

export function AmountFeeSummary({
  amount,
  estimatedReceive,
  gasReservationWei,
  isGasSponsored,
  isLoadingRoute,
  parsedAmount,
  relayFeeUsd,
  selectedTokenDecimals,
}: AmountFeeSummaryProps): React.ReactElement {
  return (
    <div style={feeSummaryContainerStyle}>
      {isLoadingRoute ? (
        <div style={loadingFeeSummaryStyle}>
          <svg
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: colors.mutedForeground,
            }}
            viewBox="0 0 24 24"
            fill="none"
            className="tw-animate-spin"
          >
            <circle
              style={{ opacity: 0.25 }}
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              style={{ opacity: 0.75 }}
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span
            style={{
              marginLeft: spacing[2],
              fontSize: fontSize.sm,
              color: colors.mutedForeground,
            }}
          >
            Calculating fees...
          </span>
        </div>
      ) : !amount.trim() ? (
        <div style={emptyFeeSummaryStyle}>
          <p
            style={{
              fontSize: fontSize.base,
              color: colors.mutedForeground,
            }}
          >
            Enter an amount to continue.
          </p>
        </div>
      ) : (
        <>
          <div style={feeSummaryRowStyle}>
            <span style={{ color: colors.mutedForeground }}>Network fee</span>
            {isGasSponsored ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.green[500],
                  background: `${colors.green[500]}1a`,
                  borderRadius: "9999px",
                  padding: "0.1rem 0.5rem",
                }}
              >
                ✦ Gas sponsored
              </span>
            ) : (
              <span style={feeSummaryValueStyle}>
                {weiToDecimalString(
                  gasReservationWei,
                  selectedTokenDecimals ?? 0,
                  6
                )}
              </span>
            )}
          </div>

          {relayFeeUsd != null && relayFeeUsd > 0 && (
            <>
              <div style={feeSummaryDividerStyle} />
              <div style={feeSummaryRowStyle}>
                <span style={{ color: colors.mutedForeground }}>
                  Bridge relay fee
                </span>
                <span
                  style={{
                    ...feeSummaryValueStyle,
                    color: colors.mutedForeground,
                  }}
                >
                  ~$
                  {relayFeeUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  reserved
                </span>
              </div>
            </>
          )}

          <div style={feeSummaryDividerStyle} />

          <div style={feeSummaryRowStyle}>
            <span
              style={{
                color: colors.mutedForeground,
                fontSize: fontSize.sm,
              }}
            >
              You&apos;ll receive
            </span>
            <span
              style={{
                fontWeight: fontWeight.semibold,
                color: colors.foreground,
              }}
            >
              {formatEstimatedReceive(estimatedReceive, parsedAmount)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
