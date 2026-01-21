import React from "react";
import { cn } from "../lib/utils";

/**
 * Resolved theme type (not 'system')
 */
export type ResolvedTheme = "light" | "dark";

export interface ThemeToggleProps {
  /** Current resolved theme */
  theme: ResolvedTheme;
  /** Callback when theme is toggled */
  onToggle: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Theme toggle button with sun/moon icons for switching between light and dark modes.
 * Uses animated icons to provide visual feedback during theme transition.
 */
export function ThemeToggle({
  theme,
  onToggle,
  className,
}: ThemeToggleProps): React.ReactElement {
  const isDark = theme === "dark";

  return (
    <button
      onClick={onToggle}
      className={cn(
        "tw-relative tw-w-9 tw-h-9 tw-flex tw-items-center tw-justify-center",
        "tw-rounded-full tw-transition-all tw-duration-200",
        "tw-bg-muted/50 hover:tw-bg-muted",
        "tw-text-muted-foreground hover:tw-text-foreground",
        "focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-primary/50 focus:tw-ring-offset-2",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Sun icon (visible in dark mode) */}
      <svg
        className={cn(
          "tw-absolute tw-w-5 tw-h-5 tw-transition-all tw-duration-300",
          isDark
            ? "tw-opacity-100 tw-rotate-0 tw-scale-100"
            : "tw-opacity-0 tw-rotate-90 tw-scale-50"
        )}
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
        className={cn(
          "tw-absolute tw-w-5 tw-h-5 tw-transition-all tw-duration-300",
          isDark
            ? "tw-opacity-0 tw--rotate-90 tw-scale-50"
            : "tw-opacity-100 tw-rotate-0 tw-scale-100"
        )}
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
