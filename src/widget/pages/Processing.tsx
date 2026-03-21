import React, { useEffect, useMemo, useRef } from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositTransaction,
  type TransactionStatus,
} from "../context/DepositContext";
import {
  CircularProgress,
  TransactionHashLink,
  TransactionSteps,
  WidgetPageHeader,
  WidgetSecurityFooter,
} from "../components";
import { useTransactionPolling } from "../features/transaction";

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
 * Processing page component.
 * Displays real-time progress of a transaction based on actual status from the API.
 * Shows circular progress animation and step indicators.
 */
export function Processing({ style }: ProcessingProps): React.ReactElement {
  const { selectedToken, selectedChain, amount } = useDepositForm();
  const { resetState, setCurrentStep } = useDepositNavigation();
  const { transactionStatus, transactionHash, intentId } =
    useDepositTransaction();

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
    if (
      intentId &&
      transactionHash &&
      !isPolling &&
      !hasStartedPolling.current &&
      transactionStatus !== "success" &&
      transactionStatus !== "error"
    ) {
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
    if (transactionHash && selectedChain?.blockExplorerUrls?.length) {
      return `${selectedChain.blockExplorerUrls[0].replace(/\/+$/, "")}/tx/${transactionHash}`;
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        ...style,
      }}
    >
      <WidgetPageHeader onClose={handleClose} title={headerTitle} />

      {/* Content */}
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
        {/* Progress Circle */}
        <div
          style={{
            marginBottom: spacing[6],
          }}
        >
          <CircularProgress
            progress={progress}
            size={120}
            strokeWidth={8}
            showPercentage={!isIndeterminate}
            isIndeterminate={isIndeterminate}
          />
        </div>

        {/* Current Step Text */}
        <p
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.medium,
            color: colors.foreground,
            textAlign: "center",
            marginBottom: spacing[2],
          }}
        >
          {stepText}
        </p>

        {/* Amount Display */}
        {selectedToken && parsedAmount > 0 && (
          <p
            style={{
              fontSize: fontSize.sm,
              color: colors.mutedForeground,
              textAlign: "center",
              marginBottom: spacing[6],
            }}
          >
            ${parsedAmount.toFixed(2)} {selectedToken.symbol}
          </p>
        )}

        {/* Transaction Steps */}
        <TransactionSteps
          transactionStatus={transactionStatus}
          style={{
            width: "100%",
            maxWidth: "20rem",
            marginBottom: spacing[6],
          }}
        />

        {/* Transaction Hash Link */}
        {transactionHash ? (
          <TransactionHashLink
            explorerUrl={explorerUrl}
            hash={transactionHash}
            label="Transaction"
          />
        ) : null}

        {/* Error State Action */}
        {transactionStatus === "error" && (
          <button
            type="button"
            onClick={handleViewError}
            style={{
              marginTop: spacing[4],
              padding: `${spacing[2]} ${spacing[6]}`,
              borderRadius: borderRadius.xl,
              backgroundColor: colors.destructive,
              color: colors.destructiveForeground,
              fontWeight: fontWeight.medium,
              transition: "background-color 0.2s",
              border: 0,
              cursor: "pointer",
            }}
          >
            View Details
          </button>
        )}
      </div>

      <WidgetSecurityFooter />
    </div>
  );
}

export default Processing;
