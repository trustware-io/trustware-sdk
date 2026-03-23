import React from "react";

import { colors, fontSize, fontWeight, spacing } from "../styles";

export interface WidgetSecurityFooterProps {
  borderTopColor?: string;
  padding?: string;
}

export function WidgetSecurityFooter({
  borderTopColor = "rgba(63, 63, 70, 0.3)",
  padding = `${spacing[4]} ${spacing[6]}`,
}: WidgetSecurityFooterProps): React.ReactElement {
  return (
    <div
      style={{
        padding,
        borderTop: `1px solid ${borderTopColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[2],
        }}
      >
        <svg
          style={{
            width: "0.875rem",
            height: "0.875rem",
            color: colors.mutedForeground,
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span
          style={{
            fontSize: fontSize.sm,
            color: colors.mutedForeground,
          }}
        >
          Secured by{" "}
          <span
            style={{
              fontWeight: fontWeight.semibold,
              color: colors.foreground,
            }}
          >
            Trustware
          </span>
        </span>
      </div>
    </div>
  );
}
