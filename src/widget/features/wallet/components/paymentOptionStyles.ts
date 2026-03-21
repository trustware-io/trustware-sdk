import type React from "react";

import { colors, spacing } from "../../../styles";

export const dropdownWrapperStyle: React.CSSProperties = {
  position: "relative",
  height: "2.75rem",
};

export const dropdownWrapperOpenStyle: React.CSSProperties = {
  position: "relative",
  height: "2.75rem",
  zIndex: 100,
};

export const dividerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
  maxWidth: "100%",
  width: "100%",
};

export const dropdownSurfaceStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginTop: spacing[2],
  width: "16rem",
  zIndex: 100,
};

export const dropdownSectionHeadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  marginBottom: spacing[2],
};

export const dropdownStatusDotStyle = (color: string): React.CSSProperties => ({
  width: "0.375rem",
  height: "0.375rem",
  borderRadius: "9999px",
  backgroundColor: color,
});

export const selectionRingStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  borderRadius: "9999px",
  border: `2px solid rgba(161, 161, 170, 0.3)`,
};

export const walletActionIconBoxStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "0.75rem",
  backgroundColor: "rgba(59, 130, 246, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const dividerBorderStyle: React.CSSProperties = {
  borderTop: `1px solid rgba(63, 63, 70, 0.5)`,
};

export const mutedOrDividerStyle = (
  isDarkTheme: boolean
): React.CSSProperties => ({
  flex: "1",
  height: isDarkTheme ? "0.5px" : "1px",
  backgroundColor: colors.zinc[100],
});
