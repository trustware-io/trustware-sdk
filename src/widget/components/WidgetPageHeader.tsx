import React from "react";

import { borderRadius, colors, fontSize, fontWeight, spacing } from "../styles";

export interface WidgetPageHeaderProps {
  onBack?: () => void;
  onClose?: () => void;
  title: string;
}

export function WidgetPageHeader({
  onBack,
  onClose,
  title,
}: WidgetPageHeaderProps): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: onClose ? "space-between" : "center",
        padding: `${spacing[4]} ${spacing[4]}`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: spacing[1],
            marginRight: spacing[2],
            borderRadius: borderRadius.lg,
            transition: "background-color 0.2s",
            backgroundColor: "transparent",
            border: 0,
            cursor: "pointer",
          }}
          aria-label="Go back"
        >
          <svg
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: colors.foreground,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      ) : (
        <div style={{ width: "2.5rem" }} />
      )}
      <h1
        style={{
          flex: 1,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: colors.foreground,
          textAlign: "center",
          marginRight: onBack ? "1.75rem" : undefined,
        }}
      >
        {title}
      </h1>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "2.5rem",
            height: "2.5rem",
            borderRadius: "9999px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.2s",
            border: 0,
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
          aria-label="Close"
        >
          <svg
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: colors.foreground,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      ) : (
        <div style={{ width: "2.5rem" }} />
      )}
    </div>
  );
}
