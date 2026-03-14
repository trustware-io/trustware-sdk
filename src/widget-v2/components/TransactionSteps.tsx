import React, { useMemo } from "react";
import { colors, spacing, fontSize, fontWeight } from "../styles/tokens";
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
  /** Additional inline styles */
  style?: React.CSSProperties;
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
  style,
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        ...style,
      }}
    >
      {steps.map((step, index) => {
        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
            }}
          >
            {/* Step indicator */}
            <div
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "9999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                flexShrink: 0,
                ...(step.status === "complete" && {
                  backgroundColor: colors.green[500],
                  color: colors.white,
                }),
                ...(step.status === "active" && {
                  backgroundColor: colors.primary,
                  color: colors.primaryForeground,
                }),
                ...(step.status === "pending" && {
                  backgroundColor: colors.muted,
                  color: colors.mutedForeground,
                }),
              }}
            >
              {step.status === "complete" ? (
                <svg
                  style={{
                    width: "1rem",
                    height: "1rem",
                  }}
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
                  style={{
                    width: "1rem",
                    height: "1rem",
                    animation: "tw-spin 1s linear infinite",
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    style={{ opacity: 0.25 }}
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    style={{ opacity: 0.75 }}
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <span
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {index + 1}
                </span>
              )}
            </div>

            {/* Step icon (optional) */}
            {step.icon && (
              <div
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  borderRadius: "9999px",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <img
                  src={step.icon}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            )}

            {/* Step label */}
            <span
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                ...(step.status === "pending"
                  ? { color: colors.mutedForeground }
                  : { color: colors.foreground }),
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default TransactionSteps;
