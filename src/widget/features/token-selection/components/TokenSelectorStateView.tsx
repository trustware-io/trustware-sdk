import React from "react";

import { borderRadius, colors, fontSize, spacing } from "../../../styles";

export interface TokenSelectorStateViewProps {
  isLoadingTokens: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  state: "no-chain" | "error" | "empty";
  tokensError?: string | null;
}

export function TokenSelectorStateView({
  isLoadingTokens,
  searchQuery,
  setSearchQuery,
  state,
  tokensError,
}: TokenSelectorStateViewProps): React.ReactElement {
  if (isLoadingTokens) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[2],
          padding: `0 ${spacing[2]}`,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              padding: `${spacing[2.5]} ${spacing[2]}`,
            }}
          >
            <div
              style={{
                width: "2.25rem",
                height: "2.25rem",
                borderRadius: "9999px",
                backgroundColor: colors.muted,
              }}
              className="tw-animate-pulse"
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: "1rem",
                  width: "4rem",
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.md,
                  marginBottom: spacing[1.5],
                }}
                className="tw-animate-pulse"
              />
              <div
                style={{
                  height: "0.75rem",
                  width: "6rem",
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.md,
                }}
                className="tw-animate-pulse"
              />
            </div>
            <div
              style={{
                height: "1rem",
                width: "3.5rem",
                backgroundColor: colors.muted,
                borderRadius: borderRadius.md,
              }}
              className="tw-animate-pulse"
            />
          </div>
        ))}
      </div>
    );
  }

  if (state === "no-chain") {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${spacing[4]}`,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <svg
            style={{
              width: "3rem",
              height: "3rem",
              margin: `0 auto ${spacing[3]}`,
              color: "rgba(161, 161, 170, 0.5)",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
            />
          </svg>
          <p
            style={{
              fontSize: fontSize.sm,
              color: colors.mutedForeground,
            }}
          >
            Select a chain to view available tokens
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${spacing[4]}`,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <svg
            style={{
              width: "2.5rem",
              height: "2.5rem",
              margin: `0 auto ${spacing[2]}`,
              color: colors.destructive,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
          </svg>
          <p
            style={{
              fontSize: fontSize.sm,
              color: colors.destructive,
              marginBottom: spacing[2],
            }}
          >
            {tokensError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: spacing[2],
              fontSize: fontSize.xs,
              color: colors.primary,
              backgroundColor: "transparent",
              border: 0,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${spacing[4]}`,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <svg
          style={{
            width: "2.5rem",
            height: "2.5rem",
            margin: `0 auto ${spacing[2]}`,
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          <path strokeLinecap="round" d="M8 11h6" />
        </svg>
        <p
          style={{
            fontSize: fontSize.sm,
            color: colors.mutedForeground,
          }}
        >
          {searchQuery
            ? `No tokens matching "${searchQuery}"`
            : "No tokens available"}
        </p>
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            style={{
              marginTop: spacing[2],
              fontSize: fontSize.xs,
              color: colors.primary,
              backgroundColor: "transparent",
              border: 0,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Clear search
          </button>
        ) : null}
      </div>
    </div>
  );
}
