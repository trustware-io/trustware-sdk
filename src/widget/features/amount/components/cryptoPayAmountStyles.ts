import type React from "react";

import { colors, spacing } from "../../../styles";

export const amountSectionContainerStyle: React.CSSProperties = {
  flex: 1,
  padding: `0 ${spacing[6]}`,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

export const tokenConversionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  marginTop: spacing[2],
};

export const balanceRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  marginTop: spacing[2],
};

export const maxButtonStyle = (
  isFixedAmount: boolean
): React.CSSProperties => ({
  padding: `${spacing[1]} ${spacing[3]}`,
  fontSize: "0.75rem",
  fontWeight: 500,
  color: colors.mutedForeground,
  backgroundColor: colors.muted,
  borderRadius: "9999px",
  transition: "background-color 0.2s",
  border: 0,
  cursor: isFixedAmount ? "not-allowed" : "pointer",
});

export const tokenPickerContainerStyle: React.CSSProperties = {
  marginTop: spacing[6],
  display: "flex",
  flexDirection: "column",
  gap: spacing[3],
};

export const amountSliderContainerStyle: React.CSSProperties = {
  width: "100%",
  marginTop: spacing[8],
  padding: `0 ${spacing[2]}`,
};

export const feeSummaryContainerStyle: React.CSSProperties = {
  width: "100%",
  marginTop: spacing[6],
  padding: spacing[4],
  borderRadius: "1rem",
  backgroundColor: "rgba(63, 63, 70, 0.5)",
};

export const feeSummaryDividerStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: colors.border,
  margin: `${spacing[2]} 0`,
};

export const loadingFeeSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `${spacing[2]} 0`,
};

export const emptyFeeSummaryStyle: React.CSSProperties = {
  textAlign: "center",
  padding: `${spacing[2]} 0`,
};

export const feeSummaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "0.875rem",
};

export const feeSummaryValueStyle: React.CSSProperties = {
  fontWeight: 500,
  color: colors.foreground,
};
