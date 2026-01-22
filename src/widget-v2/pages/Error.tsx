import React, { useMemo, useEffect } from "react";
import { cn } from "../lib/utils";
import { useDeposit } from "../context/DepositContext";
import { TrustwareConfigStore } from "../../config/store";

export interface ErrorProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Error type categories for determining recovery options
 */
type ErrorCategory =
  | "wallet_rejected"
  | "insufficient_funds"
  | "network_error"
  | "route_error"
  | "transaction_failed"
  | "timeout"
  | "unknown";

/**
 * Maps error messages to categories for recovery flow
 */
function categorizeError(errorMessage: string | null): ErrorCategory {
  if (!errorMessage) return "unknown";

  const msg = errorMessage.toLowerCase();

  // User rejected transaction in wallet
  if (
    msg.includes("rejected") ||
    msg.includes("denied") ||
    msg.includes("cancelled") ||
    msg.includes("canceled")
  ) {
    return "wallet_rejected";
  }

  // Insufficient funds/balance
  if (
    msg.includes("insufficient") ||
    msg.includes("balance") ||
    msg.includes("not enough")
  ) {
    return "insufficient_funds";
  }

  // Network connectivity issues
  if (
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("fetch") ||
    msg.includes("rpc")
  ) {
    return "network_error";
  }

  // Route building errors (liquidity, slippage, unsupported)
  if (
    msg.includes("liquidity") ||
    msg.includes("slippage") ||
    msg.includes("route") ||
    msg.includes("not supported") ||
    msg.includes("price impact")
  ) {
    return "route_error";
  }

  // Transaction execution failures
  if (
    msg.includes("failed") ||
    msg.includes("reverted") ||
    msg.includes("gas")
  ) {
    return "transaction_failed";
  }

  // Timeout errors
  if (
    msg.includes("timeout") ||
    msg.includes("taking longer") ||
    msg.includes("expired")
  ) {
    return "timeout";
  }

  return "unknown";
}

/**
 * Gets user-friendly title based on error category
 */
function getErrorTitle(category: ErrorCategory): string {
  switch (category) {
    case "wallet_rejected":
      return "Transaction Cancelled";
    case "insufficient_funds":
      return "Insufficient Balance";
    case "network_error":
      return "Connection Error";
    case "route_error":
      return "Route Unavailable";
    case "transaction_failed":
      return "Transaction Failed";
    case "timeout":
      return "Request Timeout";
    default:
      return "Something Went Wrong";
  }
}

/**
 * Gets helpful suggestion text based on error category
 */
function getErrorSuggestion(category: ErrorCategory): string {
  switch (category) {
    case "wallet_rejected":
      return "You can try again when you're ready to approve the transaction.";
    case "insufficient_funds":
      return "Please ensure you have enough tokens and native currency for gas fees.";
    case "network_error":
      return "Please check your internet connection and try again.";
    case "route_error":
      return "Try a different amount or token combination.";
    case "transaction_failed":
      return "The transaction couldn't be completed. You can try again with a different amount.";
    case "timeout":
      return "Check your wallet or block explorer to verify the transaction status.";
    default:
      return "Please try again or contact support if the issue persists.";
  }
}

/**
 * Determines which step to return to based on error category
 */
function getRetryStep(
  category: ErrorCategory
): "home" | "select-token" | "crypto-pay" {
  switch (category) {
    case "wallet_rejected":
      // User just needs to approve again
      return "crypto-pay";
    case "insufficient_funds":
      // May need to change amount or token
      return "home";
    case "network_error":
      // Retry from where they were
      return "crypto-pay";
    case "route_error":
      // Need to select different token/chain/amount
      return "select-token";
    case "transaction_failed":
      // May need to adjust parameters
      return "crypto-pay";
    case "timeout":
      // Start fresh
      return "home";
    default:
      return "home";
  }
}

/**
 * Error page component.
 * Displays user-friendly error messages with appropriate recovery options.
 */
export function Error({ className }: ErrorProps): React.ReactElement {
  const {
    errorMessage,
    setCurrentStep,
    setTransactionStatus,
    setErrorMessage,
    transactionHash,
    selectedChain,
    resetState,
  } = useDeposit();

  // Categorize the error for appropriate handling
  const errorCategory = useMemo(
    () => categorizeError(errorMessage),
    [errorMessage]
  );

  const errorTitle = useMemo(
    () => getErrorTitle(errorCategory),
    [errorCategory]
  );

  const errorSuggestion = useMemo(
    () => getErrorSuggestion(errorCategory),
    [errorCategory]
  );

  const retryStep = useMemo(() => getRetryStep(errorCategory), [errorCategory]);

  // Log error via SDK callback if configured
  useEffect(() => {
    if (errorMessage) {
      try {
        const config = TrustwareConfigStore.get();
        // Check for rate limit callback as a proxy for error logging
        // This notifies the host app of issues
        if (
          config.retry?.onRateLimited &&
          errorMessage.includes("rate limit")
        ) {
          config.retry.onRateLimited(
            { limit: 0, remaining: 0, reset: Date.now() + 60000 },
            0
          );
        }
      } catch {
        // Config may not be initialized, ignore
      }

      // Also log to console for debugging
      console.error("[TrustwareWidget] Error:", errorMessage);
    }
  }, [errorMessage]);

  /**
   * Handle Try Again button click
   * Routes to appropriate step based on error category
   */
  const handleTryAgain = () => {
    // Clear the error state
    setErrorMessage(null);
    setTransactionStatus("idle");

    // Navigate to the appropriate step for recovery
    setCurrentStep(retryStep);
  };

  /**
   * Handle Start Over button click
   * Completely resets the flow
   */
  const handleStartOver = () => {
    resetState();
  };

  // Get block explorer URL if we have a transaction hash
  const explorerUrl = useMemo(() => {
    if (transactionHash && selectedChain?.explorerUrl) {
      return `${selectedChain.explorerUrl}/tx/${transactionHash}`;
    }
    return null;
  }, [transactionHash, selectedChain]);

  return (
    <div className={cn("tw-flex tw-flex-col tw-min-h-[500px]", className)}>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-center tw-px-4 tw-py-4 tw-border-b tw-border-border">
        <h1 className="tw-text-lg tw-font-semibold tw-text-foreground">
          {errorTitle}
        </h1>
      </div>

      {/* Content */}
      <div className="tw-flex-1 tw-flex tw-flex-col tw-items-center tw-justify-center tw-px-6 tw-py-8">
        {/* Error Icon */}
        <div className="tw-w-20 tw-h-20 tw-rounded-full tw-bg-red-500/10 tw-flex tw-items-center tw-justify-center tw-mb-6">
          {errorCategory === "wallet_rejected" ? (
            // X icon for user rejection
            <svg
              className="tw-w-10 tw-h-10 tw-text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : errorCategory === "network_error" ? (
            // Wifi off icon for network errors
            <svg
              className="tw-w-10 tw-h-10 tw-text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01M3.293 7.293a14.962 14.962 0 0117.414 0M1 1l22 22"
              />
            </svg>
          ) : (
            // Warning triangle for other errors
            <svg
              className="tw-w-10 tw-h-10 tw-text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>

        {/* Error Message */}
        <h2 className="tw-text-2xl tw-font-bold tw-text-foreground tw-text-center tw-mb-2">
          {errorTitle}
        </h2>

        {/* Error Details */}
        {errorMessage && (
          <p className="tw-text-muted-foreground tw-text-center tw-mb-4 tw-max-w-xs">
            {errorMessage}
          </p>
        )}

        {/* Suggestion */}
        <p className="tw-text-sm tw-text-muted-foreground tw-text-center tw-mb-6 tw-max-w-xs">
          {errorSuggestion}
        </p>

        {/* Transaction Hash Link (if available) */}
        {explorerUrl && (
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-1 tw-mb-6">
            <span className="tw-text-sm tw-text-muted-foreground">
              Transaction ID
            </span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tw-flex tw-items-center tw-gap-1.5 tw-text-primary hover:tw-underline"
            >
              <span className="tw-font-mono tw-text-sm">
                {transactionHash!.slice(0, 8)}...{transactionHash!.slice(-6)}
              </span>
              <svg
                className="tw-w-3.5 tw-h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div className="tw-flex tw-flex-col tw-gap-3 tw-w-full tw-max-w-xs">
          {/* Try Again Button */}
          <button
            type="button"
            onClick={handleTryAgain}
            className="tw-w-full tw-py-3 tw-px-6 tw-rounded-xl tw-bg-primary tw-text-primary-foreground tw-font-semibold tw-text-base hover:tw-bg-primary/90 tw-transition-colors tw-border-0 tw-cursor-pointer"
          >
            Try Again
          </button>

          {/* Start Over Button (secondary) */}
          <button
            type="button"
            onClick={handleStartOver}
            className="tw-w-full tw-py-3 tw-px-6 tw-rounded-xl tw-bg-transparent tw-text-muted-foreground tw-font-medium tw-text-base hover:tw-bg-muted/50 tw-transition-colors tw-border tw-border-border tw-cursor-pointer"
          >
            Start Over
          </button>
        </div>
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
            aria-hidden="true"
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

export default Error;
