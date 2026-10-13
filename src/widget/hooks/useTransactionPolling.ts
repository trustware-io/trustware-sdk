"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackIntent, type ReceiptReport } from "../../core/intentTracking";
import { describeTrackingFailure } from "../lib/trackingFailure";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositTransaction,
} from "../context/DepositContext";
import { useTrustware } from "../../provider";
import type { Transaction } from "../../types";
import { Trustware } from "../../core";
import { useGTMTracker } from "../../hooks";

/**
 * Transaction polling state
 */
export type TransactionPollingState = {
  /** Whether tracking is currently running */
  isPolling: boolean;
  /** The latest status payload from the API */
  transaction: Transaction | null;
};

/**
 * Hook for tracking a submitted transaction: delivers its receipt and polls
 * the intent's status until it is terminal (see trackIntent).
 *
 * @returns Transaction polling state and the function that starts tracking
 */
export function useTransactionPolling() {
  const { setCurrentStep } = useDepositNavigation();
  const { setTransactionStatus, setErrorMessage } = useDepositTransaction();
  const { emitSuccess } = useTrustware();
  const { selectedChain, selectedToken } = useDepositForm();
  const destinationConfig = (() => {
    try {
      return Trustware.getConfig();
    } catch {
      return undefined;
    }
  })();
  const { trackEvent } = useGTMTracker();

  const [state, setState] = useState<TransactionPollingState>({
    isPolling: false,
    transaction: null,
  });

  const trackingRef = useRef<AbortController | null>(null);

  const stopTracking = useCallback(() => {
    trackingRef.current?.abort();
    trackingRef.current = null;
  }, []);

  /**
   * Start tracking a transaction.
   *
   * @param receipt - The receipt for the transaction the wallet sent
   */
  const startPolling = useCallback(
    (receipt: ReceiptReport) => {
      stopTracking();
      const controller = new AbortController();
      trackingRef.current = controller;

      setState({ isPolling: true, transaction: null });

      void trackIntent(receipt, {
        signal: controller.signal,
        onUpdate: (tx) => {
          setState((prev) => ({ ...prev, transaction: tx }));
          if (tx.status === "bridging") setTransactionStatus("bridging");
        },
      }).then((outcome) => {
        if (outcome.kind === "aborted") return;
        trackingRef.current = null;
        setState((prev) => ({ ...prev, isPolling: false }));

        if (outcome.kind === "success") {
          setTransactionStatus("success");
          setCurrentStep("success");
          trackEvent("payment_completed", {
            from_chain:
              selectedChain?.networkName ??
              selectedChain?.axelarChainName ??
              selectedChain?.chainId ??
              "unknown",
            from_token: selectedToken?.symbol ?? "unknown",
            to_chain: destinationConfig?.routes?.toChain ?? "unknown",
            to_token: destinationConfig?.routes?.toToken ?? "unknown",
            domain: window.origin,
          });
          emitSuccess?.(outcome.transaction);
          return;
        }

        setErrorMessage(describeTrackingFailure(outcome));
        setTransactionStatus("error");
        setCurrentStep("error");
      });
    },
    [
      stopTracking,
      destinationConfig?.routes.toChain,
      destinationConfig?.routes.toToken,
      emitSuccess,
      selectedChain?.axelarChainName,
      selectedChain?.chainId,
      selectedChain?.networkName,
      selectedToken?.symbol,
      setCurrentStep,
      setErrorMessage,
      setTransactionStatus,
      trackEvent,
    ]
  );

  // Cleanup on unmount only - use ref to avoid dependency issues
  const stopTrackingRef = useRef(stopTracking);
  stopTrackingRef.current = stopTracking;

  useEffect(() => {
    return () => {
      stopTrackingRef.current();
    };
  }, []); // Empty deps - only run cleanup on actual unmount

  return {
    ...state,
    startPolling,
  };
}

export default useTransactionPolling;
