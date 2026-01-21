import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/utils";
import { useDeposit, type TransactionStatus } from "../context/DepositContext";
import { useTransactionPolling } from "../hooks/useTransactionPolling";
import { CircularProgress } from "../components/CircularProgress";
import { TransactionSteps } from "../components/TransactionSteps";

export interface ProcessingProps {
  /** Additional CSS classes */
  className?: string;
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

/**
 * Processing page component.
 * Displays real-time progress of a transaction based on actual status from the API.
 * Shows circular progress animation and step indicators.
 */
export function Processing({ className }: ProcessingProps): React.ReactElement {
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
      transactionHash: transactionHash ? transactionHash.slice(0, 10) + "..." : null,
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

  return (
    <div className={cn("tw-flex tw-flex-col tw-min-h-[500px]", className)}>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-4 tw-border-b tw-border-border">
        <div className="tw-w-10" />
        <h1 className="tw-text-lg tw-font-semibold tw-text-foreground">
          {transactionStatus === "success"
            ? "Complete"
            : transactionStatus === "error"
              ? "Failed"
              : "Processing"}
        </h1>
        <button
          type="button"
          onClick={handleClose}
          className="tw-w-10 tw-h-10 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-muted tw-transition-colors tw-border-0 tw-bg-transparent"
          aria-label="Close"
        >
          <svg
            className="tw-w-5 tw-h-5 tw-text-foreground"
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
      <div className="tw-flex-1 tw-flex tw-flex-col tw-items-center tw-justify-center tw-px-6 tw-py-8">
        {/* Progress Circle */}
        <div className="tw-mb-6">
          <CircularProgress
            progress={progress}
            size={120}
            strokeWidth={8}
            showPercentage={!isIndeterminate}
            isIndeterminate={isIndeterminate}
          />
        </div>

        {/* Current Step Text */}
        <p className="tw-text-lg tw-font-medium tw-text-foreground tw-text-center tw-mb-2">
          {stepText}
        </p>

        {/* Amount Display */}
        {selectedToken && parsedAmount > 0 && (
          <p className="tw-text-sm tw-text-muted-foreground tw-text-center tw-mb-6">
            ${parsedAmount.toFixed(2)} {selectedToken.symbol}
          </p>
        )}

        {/* Transaction Steps */}
        <TransactionSteps
          transactionStatus={transactionStatus}
          className="tw-w-full tw-max-w-xs tw-mb-6"
        />

        {/* Transaction Hash Link */}
        {transactionHash && (
          <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
            <span className="tw-text-muted-foreground">Transaction:</span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tw-flex tw-items-center tw-gap-1 tw-text-primary hover:tw-underline"
              >
                <span className="tw-font-mono">
                  {truncateHash(transactionHash)}
                </span>
                <svg
                  className="tw-w-3.5 tw-h-3.5"
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
              <span className="tw-font-mono tw-text-foreground">
                {truncateHash(transactionHash)}
              </span>
            )}
          </div>
        )}

        {/* Error State Action */}
        {transactionStatus === "error" && (
          <button
            type="button"
            onClick={handleViewError}
            className="tw-mt-4 tw-px-6 tw-py-2 tw-rounded-xl tw-bg-destructive tw-text-destructive-foreground tw-font-medium hover:tw-bg-destructive/90 tw-transition-colors tw-border-0"
          >
            View Details
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="tw-px-6 tw-py-4 tw-border-t tw-border-border/30">
        <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
          <svg
            className="tw-w-3.5 tw-h-3.5 tw-text-muted-foreground"
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
          <span className="tw-text-sm tw-text-muted-foreground">
            Secured by{" "}
            <span className="tw-font-semibold tw-text-foreground">
              Trustware
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Processing;
