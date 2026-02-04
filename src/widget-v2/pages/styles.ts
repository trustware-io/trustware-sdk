// import { colors } from "../styles";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/tokens";

// Styles
export const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "500px",
  maxHeight: "70vh",
};

export const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: `${spacing[4]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border}`,
};

export const backButtonStyle: React.CSSProperties = {
  padding: spacing[1],
  marginRight: spacing[2],
  borderRadius: borderRadius.lg,
  transition: "background-color 0.2s",
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
};

export const backIconStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  color: colors.foreground,
};

export const headerTitleStyle: React.CSSProperties = {
  flex: 1,
  fontSize: fontSize.lg,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
  textAlign: "center",
  marginRight: "1.75rem",
};

export const contentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  overflow: "hidden",
};

// Left column styles
export const leftColumnStyle: React.CSSProperties = {
  width: "140px",
  borderRight: `1px solid ${colors.border}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export const columnHeaderStyle: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  borderBottom: `1px solid rgba(63, 63, 70, 0.5)`,
};

export const columnLabelStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  color: colors.mutedForeground,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const chainListContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: `${spacing[2]} ${spacing[1]}`,
};

export const skeletonContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[2],
  padding: `0 ${spacing[2]}`,
};

export const skeletonRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[2]} 0`,
};

export const skeletonCircleStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "9999px",
  backgroundColor: colors.muted,
};

export const skeletonTextStyle: React.CSSProperties = {
  flex: 1,
  height: "1rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
};

export const errorTextStyle: React.CSSProperties = {
  padding: `${spacing[3]} ${spacing[4]}`,
  textAlign: "center",
};

export const errorMessageStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.destructive,
};

export const retryLinkStyle: React.CSSProperties = {
  marginTop: spacing[2],
  fontSize: fontSize.xs,
  color: colors.primary,
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
  textDecoration: "underline",
};

export const sectionStyle: React.CSSProperties = {
  marginBottom: spacing[2],
};

export const sectionHeaderStyle: React.CSSProperties = {
  padding: `${spacing[1.5]} ${spacing[3]}`,
};

export const sectionLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: fontWeight.medium,
  color: "rgba(161, 161, 170, 0.7)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const chainButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[2.5]} ${spacing[3]}`,
  borderRadius: borderRadius.lg,
  border: "1px solid transparent",
  transition: "all 0.2s",
  backgroundColor: "transparent",
  cursor: "pointer",
};

export const chainButtonSelectedStyle: React.CSSProperties = {
  border: `1px solid ${colors.primary}`,
  backgroundColor: "rgba(59, 130, 246, 0.1)",
};

export const chainIconStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "9999px",
  objectFit: "cover",
  flexShrink: 0,
};

export const chainIconFallbackStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "9999px",
  backgroundColor: colors.muted,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export const chainIconFallbackTextStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.semibold,
  color: colors.mutedForeground,
};

export const chainNameContainerStyle: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  minWidth: 0,
};

export const chainNameStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
  color: colors.foreground,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
};

export const selectionIndicatorStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  borderRadius: "9999px",
  backgroundColor: colors.primary,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export const checkIconStyle: React.CSSProperties = {
  width: "0.75rem",
  height: "0.75rem",
  color: colors.primaryForeground,
};

export const emptyStateStyle: React.CSSProperties = {
  padding: `${spacing[3]} ${spacing[4]}`,
  textAlign: "center",
};

export const emptyTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

// Right column styles
export const rightColumnStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export const tokenHeaderStyle: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  borderBottom: `1px solid rgba(63, 63, 70, 0.5)`,
};

export const tokenHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  marginBottom: spacing[2],
};

export const walletBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  color: colors.primary,
  backgroundColor: "rgba(59, 130, 246, 0.1)",
  padding: `${spacing[0.5]} ${spacing[1.5]}`,
  borderRadius: borderRadius.md,
};

export const searchContainerStyle: React.CSSProperties = {
  position: "relative",
};

export const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: spacing[2.5],
  top: "50%",
  transform: "translateY(-50%)",
  width: "1rem",
  height: "1rem",
  color: colors.mutedForeground,
};

export const searchInputStyle: React.CSSProperties = {
  width: "100%",
  paddingLeft: spacing[8],
  paddingRight: spacing[3],
  paddingTop: spacing[2],
  paddingBottom: spacing[2],
  fontSize: fontSize.sm,
  backgroundColor: "rgba(63, 63, 70, 0.5)",
  border: `1px solid rgba(63, 63, 70, 0.5)`,
  borderRadius: borderRadius.lg,
  color: colors.foreground,
  outline: "none",
  transition: "all 0.2s",
};

export const clearSearchButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: spacing[2.5],
  top: "50%",
  transform: "translateY(-50%)",
  padding: spacing[0.5],
  borderRadius: "9999px",
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
  transition: "background-color 0.2s",
};

export const clearIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
  color: colors.mutedForeground,
};

export const tokenListContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: `${spacing[2]} ${spacing[1]}`,
};

export const centeredContainerStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `0 ${spacing[4]}`,
};

export const centeredContentStyle: React.CSSProperties = {
  textAlign: "center",
};

export const placeholderIconStyle: React.CSSProperties = {
  width: "3rem",
  height: "3rem",
  margin: `0 auto ${spacing[3]}`,
  color: "rgba(161, 161, 170, 0.5)",
};

export const smallIconStyle: React.CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  margin: `0 auto ${spacing[2]}`,
};

export const tokenSkeletonRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[2.5]} ${spacing[2]}`,
};

export const tokenSkeletonCircleStyle: React.CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "9999px",
  backgroundColor: colors.muted,
};

export const tokenSkeletonTextContainerStyle: React.CSSProperties = {
  flex: 1,
};

export const tokenSkeletonTextSmStyle: React.CSSProperties = {
  height: "1rem",
  width: "4rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
  marginBottom: spacing[1.5],
};

export const tokenSkeletonTextLgStyle: React.CSSProperties = {
  height: "0.75rem",
  width: "6rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
};

export const tokenSkeletonBalanceStyle: React.CSSProperties = {
  height: "1rem",
  width: "3.5rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
};

export const tokenListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[0.5],
};

export const tokenButtonStyle: React.CSSProperties = {
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
};

export const tokenIconStyle: React.CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "9999px",
  objectFit: "cover",
  flexShrink: 0,
};

export const tokenIconFallbackStyle: React.CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "9999px",
  backgroundColor: "rgba(59, 130, 246, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export const tokenIconFallbackTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: colors.primary,
};

export const tokenInfoStyle: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  minWidth: 0,
};

export const tokenSymbolContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1.5],
};

export const tokenSymbolStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const tokenNameStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  color: colors.mutedForeground,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
};

export const tokenBalanceContainerStyle: React.CSSProperties = {
  textAlign: "right",
  flexShrink: 0,
};

export const tokenBalanceStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
  color: colors.foreground,
};

export const chevronStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  color: colors.mutedForeground,
  flexShrink: 0,
};

export const footerStyle: React.CSSProperties = {
  padding: `${spacing[4]} ${spacing[6]}`,
  borderTop: `1px solid rgba(63, 63, 70, 0.3)`,
};

export const footerContentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
};

export const lockIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
  color: colors.mutedForeground,
};

export const footerTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

export const footerBrandStyle: React.CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};
