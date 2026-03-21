import React from "react";

import { borderRadius, colors, fontSize, spacing } from "../../../styles";

export interface TokenSearchInputProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export function TokenSearchInput({
  searchQuery,
  setSearchQuery,
}: TokenSearchInputProps): React.ReactElement {
  return (
    <div style={{ position: "relative" }}>
      <svg
        style={{
          position: "absolute",
          left: spacing[2.5],
          top: "50%",
          transform: "translateY(-50%)",
          width: "1rem",
          height: "1rem",
          color: colors.mutedForeground,
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" />
        <path strokeLinecap="round" d="m21 21-4.35-4.35" />
      </svg>

      <input
        type="text"
        placeholder="Search tokens..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: "100%",
          paddingLeft: spacing[8],
          paddingRight: spacing[3],
          paddingTop: spacing[2],
          paddingBottom: spacing[2],
          fontSize: fontSize.sm,
          backgroundColor: "rgba(63, 63, 70, 0.5)",
          border: `1px solid rgba(63, 63, 70, 0.5)`,
          borderRadius: borderRadius.lg,
          color: colors.foreground,
          outline: "none",
          transition: "all 0.2s",
        }}
      />

      {searchQuery ? (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          style={{
            position: "absolute",
            right: spacing[2.5],
            top: "50%",
            transform: "translateY(-50%)",
            padding: spacing[0.5],
            borderRadius: "9999px",
            backgroundColor: "transparent",
            border: 0,
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          aria-label="Clear search"
        >
          <svg
            style={{
              width: "0.875rem",
              height: "0.875rem",
              color: colors.mutedForeground,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
