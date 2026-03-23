import React, { useMemo, useEffect } from "react";
import { colors } from "../styles";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositTransaction,
} from "../context/DepositContext";
import { TrustwareConfigStore } from "../../config/store";
import { WidgetPageHeader, WidgetSecurityFooter } from "../components";
import { ErrorRecoveryCard } from "../features/transaction";

export interface ErrorProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
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
export function Error({ style }: ErrorProps): React.ReactElement {
  const { selectedChain } = useDepositForm();
  const { setCurrentStep, resetState } = useDepositNavigation();
  const {
    errorMessage,
    setTransactionStatus,
    setErrorMessage,
    transactionHash,
  } = useDepositTransaction();

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
    if (transactionHash && selectedChain?.blockExplorerUrls?.length) {
      return `${selectedChain.blockExplorerUrls[0].replace(/\/+$/, "")}/tx/${transactionHash}`;
    }
    return null;
  }, [transactionHash, selectedChain]);

  // Render appropriate icon based on error category
  const renderErrorIcon = () => {
    if (errorCategory === "wallet_rejected") {
      // X icon for user rejection
      return (
        <svg
          style={{
            width: "2.5rem",
            height: "2.5rem",
            color: colors.red[500],
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    }
    if (errorCategory === "network_error") {
      // Wifi off icon for network errors
      return (
        <svg
          style={{
            width: "2.5rem",
            height: "2.5rem",
            color: colors.red[500],
          }}
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
      );
    }
    // Warning triangle for other errors
    return (
      <svg
        style={{
          width: "2.5rem",
          height: "2.5rem",
          color: colors.red[500],
        }}
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
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        ...style,
      }}
    >
      <WidgetPageHeader title={errorTitle} />

      <ErrorRecoveryCard
        errorMessage={errorMessage}
        errorSuggestion={errorSuggestion}
        errorTitle={errorTitle}
        explorerUrl={explorerUrl}
        onStartOver={handleStartOver}
        onTryAgain={handleTryAgain}
        renderErrorIcon={renderErrorIcon}
        transactionHash={transactionHash}
      />

      <WidgetSecurityFooter />
    </div>
  );
}

export default Error;
