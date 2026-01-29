import React, { useMemo } from "react";
import { mergeStyles, cn } from "../lib/utils";
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

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[3],
};

const stepRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
};

const indicatorBaseStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "9999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s",
  flexShrink: 0,
};

const stepIconStyle: React.CSSProperties = {
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: "9999px",
  overflow: "hidden",
  flexShrink: 0,
};

const stepIconImgStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

const checkIconStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
};

const spinnerStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  animation: "tw-spin 1s linear infinite",
};

const stepNumberStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
};

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
    <div style={mergeStyles(containerStyle, style)}>
      {steps.map((step, index) => {
        const indicatorStyle = mergeStyles(
          indicatorBaseStyle,
          step.status === "complete" && {
            backgroundColor: colors.green[500],
            color: colors.white,
          },
          step.status === "active" && {
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
          },
          step.status === "pending" && {
            backgroundColor: colors.muted,
            color: colors.mutedForeground,
          }
        );

        const labelStyle = mergeStyles(
          stepLabelStyle,
          step.status === "pending"
            ? { color: colors.mutedForeground }
            : { color: colors.foreground }
        );

        return (
          <div key={index} style={stepRowStyle}>
            {/* Step indicator */}
            <div style={indicatorStyle}>
              {step.status === "complete" ? (
                <svg
                  style={checkIconStyle}
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
                  style={spinnerStyle}
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
                <span style={stepNumberStyle}>{index + 1}</span>
              )}
            </div>

            {/* Step icon (optional) */}
            {step.icon && (
              <div style={stepIconStyle}>
                <img src={step.icon} alt="" style={stepIconImgStyle} />
              </div>
            )}

            {/* Step label */}
            <span style={labelStyle}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default TransactionSteps;
