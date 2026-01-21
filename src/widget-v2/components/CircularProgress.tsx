import React from "react";
import { cn } from "../lib/utils";

export interface CircularProgressProps {
  /** Progress value from 0-100 */
  progress?: number;
  /** Size of the circle in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Additional CSS classes */
  className?: string;
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
  className,
  showPercentage = false,
  isIndeterminate = false,
}: CircularProgressProps): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={cn(
        "tw-relative tw-inline-flex tw-items-center tw-justify-center",
        className
      )}
    >
      <svg
        width={size}
        height={size}
        className={cn(isIndeterminate && "tw-animate-spin")}
        style={{ animationDuration: "2s" }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--tw-muted))"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--tw-primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isIndeterminate ? circumference * 0.75 : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="tw-transition-all tw-duration-500 tw-ease-out"
        />
      </svg>

      {showPercentage && !isIndeterminate && (
        <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
          <span className="tw-text-2xl tw-font-bold tw-text-foreground">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

export default CircularProgress;
