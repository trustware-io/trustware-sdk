import React from "react";
import { mergeStyles } from "../lib/utils";
import { colors, spacing } from "../styles/tokens";

/**
 * Resolved theme type (not 'system')
 */
export type ResolvedTheme = "light" | "dark";

export interface ThemeToggleProps {
  /** Current resolved theme */
  theme: ResolvedTheme;
  /** Callback when theme is toggled */
  onToggle: () => void;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const buttonStyle: React.CSSProperties = {
  position: "relative",
  width: "2.25rem",
  height: "2.25rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "9999px",
  transition: "all 0.2s ease-out",
  backgroundColor: "hsl(var(--tw-muted) / 0.5)",
  color: colors.mutedForeground,
  border: "none",
  cursor: "pointer",
  outline: "none",
};

const iconStyle: React.CSSProperties = {
  position: "absolute",
  width: "1.25rem",
  height: "1.25rem",
  transition: "all 0.3s ease-out",
};

/**
 * Theme toggle button with sun/moon icons for switching between light and dark modes.
 * Uses animated icons to provide visual feedback during theme transition.
 */
export function ThemeToggle({
  theme,
  onToggle,
  style,
}: ThemeToggleProps): React.ReactElement {
  const isDark = theme === "dark";

  const sunIconStyle = mergeStyles(
    iconStyle,
    isDark
      ? { opacity: 1, transform: "rotate(0deg) scale(1)" }
      : { opacity: 0, transform: "rotate(90deg) scale(0.5)" }
  );

  const moonIconStyle = mergeStyles(
    iconStyle,
    isDark
      ? { opacity: 0, transform: "rotate(-90deg) scale(0.5)" }
      : { opacity: 1, transform: "rotate(0deg) scale(1)" }
  );

  return (
    <button
      onClick={onToggle}
      style={mergeStyles(buttonStyle, style)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Sun icon (visible in dark mode) */}
      <svg
        style={sunIconStyle}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>

      {/* Moon icon (visible in light mode) */}
      <svg
        style={moonIconStyle}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  );
}

export default ThemeToggle;
