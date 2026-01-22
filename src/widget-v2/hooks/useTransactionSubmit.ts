"use client";
import { useCallback, useState } from "react";
import { Trustware } from "../../core";
import { submitReceipt } from "../../core/routes";
import { useDeposit } from "../context/DepositContext";
import type { BuildRouteResult } from "../../types";

/**
 * Transaction submission state
 */
export type TransactionSubmitState = {
  /** Whether a transaction is currently being submitted */
  isSubmitting: boolean;
  /** Transaction hash after wallet approval (null if not yet submitted) */
  txHash: string | null;
  /** Error message if submission failed */
  error: string | null;
};

/**
 * Hook for submitting transactions to the wallet.
 * Handles the wallet signing flow and error mapping.
 *
 * @returns Transaction submission state and submit function
 */
export function useTransactionSubmit() {
  const {
    selectedChain,
    setTransactionStatus,
    setTransactionHash,
    setErrorMessage,
    setCurrentStep,
    setIntentId,
  } = useDeposit();

  const [state, setState] = useState<TransactionSubmitState>({
    isSubmitting: false,
    txHash: null,
    error: null,
  });

  /**
   * Submit a transaction to the wallet for signing.
   * Updates context state throughout the flow.
   *
   * @param routeResult - The built route result from useRouteBuilder
   * @returns The transaction hash if successful, null if failed
   */
  const submitTransaction = useCallback(
    async (routeResult: BuildRouteResult): Promise<string | null> => {
      if (!routeResult?.route?.transactionRequest) {
        const errorMsg = "Invalid route data. Please try again.";
        setState({
          isSubmitting: false,
          txHash: null,
          error: errorMsg,
        });
        setErrorMessage(errorMsg);
        setTransactionStatus("error");
        setCurrentStep("error");
        return null;
      }

      setState({
        isSubmitting: true,
        txHash: null,
        error: null,
      });

      // Set context to confirming state (waiting for wallet signature)
      setTransactionStatus("confirming");

      try {
        // Get the fallback chain ID from selected chain
        const fallbackChainId = selectedChain?.chainId;

        // Send the transaction to the wallet for signing
        const hash = await Trustware.sendRouteTransaction(
          routeResult,
          fallbackChainId
        );

        // Transaction was signed and submitted
        console.log("[TW Submit] Transaction signed! Hash:", hash);
        setState({
          isSubmitting: false,
          txHash: hash,
          error: null,
        });

        // Update context with the transaction hash and intent ID
        console.log(
          "[TW Submit] Setting context - hash:",
          hash,
          "intentId:",
          routeResult.intentId
        );
        setTransactionHash(hash);
        setIntentId(routeResult.intentId);

        // Notify backend of the transaction receipt
        try {
          await submitReceipt(routeResult.intentId, hash);
        } catch (receiptErr) {
          console.warn("Failed to submit receipt to backend:", receiptErr);
          // Don't fail the transaction if receipt submission fails
          // The backend poller will eventually pick it up
        }

        // Transition to processing step (polling will be handled by Processing page)
        setTransactionStatus("processing");
        setCurrentStep("processing");

        return hash;
      } catch (err) {
        // Map error to user-friendly message
        const errorMsg = mapTransactionError(err);

        setState({
          isSubmitting: false,
          txHash: null,
          error: errorMsg,
        });

        // Update context with error
        setErrorMessage(errorMsg);
        setTransactionStatus("error");
        setCurrentStep("error");

        return null;
      }
    },
    [
      selectedChain,
      setTransactionStatus,
      setTransactionHash,
      setErrorMessage,
      setCurrentStep,
      setIntentId,
    ]
  );

  /**
   * Reset the submission state
   */
  const resetSubmit = useCallback(() => {
    setState({
      isSubmitting: false,
      txHash: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    submitTransaction,
    resetSubmit,
  };
}

/**
 * Maps wallet/transaction errors to user-friendly messages
 */
function mapTransactionError(err: unknown): string {
  if (!err) {
    return "Transaction failed. Please try again.";
  }

  // Check for user rejection (code 4001)
  const errorCode = (err as any)?.code ?? (err as any)?.data?.code;
  if (errorCode === 4001) {
    return "Transaction cancelled. You rejected the request in your wallet.";
  }

  // Get error message
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err);

  const msgLower = msg.toLowerCase();

  // User rejection patterns
  if (
    msgLower.includes("user rejected") ||
    msgLower.includes("user denied") ||
    msgLower.includes("rejected the request") ||
    msgLower.includes("cancelled") ||
    msgLower.includes("canceled")
  ) {
    return "Transaction cancelled. You rejected the request in your wallet.";
  }

  // Insufficient funds
  if (
    msgLower.includes("insufficient funds") ||
    msgLower.includes("insufficient balance") ||
    msgLower.includes("not enough")
  ) {
    return "Insufficient funds. Please check your balance and try again.";
  }

  // Gas estimation failed
  if (msgLower.includes("gas") || msgLower.includes("execution reverted")) {
    return "Transaction would fail. Please try a different amount or token.";
  }

  // Network/RPC errors
  if (
    msgLower.includes("network") ||
    msgLower.includes("rpc") ||
    msgLower.includes("connection")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  // Chain switching errors
  if (msgLower.includes("chain") || msgLower.includes("switch")) {
    return "Please switch to the correct network in your wallet.";
  }

  // Wallet not configured
  if (msgLower.includes("wallet not configured")) {
    return "Wallet not connected. Please connect your wallet first.";
  }

  // Pending request
  if (msgLower.includes("pending") || msgLower.includes("already processing")) {
    return "Please check your wallet for a pending request.";
  }

  // Return the original message if no specific mapping found
  // but make it more user-friendly by removing technical prefixes
  const cleanedMsg = msg
    .replace(/^error:\s*/i, "")
    .replace(/^err:\s*/i, "")
    .replace(/^exception:\s*/i, "");

  // Truncate very long messages
  if (cleanedMsg.length > 150) {
    return cleanedMsg.substring(0, 147) + "...";
  }

  return cleanedMsg || "Transaction failed. Please try again.";
}

export default useTransactionSubmit;
