import React from "react";

import { colors, fontSize, spacing } from "../styles";

export interface TransactionHashLinkProps {
  explorerUrl?: string | null;
  hash: string;
  label?: string;
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function TransactionHashLink({
  explorerUrl,
  hash,
  label = "Transaction",
}: TransactionHashLinkProps): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[1],
      }}
    >
      <span
        style={{
          fontSize: fontSize.sm,
          color: colors.mutedForeground,
        }}
      >
        {label}
      </span>
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[1],
            color: colors.primary,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: fontSize.sm,
            }}
          >
            {truncateHash(hash)}
          </span>
          <svg
            style={{
              width: "0.875rem",
              height: "0.875rem",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      ) : (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: fontSize.sm,
            color: colors.foreground,
          }}
        >
          {truncateHash(hash)}
        </span>
      )}
    </div>
  );
}
