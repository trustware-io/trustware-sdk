import React from "react";

import { formatTokenBalance } from "../../../../utils";
import type { Token } from "../../../context/DepositContext";
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from "../../../styles";

export interface AvailableTokenListItemProps {
  onSelect: (token: Token) => Promise<void>;
  token: Token;
}

export function AvailableTokenListItem({
  onSelect,
  token,
}: AvailableTokenListItemProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => void onSelect(token)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
        padding: `${spacing[2.5]} ${spacing[3]}`,
        borderRadius: borderRadius.lg,
        transition: "all 0.2s",
        backgroundColor: "transparent",
        border: 0,
        cursor: "pointer",
      }}
    >
      {token.iconUrl ? (
        <img
          src={token.iconUrl}
          alt={token.symbol}
          style={{
            width: "2.25rem",
            height: "2.25rem",
            borderRadius: "9999px",
            objectFit: "cover",
            flexShrink: 0,
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            if (target.nextElementSibling) {
              (target.nextElementSibling as HTMLElement).style.display = "flex";
            }
          }}
        />
      ) : null}
      <div
        style={{
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: "9999px",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          display: token.iconUrl ? "none" : "flex",
        }}
      >
        <span
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.primary,
          }}
        >
          {token.symbol.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[1.5],
          }}
        >
          <span
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.foreground,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {token.symbol}
          </span>
        </div>
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.mutedForeground,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {token.name}
        </span>
      </div>

      {token.balance !== undefined ? (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.foreground,
            }}
          >
            {formatTokenBalance(token.balance, token.decimals)}
          </span>
        </div>
      ) : null}

      <svg
        style={{
          width: "1rem",
          height: "1rem",
          color: colors.mutedForeground,
          flexShrink: 0,
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
