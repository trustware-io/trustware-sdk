import React from "react";
import { mergeStyles, cn } from "../lib/utils";
import { colors, fontSize, fontWeight } from "../styles";

export interface CircularProgressProps {
  /** Progress value from 0-100 */
  progress?: number;
  /** Size of the circle in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Show percentage text in center */
  showPercentage?: boolean;
  /** Use spinning indeterminate animation */
  isIndeterminate?: boolean;
}

/**
 * CircularProgress component for displaying progress in a circular format.
 * Supports both determinate (with percentage) and indeterminate (spinning) modes.
 */
export function CircularProgress({
  progress = 0,
  size = 120,
  strokeWidth = 8,
  style,
  showPercentage = false,
  isIndeterminate = false,
}: CircularProgressProps): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        className={cn(isIndeterminate && "tw-animate-spin")}
        style={{
          ...(isIndeterminate
            ? { animation: "tw-spin 2s linear infinite" }
            : {}),
        }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.muted}
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isIndeterminate ? circumference * 0.75 : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "all 0.5s ease-out",
          }}
        />
      </svg>

      {showPercentage && !isIndeterminate && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: fontSize["2xl"],
              fontWeight: fontWeight.bold,
              color: colors.foreground,
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

export default CircularProgress;
