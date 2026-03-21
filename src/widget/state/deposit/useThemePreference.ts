import { useCallback, useState } from "react";

import type { ResolvedTheme } from "./types";

const THEME_STORAGE_KEY = "trustware-widget-theme";

function getInitialTheme(): ResolvedTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }

  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}

export function useThemePreference() {
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setResolvedTheme((current) => {
      const nextTheme = current === "light" ? "dark" : "light";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // localStorage unavailable
      }
      return nextTheme;
    });
  }, []);

  return {
    resolvedTheme,
    toggleTheme,
  };
}
