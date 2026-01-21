import React, { useEffect, useState } from "react";
import { cn } from "../lib/utils";

export type Theme = "light" | "dark" | "system";

export interface WidgetContainerProps {
  children: React.ReactNode;
  theme?: Theme;
  className?: string;
}

/**
 * Responsive container component that wraps the widget and handles embedding concerns.
 * - Max-width of 420px suitable for embedding
 * - Theme support: light, dark, or system preference
 * - Scrollable when content exceeds height
 */
export function WidgetContainer({
  children,
  theme = "system",
  className,
}: WidgetContainerProps): React.ReactElement {
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

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

  return (
    <div
      className={cn(
        "trustware-widget",
        "tw-max-w-[420px] tw-w-full",
        "tw-overflow-y-auto tw-overflow-x-hidden",
        "tw-bg-background tw-text-foreground",
        "tw-rounded-lg tw-shadow-lg",
        "tw-font-sans",
        className
      )}
      data-theme={resolvedTheme}
    >
      {children}
    </div>
  );
}

export default WidgetContainer;
