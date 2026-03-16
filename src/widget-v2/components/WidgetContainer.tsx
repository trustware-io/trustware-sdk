import React, { useEffect, useState } from "react";
import { ToastContainer } from "./Toast";
import { ALL_THEME_STYLES, ALL_ANIMATION_STYLES } from "../styles";
import { colors, shadows } from "../styles";

export type Theme = "light" | "dark" | "system";

export interface WidgetContainerProps {
  children: React.ReactNode;
  theme?: Theme;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Combined styles for injection - only injected once
 */
const INJECTED_STYLES = ALL_THEME_STYLES + ALL_ANIMATION_STYLES;

/**
 * Responsive container component that wraps the widget and handles embedding concerns.
 * - Max-width of 420px suitable for embedding
 * - Theme support: light, dark, or system preference
 * - Scrollable when content exceeds height
 * - Injects all necessary CSS for theming and animations
 */
export function WidgetContainer({
  children,
  theme = "system",
  className,
  style,
}: WidgetContainerProps): React.ReactElement {
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  /* eslint-disable react-hooks/set-state-in-effect -- syncing theme prop with system preference requires setState in effect */
  useEffect(() => {
    if (theme === "system") {
      // Check system preference
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      setResolvedTheme(mediaQuery.matches ? "dark" : "light");

      // Listen for changes
      const handler = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      {/* Inject all required CSS once */}
      <style>{INJECTED_STYLES}</style>
      <div
        className={`trustware-widget tw-scrollbar-none ${className || ""}`.trim()}
        data-theme={resolvedTheme}
        style={{
          maxWidth: "420px",
          width: "100%",
          overflow: "visible",
          backgroundColor: colors.card,
          color: colors.foreground,
          borderRadius: "20px",
          boxShadow: shadows.large,
          border: `1px solid ${colors.border}`,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
          position: "relative",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          ...style,
        }}
      >
        {children}
        <ToastContainer />
      </div>
    </>
  );
}

export default WidgetContainer;
