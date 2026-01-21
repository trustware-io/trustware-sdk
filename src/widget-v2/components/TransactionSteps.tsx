import React, { useMemo } from "react";
import { cn } from "../lib/utils";
import type { TransactionStatus } from "../context/DepositContext";

/**
 * Step configuration for the transaction progress display
 */
export interface Step {
  /** Step display label */
  label: string;
  /** Optional icon URL for the step */
  icon?: string;
  /** Step status */
  status: "pending" | "active" | "complete";
}

export interface TransactionStepsProps {
  /** Current transaction status from context */
  transactionStatus: TransactionStatus;
  /** Additional CSS classes */
  className?: string;
  /** Custom step labels (optional) */
  stepLabels?: {
    confirming?: string;
    processing?: string;
    bridging?: string;
    complete?: string;
  };
}

/**
 * Default step labels
 */
const DEFAULT_LABELS = {
  confirming: "Confirming in wallet",
  processing: "Processing on network",
  bridging: "Bridging to destination",
  complete: "Complete",
};

/**
 * Generates steps array based on current transaction status
 */
function getSteps(
  status: TransactionStatus,
  labels: typeof DEFAULT_LABELS
): Step[] {
  const statusOrder: TransactionStatus[] = [
    "confirming",
    "processing",
    "bridging",
    "success",
  ];
  const currentIndex = statusOrder.indexOf(status);

  return [
    {
      label: labels.confirming,
      status:
        currentIndex > 0
          ? "complete"
          : currentIndex === 0
            ? "active"
            : "pending",
    },
    {
      label: labels.processing,
      status:
        currentIndex > 1
          ? "complete"
          : currentIndex === 1
            ? "active"
            : "pending",
    },
    {
      label: labels.bridging,
      status:
        currentIndex > 2
          ? "complete"
          : currentIndex === 2
            ? "active"
            : "pending",
    },
    {
      label: labels.complete,
      status:
        currentIndex >= 3
          ? "complete"
          : currentIndex === 3
            ? "active"
            : "pending",
    },
  ];
}

/**
 * TransactionSteps component.
 * Displays a vertical list of transaction steps with visual status indicators.
 * Shows checkmark for completed steps, spinner for active step, and number for pending steps.
 */
export function TransactionSteps({
  transactionStatus,
  className,
  stepLabels,
}: TransactionStepsProps): React.ReactElement {
  // Merge custom labels with defaults
  const labels = useMemo(
    () => ({
      ...DEFAULT_LABELS,
      ...stepLabels,
    }),
    [stepLabels]
  );

  // Generate steps based on current status
  const steps = useMemo(
    () => getSteps(transactionStatus, labels),
    [transactionStatus, labels]
  );

  return (
    <div className={cn("tw-space-y-3", className)}>
      {steps.map((step, index) => (
        <div key={index} className="tw-flex tw-items-center tw-gap-3">
          {/* Step indicator */}
          <div
            className={cn(
              "tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-transition-all tw-shrink-0",
              step.status === "complete" && "tw-bg-green-500 tw-text-white",
              step.status === "active" && "tw-bg-primary tw-text-primary-foreground",
              step.status === "pending" && "tw-bg-muted tw-text-muted-foreground"
            )}
          >
            {step.status === "complete" ? (
              <svg
                className="tw-w-4 tw-h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : step.status === "active" ? (
              <svg
                className="tw-w-4 tw-h-4 tw-animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="tw-opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="tw-opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <span className="tw-text-xs tw-font-medium">{index + 1}</span>
            )}
          </div>

          {/* Step icon (optional) */}
          {step.icon && (
            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-overflow-hidden tw-shrink-0">
              <img
                src={step.icon}
                alt=""
                className="tw-w-full tw-h-full tw-object-contain"
              />
            </div>
          )}

          {/* Step label */}
          <span
            className={cn(
              "tw-text-sm tw-font-medium",
              step.status === "pending"
                ? "tw-text-muted-foreground"
                : "tw-text-foreground"
            )}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default TransactionSteps;
