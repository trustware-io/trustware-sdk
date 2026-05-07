import React from "react";

import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from "../../../styles";
import { selectionRingStyle } from "./paymentOptionStyles";

export interface PaymentOptionRowProps {
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}

export function PaymentOptionRow({
  disabled = false,
  icon,
  label,
  onClick,
  trailing,
}: PaymentOptionRowProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing[2],
        borderRadius: borderRadius.lg,
        transition: "background-color 0.2s",
        border: "none",
        backgroundColor: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        fontSize: fontSize.sm,
        outline: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
        }}
      >
        {icon}
        <span
          style={{
            fontWeight: fontWeight.medium,
            fontSize: fontSize.sm,
            color: colors.foreground,
          }}
        >
          {label}
        </span>
      </div>
      {trailing ?? <div style={selectionRingStyle} />}
    </button>
  );
}
