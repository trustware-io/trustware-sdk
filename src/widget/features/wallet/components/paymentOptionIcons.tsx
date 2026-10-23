import type React from "react";

import { colors } from "../../../styles";

export function CryptoPaymentIcon(): React.ReactElement {
  return (
    <svg
      style={{
        width: "1.25rem",
        height: "1.25rem",
        color: colors.mutedForeground,
      }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}
