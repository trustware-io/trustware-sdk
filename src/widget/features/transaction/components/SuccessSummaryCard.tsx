import React from "react";

import { TransactionHashLink } from "../../../components";
import { colors } from "../../../styles";

export interface SuccessSummaryCardProps {
  amount: number;
  explorerUrl?: string | null;
  onDone: () => void;
  selectedChainName?: string | null;
  selectedTokenIconUrl?: string | null;
  selectedTokenSymbol?: string | null;
  transactionHash?: string | null;
}

export function SuccessSummaryCard({
  amount,
  explorerUrl,
  onDone,
  selectedChainName,
  selectedTokenIconUrl,
  selectedTokenSymbol,
  transactionHash,
}: SuccessSummaryCardProps): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        animation: "fade-in 0.3s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            width: "5rem",
            height: "5rem",
            borderRadius: "2.5rem",
            backgroundColor: colors.green[500],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "scale-in 0.3s ease-out",
            marginBottom: "0.75rem",
          }}
        >
          <svg
            style={{
              width: "2.5rem",
              height: "2.5rem",
              color: colors.white,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: "bold",
            color: colors.foreground,
          }}
        >
          Success!
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            fontSize: "1.875rem",
            fontWeight: "bold",
            color: colors.foreground,
          }}
        >
          $
          {amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        {selectedTokenIconUrl && selectedTokenSymbol ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              marginTop: "0.375rem",
            }}
          >
            <img
              src={selectedTokenIconUrl}
              alt={selectedTokenSymbol}
              style={{
                width: "1rem",
                height: "1rem",
                borderRadius: "0.5rem",
              }}
            />
            <span
              style={{
                fontSize: "0.8rem",
                color: colors.mutedForeground,
              }}
            >
              {selectedTokenSymbol}
              {selectedChainName ? ` on ${selectedChainName}` : ""}
            </span>
          </div>
        ) : null}
      </div>

      {transactionHash ? (
        <div
          style={{
            marginBottom: "2rem",
          }}
        >
          <TransactionHashLink
            explorerUrl={explorerUrl}
            hash={transactionHash}
            label="Transaction ID"
          />
        </div>
      ) : null}

      <div
        style={{
          width: "100%",
          padding: "1rem",
        }}
      >
        <button
          type="button"
          onClick={onDone}
          style={{
            width: "100%",
            height: "3rem",
            borderRadius: "1.5rem",
            backgroundColor: colors.primary,
            transition: "background-color 0.3s ease-out",
            color: colors.primaryForeground,
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
