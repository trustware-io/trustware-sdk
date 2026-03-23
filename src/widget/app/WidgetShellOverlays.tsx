import React from "react";

import { Dialog } from "../components";
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
  zIndex,
} from "../styles";
import type { ResolvedTheme } from "../context/DepositContext";

interface ConfirmCloseDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  theme: ResolvedTheme;
}

export function ConfirmCloseDialog({
  open,
  onConfirm,
  onCancel,
  theme,
}: ConfirmCloseDialogProps): React.ReactElement {
  return (
    <Dialog
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={"Transaction in Progress"}
      description={
        "You have an active transaction. Closing the widget will not cancel your transaction, but you will lose visibility of its progress."
      }
      isDark={theme === "dark"}
    />
  );
}

interface InitErrorOverlayProps {
  open: boolean;
  isDark: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function InitErrorOverlay({
  open,
  isDark,
  isRefreshing,
  onRefresh,
}: InitErrorOverlayProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="init-error-title"
      aria-describedby="init-error-description"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.2)",
        zIndex: zIndex[40],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing[6],
        borderRadius: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: borderRadius.xl,
          padding: spacing[6],
          backgroundColor: colors.card,
          color: colors.cardForeground,
          boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.35)",
          textAlign: "left",
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2
          id="init-error-title"
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.cardForeground,
          }}
        >
          API key validation failed
        </h2>
        <p
          id="init-error-description"
          style={{
            marginTop: spacing[2],
            fontSize: fontSize.sm,
            color: colors.mutedForeground,
          }}
        >
          We could not validate your Trustware API key. Please refresh to retry.
        </p>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh validation"
          style={{
            marginTop: spacing[4],
            width: "100%",
            borderRadius: "0.5rem",
            backgroundColor: colors.primary,
            padding: `${spacing[2.5]} ${spacing[4]}`,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.primaryForeground,
            border: 0,
            cursor: isRefreshing ? "not-allowed" : "pointer",
            opacity: isRefreshing ? 0.7 : 1,
            transition: "background-color 0.2s",
          }}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
