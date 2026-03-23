import React from "react";

import { TransactionHashLink } from "../../../components";
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from "../../../styles";

export interface ErrorRecoveryCardProps {
  errorMessage?: string | null;
  errorSuggestion: string;
  errorTitle: string;
  explorerUrl?: string | null;
  onStartOver: () => void;
  onTryAgain: () => void;
  renderErrorIcon: () => React.ReactNode;
  transactionHash?: string | null;
}

export function ErrorRecoveryCard({
  errorMessage,
  errorSuggestion,
  errorTitle,
  explorerUrl,
  onStartOver,
  onTryAgain,
  renderErrorIcon,
  transactionHash,
}: ErrorRecoveryCardProps): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${spacing[8]} ${spacing[6]}`,
      }}
    >
      <div
        style={{
          width: "5rem",
          height: "5rem",
          borderRadius: "9999px",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing[6],
        }}
      >
        {renderErrorIcon()}
      </div>

      <h2
        style={{
          fontSize: fontSize["2xl"],
          fontWeight: fontWeight.bold,
          color: colors.foreground,
          textAlign: "center",
          marginBottom: spacing[2],
        }}
      >
        {errorTitle}
      </h2>

      {errorMessage ? (
        <p
          style={{
            color: colors.mutedForeground,
            textAlign: "center",
            marginBottom: spacing[4],
            maxWidth: "20rem",
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      <p
        style={{
          fontSize: fontSize.sm,
          color: colors.mutedForeground,
          textAlign: "center",
          marginBottom: spacing[6],
          maxWidth: "20rem",
        }}
      >
        {errorSuggestion}
      </p>

      {explorerUrl && transactionHash ? (
        <div
          style={{
            marginBottom: spacing[6],
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
          display: "flex",
          flexDirection: "column",
          gap: spacing[3],
          width: "100%",
          maxWidth: "20rem",
        }}
      >
        <button
          type="button"
          onClick={onTryAgain}
          style={{
            width: "100%",
            padding: `${spacing[3]} ${spacing[6]}`,
            borderRadius: borderRadius.xl,
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.base,
            transition: "background-color 0.2s",
            border: 0,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>

        <button
          type="button"
          onClick={onStartOver}
          style={{
            width: "100%",
            padding: `${spacing[3]} ${spacing[6]}`,
            borderRadius: borderRadius.xl,
            backgroundColor: "transparent",
            color: colors.mutedForeground,
            fontWeight: fontWeight.medium,
            fontSize: fontSize.base,
            transition: "background-color 0.2s",
            border: `1px solid ${colors.border}`,
            cursor: "pointer",
          }}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
