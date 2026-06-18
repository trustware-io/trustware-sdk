import React from "react";
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from "src/widget/styles";
import { WidgetSecurityFooter } from "./WidgetSecurityFooter";
import type { MappedError, ErrorCategory } from "src/widget/lib/mapError";

export interface ErrorPageProps {
  error: MappedError;
  onTryAgain: () => void;
  onStartOver: () => void;
  txHash?: string | null;
  explorerUrl?: string | null;
}

function ErrorIcon({
  category,
}: {
  category: ErrorCategory;
}): React.ReactElement {
  const style: React.CSSProperties = {
    width: "2.25rem",
    height: "2.25rem",
    color: colors.destructive,
  };

  if (category === "wallet_rejected") {
    return (
      <svg
        style={style}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    );
  }

  if (category === "network_error") {
    return (
      <svg
        style={style}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
      </svg>
    );
  }

  if (category === "insufficient_funds") {
    return (
      <svg
        style={style}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }

  if (category === "no_route" || category === "route_error") {
    return (
      <svg
        style={style}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }

  // transaction_failed, timeout, unknown — warning triangle
  return (
    <svg
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ErrorPage({
  error,
  onTryAgain,
  onStartOver,
  txHash,
  explorerUrl,
}: ErrorPageProps): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${spacing[4]}`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <h1
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.foreground,
          }}
        >
          {error.title}
        </h1>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: `${spacing[8]} ${spacing[6]}`,
          gap: spacing[4],
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "4rem",
            height: "4rem",
            borderRadius: "9999px",
            backgroundColor: "rgba(239,68,68,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ErrorIcon category={error.category} />
        </div>

        {/* Message */}
        <p
          style={{
            fontSize: fontSize.sm,
            color: colors.mutedForeground,
            maxWidth: "18rem",
            lineHeight: 1.6,
          }}
        >
          {error.message}
        </p>

        {/* Explorer link */}
        {txHash && explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: fontSize.xs,
              color: colors.primary,
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textUnderlineOffset: "3px",
            }}
          >
            View on explorer
            <svg
              style={{ width: "0.75rem", height: "0.75rem" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>

      {/* Buttons */}
      <div
        style={{
          padding: `0 ${spacing[5]} ${spacing[5]}`,
          display: "flex",
          flexDirection: "column",
          gap: spacing[2],
        }}
      >
        <button
          onClick={onTryAgain}
          style={{
            width: "100%",
            height: "3.25rem",
            borderRadius: borderRadius["2xl"],
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            border: 0,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
        <button
          onClick={onStartOver}
          style={{
            width: "100%",
            height: "2.75rem",
            borderRadius: borderRadius["2xl"],
            backgroundColor: "transparent",
            color: colors.mutedForeground,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            border: `1px solid ${colors.border}`,
            cursor: "pointer",
          }}
        >
          Start Over
        </button>
      </div>

      <WidgetSecurityFooter />
    </div>
  );
}
