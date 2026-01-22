"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getStatus } from "../../core/routes";
import { useDeposit } from "../context/DepositContext";
import type { Transaction } from "../../types";

/**
 * Polling interval in milliseconds (3 seconds as per spec)
 */
const POLL_INTERVAL_MS = 3000;

/**
 * Timeout duration in milliseconds (5 minutes as per spec)
 */
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Transaction polling state
 */
export type TransactionPollingState = {
  /** Whether polling is currently active */
  isPolling: boolean;
  /** The latest transaction status from the API */
  apiStatus: Transaction["status"] | null;
  /** Error message if polling failed */
  error: string | null;
  /** The full transaction data from the API */
  transaction: Transaction | null;
  /** Whether the receipt has been submitted */
  receiptSubmitted: boolean;
};

/**
 * Hook for monitoring transaction status after submission.
 * Handles receipt submission and status polling with bridge phase detection.
 *
 * @returns Transaction polling state and control functions
 */
export function useTransactionPolling() {
  const { setTransactionStatus, setCurrentStep, setErrorMessage } =
    useDeposit();

  const [state, setState] = useState<TransactionPollingState>({
    isPolling: false,
    apiStatus: null,
    error: null,
    transaction: null,
    receiptSubmitted: false,
  });

  // Refs for cleanup and timeout tracking
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  /**
   * Clear all timers and stop polling
   */
  const clearPolling = useCallback(() => {
    console.log(
      "[TW Polling] clearPolling() called - stack:",
      new Error().stack?.split("\n").slice(1, 4).join(" <- ")
    );
    abortRef.current = true;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Start monitoring a transaction by polling status.
   * Note: Receipt submission is handled by useTransactionSubmit.
   *
   * @param intentId - The route intent ID from buildRoute
   * @param _txHash - The transaction hash (unused, kept for API compatibility)
   */
  const startPolling = useCallback(
    async (intentId: string, _txHash: string) => {
      // Clear any existing polling
      clearPolling();
      abortRef.current = false;
      startTimeRef.current = Date.now();

      setState({
        isPolling: true,
        apiStatus: null,
        error: null,
        transaction: null,
        receiptSubmitted: true, // Receipt already submitted by useTransactionSubmit
      });

      try {
        // Set up the 5-minute timeout
        timeoutRef.current = setTimeout(() => {
          if (abortRef.current) return;

          const timeoutError =
            "Transaction is taking longer than expected. Please check your wallet or block explorer for status.";

          setState((prev) => ({
            ...prev,
            isPolling: false,
            error: timeoutError,
          }));

          setErrorMessage(timeoutError);
          setTransactionStatus("error");
          setCurrentStep("error");
        }, POLL_TIMEOUT_MS);

        // Step 3: Start polling loop
        const poll = async () => {
          console.log(
            "[TW Polling] poll() called, abortRef:",
            abortRef.current
          );
          if (abortRef.current) {
            console.log("[TW Polling] ABORTED - exiting poll loop");
            return;
          }

          try {
            console.log("[TW Polling] Fetching status for intent:", intentId);
            const tx = await getStatus(intentId);
            console.log(
              "[TW Polling] API response - status:",
              tx.status,
              "| id:",
              tx.id,
              "| full:",
              JSON.stringify(tx)
            );

            // Check if aborted after async call
            if (abortRef.current) return;

            // Update state with latest transaction data
            setState((prev) => ({
              ...prev,
              apiStatus: tx.status,
              transaction: tx,
            }));

            // Handle terminal states
            if (tx.status === "success") {
              console.log(
                "[TW Polling] SUCCESS detected! Navigating to success page..."
              );
              clearPolling();
              setState((prev) => ({
                ...prev,
                isPolling: false,
              }));
              setTransactionStatus("success");
              setCurrentStep("success");
              return;
            }

            if (tx.status === "failed") {
              const failError = mapFailedTransactionError(tx);
              console.log(
                "[TW Polling] FAILED detected! Error:",
                failError,
                "| Navigating to error page..."
              );
              clearPolling();
              setState((prev) => ({
                ...prev,
                isPolling: false,
                error: failError,
              }));
              setErrorMessage(failError);
              setTransactionStatus("error");
              setCurrentStep("error");
              return;
            }

            // Handle bridging phase
            if (tx.status === "bridging") {
              console.log("[TW Polling] BRIDGING phase detected");
              setTransactionStatus("bridging");
            }

            // Schedule next poll if not terminal
            console.log(
              "[TW Polling] Status is",
              tx.status,
              "- scheduling next poll in",
              POLL_INTERVAL_MS,
              "ms"
            );
            pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS);
            console.log(
              "[TW Polling] Next poll scheduled, pollingRef:",
              pollingRef.current !== null
            );
          } catch (pollErr) {
            if (abortRef.current) return;

            // Log but continue polling on transient errors
            console.warn("Transaction status poll error:", pollErr);

            // Check if we've been polling for too long (soft timeout check)
            const elapsed = Date.now() - startTimeRef.current;
            if (elapsed > POLL_TIMEOUT_MS) {
              clearPolling();
              const timeoutError =
                "Transaction monitoring timed out. Please check your wallet or block explorer.";
              setState((prev) => ({
                ...prev,
                isPolling: false,
                error: timeoutError,
              }));
              setErrorMessage(timeoutError);
              setTransactionStatus("error");
              setCurrentStep("error");
              return;
            }

            // Retry after interval
            pollingRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        };

        // Start first poll
        poll();
      } catch (err) {
        if (abortRef.current) return;

        const errorMessage = mapReceiptError(err);
        clearPolling();

        setState({
          isPolling: false,
          apiStatus: null,
          error: errorMessage,
          transaction: null,
          receiptSubmitted: false,
        });

        setErrorMessage(errorMessage);
        setTransactionStatus("error");
        setCurrentStep("error");
      }
    },
    [clearPolling, setTransactionStatus, setCurrentStep, setErrorMessage]
  );

  /**
   * Stop polling manually
   */
  const stopPolling = useCallback(() => {
    clearPolling();
    setState((prev) => ({
      ...prev,
      isPolling: false,
    }));
  }, [clearPolling]);

  /**
   * Reset the polling state
   */
  const resetPolling = useCallback(() => {
    clearPolling();
    setState({
      isPolling: false,
      apiStatus: null,
      error: null,
      transaction: null,
      receiptSubmitted: false,
    });
  }, [clearPolling]);

  // Cleanup on unmount only - use ref to avoid dependency issues
  const clearPollingRef = useRef(clearPolling);
  clearPollingRef.current = clearPolling;

  useEffect(() => {
    return () => {
      clearPollingRef.current();
    };
  }, []); // Empty deps - only run cleanup on actual unmount

  return {
    ...state,
    startPolling,
    stopPolling,
    resetPolling,
  };
}

/**
 * Maps receipt submission errors to user-friendly messages
 */
function mapReceiptError(err: unknown): string {
  if (!err) {
    return "Failed to submit transaction receipt. Please try again.";
  }

  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err);

  const msgLower = msg.toLowerCase();

  // Network/API errors
  if (
    msgLower.includes("network") ||
    msgLower.includes("fetch") ||
    msgLower.includes("connection")
  ) {
    return "Network error while submitting transaction. Please check your connection.";
  }

  // Rate limiting
  if (msgLower.includes("rate limit") || msgLower.includes("429")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // Invalid intent
  if (msgLower.includes("intent") || msgLower.includes("not found")) {
    return "Transaction session expired. Please try again.";
  }

  // Already submitted
  if (msgLower.includes("duplicate") || msgLower.includes("already")) {
    return "Transaction already submitted. Monitoring status...";
  }

  // Return cleaned message
  const cleanedMsg = msg
    .replace(/^error:\s*/i, "")
    .replace(/^err:\s*/i, "")
    .trim();

  if (cleanedMsg.length > 150) {
    return cleanedMsg.substring(0, 147) + "...";
  }

  return cleanedMsg || "Failed to submit transaction. Please try again.";
}

/**
 * Maps failed transaction details to user-friendly error message
 */
function mapFailedTransactionError(tx: Transaction): string {
  // Check for specific failure reasons in the status
  const statusRaw = tx.statusRaw;
  if (typeof statusRaw === "object" && statusRaw !== null) {
    const reason =
      (statusRaw as any).reason ||
      (statusRaw as any).error ||
      (statusRaw as any).message;

    if (reason) {
      const reasonLower = String(reason).toLowerCase();

      if (reasonLower.includes("slippage") || reasonLower.includes("price")) {
        return "Transaction failed due to price movement. Please try again with a higher slippage.";
      }

      if (reasonLower.includes("liquidity")) {
        return "Transaction failed due to insufficient liquidity. Try a smaller amount.";
      }

      if (reasonLower.includes("timeout") || reasonLower.includes("expired")) {
        return "Transaction expired. Please start a new deposit.";
      }
    }
  }

  // Check gas status
  if (tx.gasStatus === "insufficient") {
    return "Transaction failed due to insufficient gas. Please ensure you have enough native tokens for gas.";
  }

  // Default failure message
  return "Transaction failed. Please try again or contact support if the issue persists.";
}

export default useTransactionPolling;
