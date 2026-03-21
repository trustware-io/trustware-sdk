import React from "react";

import { formatTokenBalance } from "../../../../utils";
import type { YourTokenData } from "../../../context/DepositContext";
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from "../../../styles";

export interface WalletTokenListItemProps {
  onSelect: (token: YourTokenData) => void;
  token: YourTokenData;
}

export function WalletTokenListItem({
  onSelect,
  token,
}: WalletTokenListItemProps): React.ReactElement {
  const logoUrl =
    token.iconUrl || (token as typeof token & { logo_url?: string }).logo_url;

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
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
      <div style={{ position: "relative" }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={token.symbol}
            style={{
              width: "2.25rem",
              height: "2.25rem",
              borderRadius: "9999px",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "2.25rem",
              height: "2.25rem",
              borderRadius: "9999px",
              objectFit: "cover",
              flexShrink: 0,
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
        )}
        <div
          style={{
            position: "absolute",
            bottom: "-0.125rem",
            right: "-0.125rem",
            width: "1rem",
            height: "1rem",
            borderRadius: "100%",
            backgroundColor: colors.background,
            border: `2px solid ${colors.background}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={token.chainIconURI}
            alt={token.chainId?.toString()}
            style={{
              width: "0.875rem",
              height: "0.875rem",
              borderRadius: "9999px",
            }}
          />
        </div>
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
          {formatTokenBalance(token.balance, token.decimals)} {token.symbol}
        </span>
      </div>
    </button>
  );
}
