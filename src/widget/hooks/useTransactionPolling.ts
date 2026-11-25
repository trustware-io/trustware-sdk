"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackIntent } from "../../core/intentTracking";
import type { TrackedReceipt } from "../state/deposit/types";
import { describeTrackingFailure } from "../lib/trackingFailure";
import {
  useDepositNavigation,
  useDepositTransaction,
} from "../context/DepositContext";
import { useTrustware } from "../../provider";
import type { Transaction } from "../../types";

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
 * Hook for tracking a submitted transaction: polls the intent's status
 * until it is terminal (see trackIntent).
 *
 * @returns Transaction polling state and the function that starts tracking
 */
export function useTransactionPolling() {
  const { setCurrentStep } = useDepositNavigation();
  const { setTransactionStatus, setErrorMessage } = useDepositTransaction();
  const { emitSuccess } = useTrustware();

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
   * @param receipt - The transaction the network accepted, and its receipt
   *   delivery
   */
  const startPolling = useCallback(
    (receipt: TrackedReceipt) => {
      stopTracking();
      const controller = new AbortController();
      trackingRef.current = controller;

      setState({ isPolling: true, transaction: null });

      void trackIntent(receipt.report, {
        signal: controller.signal,
        receiptDelivery: receipt.delivery,
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
      emitSuccess,
      setCurrentStep,
      setErrorMessage,
      setTransactionStatus,
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
