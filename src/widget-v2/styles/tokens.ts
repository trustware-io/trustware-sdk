/**
 * Design tokens for the Trustware Widget
 * These tokens define the visual language of the widget and are used by inline styles.
 */

/**
 * Spacing scale (in rem)
 */
export const spacing = {
  0: "0",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  11: "2.75rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  36: "9rem",
  40: "10rem",
  44: "11rem",
  48: "12rem",
  52: "13rem",
  56: "14rem",
  60: "15rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
} as const;

/**
 * Border radius values
 */
export const borderRadius = {
  none: "0",
  sm: "calc(var(--tw-radius) - 4px)",
  md: "calc(var(--tw-radius) - 2px)",
  lg: "var(--tw-radius)",
  xl: "calc(var(--tw-radius) + 4px)",
  "2xl": "calc(var(--tw-radius) + 8px)",
  full: "9999px",
} as const;

/**
 * Font sizes
 */
export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
} as const;

/**
 * Line heights
 */
export const lineHeight = {
  none: "1",
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const;

/**
 * Font weights
 */
export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Colors - using CSS variables for theming
 * These reference the CSS variables injected by the theme system
 */
export const colors = {
  // Semantic colors (reference CSS variables)
  background: "hsl(var(--tw-background))",
  foreground: "hsl(var(--tw-foreground))",
  card: "hsl(var(--tw-card))",
  cardForeground: "hsl(var(--tw-card-foreground))",
  primary: "hsl(var(--tw-primary))",
  primaryForeground: "hsl(var(--tw-primary-foreground))",
  secondary: "hsl(var(--tw-secondary))",
  secondaryForeground: "hsl(var(--tw-secondary-foreground))",
  muted: "hsl(var(--tw-muted))",
  mutedForeground: "hsl(var(--tw-muted-foreground))",
  accent: "hsl(var(--tw-accent))",
  accentForeground: "hsl(var(--tw-accent-foreground))",
  destructive: "hsl(var(--tw-destructive))",
  destructiveForeground: "hsl(var(--tw-destructive-foreground))",
  border: "hsl(var(--tw-border))",
  input: "hsl(var(--tw-input))",
  ring: "hsl(var(--tw-ring))",

  // Static colors (don't change with theme)
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",

  // Zinc scale (for specific use cases)
  zinc: {
    50: "#fafafa",
    100: "#f4f4f5",
    200: "#e4e4e7",
    300: "#d4d4d8",
    400: "#a1a1aa",
    500: "#71717a",
    600: "#52525b",
    700: "#3f3f46",
    800: "#27272a",
    900: "#18181b",
    950: "#09090b",
  },

  // Green scale (for success states)
  green: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },

  // Red scale (for error states)
  red: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },

  // Blue scale (for primary actions)
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },

  // Amber scale (for warnings)
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },

  // Emerald scale (for slider/progress)
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
  },
} as const;

/**
 * Shadow values - using CSS variables for theming
 */
export const shadows = {
  none: "none",
  soft: "var(--tw-shadow-soft)",
  medium: "var(--tw-shadow-medium)",
  large: "var(--tw-shadow-large)",
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
} as const;

/**
 * Transition presets
 */
export const transitions = {
  smooth: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  fast: "all 0.15s ease-out",
  normal: "all 0.2s ease-out",
  slow: "all 0.3s ease-out",
  colors: "color, background-color, border-color 0.2s ease-out",
  opacity: "opacity 0.2s ease-out",
  transform: "transform 0.2s ease-out",
} as const;

/**
 * Z-index scale
 */
export const zIndex = {
  0: "0",
  10: "10",
  20: "20",
  30: "30",
  40: "40",
  50: "50",
  auto: "auto",
} as const;
