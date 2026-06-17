import { useCallback, useEffect, useState } from "react";

import type { ResolvedTheme } from "./types";

const THEME_STORAGE_KEY = "trustware-widget-theme";

function resolveConfigTheme(
  configTheme: "light" | "dark" | "system"
): ResolvedTheme {
  if (typeof window === "undefined") return "light";

  // Explicit config value always wins — only fall back to localStorage/OS for "system"
  if (configTheme !== "system") return configTheme;

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useThemePreference(
  configTheme: "light" | "dark" | "system" = "system"
) {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveConfigTheme(configTheme)
  );

  useEffect(() => {
    setResolvedTheme(resolveConfigTheme(configTheme));
  }, [configTheme]);

  // Track system preference changes when mode is "system" and no localStorage override
  useEffect(() => {
    if (configTheme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return; // user has overridden
    } catch {
      // localStorage unavailable
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [configTheme]);

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
