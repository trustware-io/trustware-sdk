import React, { useEffect, useMemo, useRef } from "react";
import { mergeStyles } from "../lib/utils";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/tokens";
import { useDeposit, type TransactionStatus } from "../context/DepositContext";
import { useTransactionPolling } from "../hooks/useTransactionPolling";
import { CircularProgress } from "../components/CircularProgress";
import { TransactionSteps } from "../components/TransactionSteps";

export interface ProcessingProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * Maps transaction status to a progress percentage
 */
function getProgressFromStatus(status: TransactionStatus): number {
  switch (status) {
    case "confirming":
      return 15;
    case "processing":
      return 40;
    case "bridging":
      return 75;
    case "success":
      return 100;
    case "error":
      return 0;
    default:
      return 0;
  }
}

/**
 * Gets the step text to display based on transaction status
 */
function getStepText(status: TransactionStatus): string {
  switch (status) {
    case "confirming":
      return "Waiting for wallet confirmation...";
    case "processing":
      return "Processing transaction on network...";
    case "bridging":
      return "Bridging assets to destination chain...";
    case "success":
      return "Transaction complete!";
    case "error":
      return "Transaction failed";
    default:
      return "Initializing...";
  }
}

/**
 * Truncates a transaction hash for display
 */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

// Styles
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "500px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${spacing[4]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border}`,
};

const headerSpacerStyle: React.CSSProperties = {
  width: "2.5rem",
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: fontSize.lg,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};

const closeButtonStyle: React.CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  borderRadius: "9999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 0.2s",
  border: 0,
  backgroundColor: "transparent",
  cursor: "pointer",
};

const closeIconStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  color: colors.foreground,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: `${spacing[8]} ${spacing[6]}`,
};

const progressContainerStyle: React.CSSProperties = {
  marginBottom: spacing[6],
};

const stepTextStyle: React.CSSProperties = {
  fontSize: fontSize.lg,
  fontWeight: fontWeight.medium,
  color: colors.foreground,
  textAlign: "center",
  marginBottom: spacing[2],
};

const amountTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
  textAlign: "center",
  marginBottom: spacing[6],
};

const stepsContainerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "20rem",
  marginBottom: spacing[6],
};

const hashContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  fontSize: fontSize.sm,
};

const hashLabelStyle: React.CSSProperties = {
  color: colors.mutedForeground,
};

const hashLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  color: colors.primary,
  textDecoration: "none",
};

const hashTextStyle: React.CSSProperties = {
  fontFamily: "monospace",
};

const hashPlainStyle: React.CSSProperties = {
  fontFamily: "monospace",
  color: colors.foreground,
};

const externalIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
};

const errorButtonStyle: React.CSSProperties = {
  marginTop: spacing[4],
  padding: `${spacing[2]} ${spacing[6]}`,
  borderRadius: borderRadius.xl,
  backgroundColor: colors.destructive,
  color: colors.destructiveForeground,
  fontWeight: fontWeight.medium,
  transition: "background-color 0.2s",
  border: 0,
  cursor: "pointer",
};

const footerStyle: React.CSSProperties = {
  padding: `${spacing[4]} ${spacing[6]}`,
  borderTop: `1px solid rgba(63, 63, 70, 0.3)`,
};

const footerContentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
};

const lockIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
  color: colors.mutedForeground,
};

const footerTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

const footerBrandStyle: React.CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};

/**
 * Processing page component.
 * Displays real-time progress of a transaction based on actual status from the API.
 * Shows circular progress animation and step indicators.
 */
export function Processing({ style }: ProcessingProps): React.ReactElement {
  const {
    transactionStatus,
    transactionHash,
    selectedToken,
    selectedChain,
    amount,
    resetState,
    setCurrentStep,
    intentId,
  } = useDeposit();

  // Get transaction details from polling hook
  const { transaction, startPolling, isPolling } = useTransactionPolling();

  // Track if we've already started polling to avoid duplicate calls
  const hasStartedPolling = useRef(false);

  // Reset hasStartedPolling on unmount (needed for React StrictMode compatibility)
  useEffect(() => {
    return () => {
      hasStartedPolling.current = false;
    };
  }, []);

  // Start polling when we have intentId and transactionHash
  useEffect(() => {
    console.log("[TW Processing] useEffect check:", {
      intentId,
      transactionHash: transactionHash
        ? transactionHash.slice(0, 10) + "..."
        : null,
      isPolling,
      hasStartedPolling: hasStartedPolling.current,
      transactionStatus,
    });

    if (
      intentId &&
      transactionHash &&
      !isPolling &&
      !hasStartedPolling.current &&
      transactionStatus !== "success" &&
      transactionStatus !== "error"
    ) {
      console.log("[TW Processing] Starting polling for intent:", intentId);
      hasStartedPolling.current = true;
      startPolling(intentId, transactionHash);
    }
  }, [intentId, transactionHash, isPolling, transactionStatus, startPolling]);

  // Calculate progress based on actual status
  const progress = useMemo(
    () => getProgressFromStatus(transactionStatus),
    [transactionStatus]
  );

  // Get current step text
  const stepText = useMemo(
    () => getStepText(transactionStatus),
    [transactionStatus]
  );

  // Get block explorer URL from transaction data or construct fallback
  const explorerUrl = useMemo(() => {
    // Prefer the URL from the API response
    if (transaction?.fromChainTxUrl) {
      return transaction.fromChainTxUrl;
    }
    // Fallback: construct URL based on chain if we have a hash
    if (transactionHash && selectedChain?.explorerUrl) {
      return `${selectedChain.explorerUrl}/tx/${transactionHash}`;
    }
    return null;
  }, [transaction, transactionHash, selectedChain]);

  // Parse amount for display
  const parsedAmount = parseFloat(amount) || 0;

  /**
   * Handle close/done button click
   */
  const handleClose = () => {
    resetState();
  };

  /**
   * Navigate to error page if transaction failed
   */
  const handleViewError = () => {
    setCurrentStep("error");
  };

  // Determine if we should show indeterminate spinner
  const isIndeterminate =
    transactionStatus === "confirming" || transactionStatus === "idle";

  // Determine header title based on status
  const headerTitle =
    transactionStatus === "success"
      ? "Complete"
      : transactionStatus === "error"
        ? "Failed"
        : "Processing";

  return (
    <div style={mergeStyles(containerStyle, style)}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerSpacerStyle} />
        <h1 style={headerTitleStyle}>{headerTitle}</h1>
        <button
          type="button"
          onClick={handleClose}
          style={closeButtonStyle}
          aria-label="Close"
        >
          <svg
            style={closeIconStyle}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {/* Progress Circle */}
        <div style={progressContainerStyle}>
          <CircularProgress
            progress={progress}
            size={120}
            strokeWidth={8}
            showPercentage={!isIndeterminate}
            isIndeterminate={isIndeterminate}
          />
        </div>

        {/* Current Step Text */}
        <p style={stepTextStyle}>{stepText}</p>

        {/* Amount Display */}
        {selectedToken && parsedAmount > 0 && (
          <p style={amountTextStyle}>
            ${parsedAmount.toFixed(2)} {selectedToken.symbol}
          </p>
        )}

        {/* Transaction Steps */}
        <TransactionSteps
          transactionStatus={transactionStatus}
          style={stepsContainerStyle}
        />

        {/* Transaction Hash Link */}
        {transactionHash && (
          <div style={hashContainerStyle}>
            <span style={hashLabelStyle}>Transaction:</span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={hashLinkStyle}
              >
                <span style={hashTextStyle}>
                  {truncateHash(transactionHash)}
                </span>
                <svg
                  style={externalIconStyle}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ) : (
              <span style={hashPlainStyle}>{truncateHash(transactionHash)}</span>
            )}
          </div>
        )}

        {/* Error State Action */}
        {transactionStatus === "error" && (
          <button type="button" onClick={handleViewError} style={errorButtonStyle}>
            View Details
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <div style={footerContentStyle}>
          <svg
            style={lockIconStyle}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span style={footerTextStyle}>
            Secured by <span style={footerBrandStyle}>Trustware</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Processing;
