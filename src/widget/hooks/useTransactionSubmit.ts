"use client";
import { useCallback, useState } from "react";
import type { ReceiptReport } from "../../core/intentTracking";
import type { TrackedReceipt } from "../state/deposit/types";
import {
  sendSignableRoute,
  type BuiltRoute,
  type MaterialRouteChange,
} from "../../core/signTimeRoute";
import {
  prepareConfirmedSend,
  type PAYMENT_INITIATED,
} from "../lib/confirmedSend";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositTransaction,
} from "../context/DepositContext";
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

/** A send path other than the plain wallet transaction (the smart-account
 *  UserOp). `hash` is what the widget displays; `receipt` is what it tracks.
 *  It gets the route `routeForSigning` cleared, like the plain path. */
type SendOverride = (
  routeResult: BuildRouteResult
) => Promise<{ hash: string; receipt: ReceiptReport }>;

/** How a submission ended. */
export type SubmitOutcome =
  | { kind: "sent"; hash: string }
  /** The error is already on the error screen. */
  | { kind: "failed" }
  /** A Solana route rebuilt at sign time came back materially worse.
   *  Nothing was sent and the widget stays on the review screen. */
  | {
      kind: "route_changed";
      rebuilt: BuiltRoute;
      change: MaterialRouteChange;
    };

/**
 * Hook for submitting transactions to the wallet.
 * Handles the wallet signing flow and error mapping.
 *
 * @returns Transaction submission state and submit function
 */
export function useTransactionSubmit() {
  const { selectedChain } = useDepositForm();
  const { setCurrentStep } = useDepositNavigation();
  const {
    setTransactionStatus,
    setTransactionHash,
    setErrorMessage,
    setReceipt,
  } = useDepositTransaction();

  const [state, setState] = useState<TransactionSubmitState>({
    isSubmitting: false,
    txHash: null,
    error: null,
  });
  // Shown while the wallet is asked to sign a second time because signing
  // outlasted the Solana blockhash.
  const [signingRetryMessage, setSigningRetryMessage] = useState<string | null>(
    null
  );

  /**
   * Submit the reviewed route to the wallet for signing.
   * Updates context state throughout the flow.
   */
  const submitTransaction = useCallback(
    async (
      reviewed: BuiltRoute,
      /** Something is about to be sent: report `payment_initiated` here. */
      onSendStarting: (event: typeof PAYMENT_INITIATED) => void,
      sendOverride?: SendOverride
    ): Promise<SubmitOutcome> => {
      const routeResult = reviewed.result;
      if (!routeResult?.txReq) {
        const errorMsg = "Invalid route data. Please try again.";
        setState({
          isSubmitting: false,
          txHash: null,
          error: errorMsg,
        });
        setErrorMessage(errorMsg);
        setTransactionStatus("error");
        setCurrentStep("error");
        return { kind: "failed" };
      }

      setState({
        isSubmitting: true,
        txHash: null,
        error: null,
      });
      setSigningRetryMessage(null);

      // Set context to confirming state (waiting for wallet signature)
      setTransactionStatus("confirming");

      try {
        // Rebuilds a Solana route right before signing; its blockhash may
        // have expired while the user read Confirm Deposit.
        const decision = await prepareConfirmedSend(reviewed, onSendStarting);
        if (decision.kind === "route_changed") {
          setState({ isSubmitting: false, txHash: null, error: null });
          setTransactionStatus("idle");
          return decision;
        }

        // The network has it: show the Processing page at once. A Solana
        // send keeps rebroadcasting until it settles, which the user
        // shouldn't have to watch from this screen.
        const showSent = (hash: string, receipt: TrackedReceipt) => {
          setState({ isSubmitting: false, txHash: hash, error: null });
          setTransactionHash(hash);
          setReceipt(receipt);
          setTransactionStatus("processing");
          setCurrentStep("processing");
        };

        if (sendOverride) {
          const { hash, receipt } = await sendOverride(decision.route);
          showSent(hash, { report: receipt, delivery: "tracker_posts" });
          return { kind: "sent", hash };
        }

        // The send step delivers the receipt at acceptance, so the
        // Processing page only polls (`delivery`).
        const acceptance = { shown: false };
        const fallbackChainId = selectedChain?.chainId;
        const sent = await sendSignableRoute(
          reviewed,
          decision.route,
          Number(fallbackChainId),
          { onRetry: (retry) => setSigningRetryMessage(retry.message) },
          (accepted) => {
            acceptance.shown = true;
            showSent(accepted.hash, {
              report: accepted.receipt,
              delivery: accepted.receiptDelivery,
            });
          }
        );
        if (sent.kind === "route_changed") {
          setState({ isSubmitting: false, txHash: null, error: null });
          setSigningRetryMessage(null);
          setTransactionStatus("idle");
          return sent;
        }
        if (!acceptance.shown) {
          throw new Error(
            `Intent ${sent.receipt.intentId} was sent without being reported as accepted.`
          );
        }
        return { kind: "sent", hash: sent.hash };
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

        return { kind: "failed" };
      }
    },
    [
      selectedChain,
      setTransactionStatus,
      setTransactionHash,
      setErrorMessage,
      setCurrentStep,
      setReceipt,
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
    setSigningRetryMessage(null);
  }, []);

  return {
    ...state,
    signingRetryMessage,
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
  const errRecord = err as Record<string, unknown>;
  const errorCode =
    errRecord?.code ?? (errRecord?.data as Record<string, unknown>)?.code;
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
