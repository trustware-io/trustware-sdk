import type React from "react";

import { colors, fontSize, fontWeight, spacing } from "../../../styles";

export interface PaymentDropdownButtonProps {
  icon: React.ReactNode;
  isOpen: boolean;
  label: string;
  onClick: () => void;
}

export function PaymentDropdownButton({
  icon,
  isOpen,
  label,
  onClick,
}: PaymentDropdownButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing[3],
        padding: `${spacing[3]} ${spacing[6]}`,
        borderRadius: "9999px",
        transition: "all 0.2s",
        backgroundColor: "rgba(161, 161, 170, 0.1)",
        width: "14rem",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: fontSize.sm,
        lineHeight: 1.5,
        outline: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        appearance: "none",
      }}
    >
      {icon}
      <span
        style={{
          fontWeight: fontWeight.medium,
          fontSize: fontSize.sm,
          color: colors.foreground,
          flex: 1,
          textAlign: "left",
        }}
      >
        {label}
      </span>
      <svg
        style={{
          width: "1rem",
          height: "1rem",
          color: colors.mutedForeground,
          transition: "transform 0.2s",
          transform: isOpen ? "rotate(180deg)" : "none",
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
