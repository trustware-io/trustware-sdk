# Trustware Design System Specification

> **Version**: 2.0.0
> **Last Updated**: 2026-02-03
> **Scope**: Trustware SDK widget (embeddable in any host app)
> **Platforms**: Web (responsive), Mobile (iOS/Android web views)

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Styling Architecture](#2-styling-architecture)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Design Tokens](#4-design-tokens)
5. [Theme System](#5-theme-system)
6. [Typography System](#6-typography-system)
7. [Color System](#7-color-system)
8. [Spacing & Layout](#8-spacing--layout)
9. [Component Library](#9-component-library)
10. [Animation & Motion](#10-animation--motion)
11. [Responsive Design](#11-responsive-design)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [Widget State Machine](#13-widget-state-machine)
14. [Validation Protocol](#14-validation-protocol)

---

## 1. Overview & Philosophy

### 1.1 Design Principles

| Principle | Description | Validation Criteria |
|-----------|-------------|---------------------|
| **Inevitable Simplicity** | Every interaction should feel obvious and require zero explanation | User can complete primary action within 3 taps/clicks |
| **Soft Confidence** | Premium feel through restraint, not decoration | No more than 3 visual accents per screen |
| **Tactile Responsiveness** | Every touch/click provides immediate feedback | All interactive elements respond within 50ms |
| **Host-App Agnostic** | Widget works identically in any embedding context | Zero external CSS dependencies, self-contained styles |

### 1.2 Aesthetic Direction

**Primary Tone**: Modern Fintech Minimalism with iOS-inspired softness
- Clean, airy layouts with generous whitespace
- Subtle depth through soft shadows (not flat, not skeuomorphic)
- High-contrast typography hierarchy
- Emerald green as action/success accent
- Blue as primary brand color

**What to Avoid**:
- Generic purple gradients
- Overly decorative elements
- Harsh, flat Material Design
- Busy, cluttered layouts
- Inconsistent border radii

---

## 2. Styling Architecture

### 2.1 Why Inline Styles (Critical Context)

The SDK widget uses **inline styles exclusively** -- no Tailwind CSS, no external CSS files, no CSS-in-JS libraries. This is a deliberate architectural decision, not a limitation.

**Problem**: When the SDK is embedded in a host app (Next.js, Vite, CRA, etc.), the host's build system does not process the SDK's CSS:
- Tailwind classes won't be compiled
- CSS imports may fail or be ignored
- PostCSS plugins won't run
- CSS module scoping won't apply

**Solution**: All styling is self-contained via:
1. **Inline `style` props** (`React.CSSProperties` objects) for all visual properties
2. **Injected `<style>` tag** for things that can't be done inline (CSS variables, keyframes, pseudo-states, focus-visible)
3. **TypeScript design tokens** for consistency across components

### 2.2 Style System Architecture

```
src/widget-v2/styles/
├── index.ts           # Barrel export for all style modules
├── tokens.ts          # Design tokens (colors, spacing, typography, shadows, etc.)
├── theme.ts           # CSS variable definitions for light/dark themes
├── animations.ts      # Keyframe definitions and animation utility classes
└── utils.ts           # mergeStyles(), commonStyles, helper functions
```

**How it works:**

```
tokens.ts  ──→  Inline style properties + CSS variable references
                 (colors.primary = "hsl(var(--tw-primary))")

theme.ts   ──→  <style> tag injection (once, in WidgetContainer)
                 (CSS variables for light/dark, pseudo-state resets)

animations.ts ──→  <style> tag injection (once, in WidgetContainer)
                    (@keyframes + .tw-animate-* classes)

utils.ts   ──→  Runtime utilities for component authors
                 (mergeStyles(), commonStyles, circleStyle(), etc.)
```

### 2.3 Core Utility Functions

**`mergeStyles()`** -- the primary style composition function (replaces Tailwind's `cn()`):

```typescript
// src/widget-v2/styles/utils.ts
export function mergeStyles(...styles: StyleInput[]): StyleObject {
  return styles.reduce<StyleObject>((acc, style) => {
    if (!style) return acc;
    return { ...acc, ...style };
  }, {});
}

// Usage: conditional styles via short-circuit
<div style={mergeStyles(
  baseStyle,
  isActive && activeStyle,
  isDisabled && { opacity: 0.5 }
)} />
```

**`cn()`** -- still exists but only for CSS class name merging (animation classes):

```typescript
// src/widget-v2/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Usage: animation classes only
<div className={cn("tw-animate-fade-in", isSpinning && "tw-animate-spin")} />
```

### 2.4 Rules

- **NEVER** use Tailwind CSS classes, external CSS files, or CSS-in-JS libraries
- **ALL** visual properties use inline `style` props with token references
- **ONLY** use `className` for injected animation classes (`.tw-animate-*`) and pseudo-state utilities (`.tw-touch-none`, `.tw-scrollbar-none`)
- **ALL** components import tokens from `@/widget-v2/styles`
- **ALWAYS** use `mergeStyles()` for conditional style composition

---

## 3. Tech Stack & Dependencies

### 3.1 Core Stack

```json
{
  "framework": "React 18.3+",
  "build": "tsup (esbuild-based)",
  "styling": "Inline styles (React.CSSProperties)",
  "state": "React Context + custom hooks",
  "wallets": "@walletconnect/ethereum-provider",
  "icons": "lucide-react",
  "output": "ESM + CJS + TypeScript declarations"
}
```

### 3.2 Dependencies

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.15",
    "@walletconnect/ethereum-provider": "^2.17.0",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "tsup": "^8.5.0",
    "typescript": "^5.6.3",
    "eslint": "^9.x",
    "prettier": "^3.x"
  }
}
```

**What is NOT used** (removed in v2.0):
- ~~Tailwind CSS~~, ~~postcss~~, ~~autoprefixer~~
- ~~shadcn/ui~~, ~~class-variance-authority (CVA)~~
- ~~clsx + tailwind-merge~~ (clsx retained for animation classNames only)
- ~~tailwindcss-animate~~
- ~~react-hook-form~~, ~~zod~~
- ~~@tanstack/react-query~~, ~~react-router-dom~~

### 3.3 Build Configuration

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ["src/index.ts", "src/core.ts", "src/wallet.ts", "src/widget.tsx", "src/constants.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  target: "es2020",
  external: ["react", "react-dom", "wagmi", "@rainbow-me/rainbowkit",
             "@walletconnect/ethereum-provider", "qrcode"],
});
```

**Bundle size limit**: < 50 KB gzipped

---

## 4. Design Tokens

All tokens are defined in `src/widget-v2/styles/tokens.ts` as TypeScript constants.

### 4.1 Spacing Scale

```typescript
export const spacing = {
  0: "0",
  0.5: "0.125rem",   // 2px
  1: "0.25rem",       // 4px
  1.5: "0.375rem",    // 6px
  2: "0.5rem",        // 8px
  2.5: "0.625rem",    // 10px
  3: "0.75rem",       // 12px
  3.5: "0.875rem",    // 14px
  4: "1rem",          // 16px
  5: "1.25rem",       // 20px
  6: "1.5rem",        // 24px
  8: "2rem",          // 32px
  10: "2.5rem",       // 40px
  12: "3rem",         // 48px
  16: "4rem",         // 64px
  // ... extends to 96 (24rem)
} as const;
```

### 4.2 Border Radius

```typescript
export const borderRadius = {
  none: "0",
  sm: "calc(var(--tw-radius) - 4px)",    // ~12px
  md: "calc(var(--tw-radius) - 2px)",    // ~14px
  lg: "var(--tw-radius)",                 // 16px (1rem)
  xl: "calc(var(--tw-radius) + 4px)",    // ~20px
  "2xl": "calc(var(--tw-radius) + 8px)", // ~24px
  full: "9999px",                         // Pills, avatars, dots
} as const;
```

### 4.3 Font Sizes

```typescript
export const fontSize = {
  xs: "0.75rem",    // 12px
  sm: "0.875rem",   // 14px
  base: "1rem",     // 16px
  lg: "1.125rem",   // 18px
  xl: "1.25rem",    // 20px
  "2xl": "1.5rem",  // 24px
  "3xl": "1.875rem",// 30px
  "4xl": "2.25rem", // 36px
  "5xl": "3rem",    // 48px
  "6xl": "3.75rem", // 60px
} as const;
```

### 4.4 Font Weights

```typescript
export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
```

### 4.5 Line Heights

```typescript
export const lineHeight = {
  none: "1",
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const;
```

### 4.6 Shadows

```typescript
export const shadows = {
  none: "none",
  // Themed (reference CSS variables, change in light/dark)
  soft: "var(--tw-shadow-soft)",
  medium: "var(--tw-shadow-medium)",
  large: "var(--tw-shadow-large)",
  // Static (don't change with theme)
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
} as const;
```

### 4.7 Transitions

```typescript
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
```

### 4.8 Z-Index Scale

```typescript
export const zIndex = {
  0: "0", 10: "10", 20: "20", 30: "30", 40: "40", 50: "50", auto: "auto",
} as const;
```

---

## 5. Theme System

### 5.1 CSS Variable Injection

CSS variables are scoped to `.trustware-widget` and injected once via a `<style>` tag in `WidgetContainer`. All variables use the `--tw-` prefix.

**Light Theme (default):**

```css
.trustware-widget {
  --tw-background: 0 0% 98%;
  --tw-foreground: 220 15% 20%;
  --tw-card: 0 0% 100%;
  --tw-card-foreground: 220 15% 20%;
  --tw-primary: 217 91% 60%;
  --tw-primary-foreground: 0 0% 100%;
  --tw-secondary: 220 14% 96%;
  --tw-secondary-foreground: 220 15% 20%;
  --tw-muted: 220 14% 96%;
  --tw-muted-foreground: 220 10% 50%;
  --tw-accent: 217 91% 60%;
  --tw-accent-foreground: 0 0% 100%;
  --tw-destructive: 0 84% 60%;
  --tw-destructive-foreground: 0 0% 100%;
  --tw-border: 220 13% 91%;
  --tw-input: 220 13% 91%;
  --tw-ring: 217 91% 60%;
  --tw-radius: 1rem;

  --tw-shadow-soft: 0 2px 8px -2px hsl(220 15% 20% / 0.08);
  --tw-shadow-medium: 0 4px 16px -4px hsl(220 15% 20% / 0.12);
  --tw-shadow-large: 0 8px 32px -8px hsl(220 15% 20% / 0.16);

  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'SF Pro Text', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  box-sizing: border-box;
}
```

**Dark Theme:**

```css
.trustware-widget[data-theme="dark"],
.trustware-widget.dark {
  --tw-background: 220 15% 10%;
  --tw-foreground: 0 0% 98%;
  --tw-card: 220 15% 12%;
  --tw-card-foreground: 0 0% 98%;
  --tw-primary: 217 91% 60%;
  --tw-primary-foreground: 0 0% 100%;
  --tw-secondary: 220 15% 18%;
  --tw-secondary-foreground: 0 0% 98%;
  --tw-muted: 220 15% 18%;
  --tw-muted-foreground: 220 10% 60%;
  --tw-accent: 217 91% 60%;
  --tw-accent-foreground: 0 0% 100%;
  --tw-destructive: 0 84% 60%;
  --tw-destructive-foreground: 0 0% 100%;
  --tw-border: 220 15% 20%;
  --tw-input: 220 15% 20%;
  --tw-ring: 217 91% 60%;

  --tw-shadow-soft: 0 2px 8px -2px hsl(0 0% 0% / 0.2);
  --tw-shadow-medium: 0 4px 16px -4px hsl(0 0% 0% / 0.3);
  --tw-shadow-large: 0 8px 32px -8px hsl(0 0% 0% / 0.4);
}
```

### 5.2 Pseudo-State Styles (Injected CSS)

These handle states that can't be expressed as inline styles:

```css
/* Focus visible for all interactive elements */
.trustware-widget button:focus-visible,
.trustware-widget input:focus-visible,
.trustware-widget a:focus-visible {
  outline: 2px solid hsl(var(--tw-ring));
  outline-offset: 2px;
}

/* Scrollbar hiding on widget and all children */
.trustware-widget, .trustware-widget * { scrollbar-width: none; }
.trustware-widget::-webkit-scrollbar, .trustware-widget *::-webkit-scrollbar { display: none; }

/* Disabled buttons */
.trustware-widget button:disabled { cursor: not-allowed; opacity: 0.5; }

/* Touch/safe-area utilities */
.tw-touch-none { touch-action: none; }
.tw-safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
.tw-safe-area-top { padding-top: env(safe-area-inset-top); }

/* Selection highlight */
.trustware-widget ::selection { background-color: hsl(var(--tw-primary) / 0.2); }
```

### 5.3 Theme Switching

Theme is controlled via `data-theme` attribute on the widget root:

```tsx
// WidgetContainer.tsx
<div
  className="trustware-widget"
  data-theme={resolvedTheme}  // "light" | "dark"
  style={containerStyle}
>
  <style>{ALL_THEME_STYLES + ALL_ANIMATION_STYLES}</style>
  {children}
</div>
```

Supports: `"light"`, `"dark"`, `"system"` (auto-detects from `prefers-color-scheme`).

---

## 6. Typography System

### 6.1 Font Stack

Applied globally via the `.trustware-widget` CSS variable injection:

```
-apple-system, BlinkMacSystemFont, 'SF Pro Display',
'SF Pro Text', 'Helvetica Neue', sans-serif
```

Antialiasing: `-webkit-font-smoothing: antialiased`

### 6.2 Type Scale

| Role | Token Usage | Size | Weight | Line Height | Use Case |
|------|-------------|------|--------|-------------|----------|
| Display | `fontSize["6xl"], fontWeight.bold` | 60px | 700 | 1.0 | Hero amounts |
| Heading 1 | `fontSize["2xl"], fontWeight.semibold` | 24px | 600 | 1.25 | Page titles |
| Heading 2 | `fontSize.lg, fontWeight.semibold` | 18px | 600 | 1.375 | Section headers |
| Heading 3 | `fontSize.base, fontWeight.medium` | 16px | 500 | 1.5 | Subsection headers |
| Body | `fontSize.sm` | 14px | 400 | 1.5 | Primary content |
| Caption | `fontSize.xs` | 12px | 400 | 1.5 | Labels, hints |

### 6.3 Typography Patterns (Inline Styles)

```tsx
// Display Amount
<span style={{
  fontSize: fontSize["6xl"],
  fontWeight: fontWeight.bold,
  letterSpacing: "-0.025em",
  color: colors.foreground,
}}>
  $1,234.56
</span>

// Muted Placeholder
<span style={{
  fontSize: fontSize["6xl"],
  fontWeight: fontWeight.bold,
  letterSpacing: "-0.025em",
  color: colors.mutedForeground,
  opacity: 0.4,
}}>
  $0.00
</span>

// Page Title
<h1 style={{
  fontSize: fontSize.lg,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
}}>
  Deposit
</h1>

// Helper Text
<span style={{
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
}}>
  Balance 150.00
</span>
```

---

## 7. Color System

### 7.1 Semantic Colors (Theme-Aware)

These reference CSS variables and automatically switch between light/dark:

```typescript
export const colors = {
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
};
```

### 7.2 Semantic Color Usage

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `background` | `hsl(0 0% 98%)` | `hsl(220 15% 10%)` | Page background |
| `foreground` | `hsl(220 15% 20%)` | `hsl(0 0% 98%)` | Primary text |
| `card` | `hsl(0 0% 100%)` | `hsl(220 15% 12%)` | Card surfaces |
| `muted` | `hsl(220 14% 96%)` | `hsl(220 15% 18%)` | Subtle backgrounds |
| `mutedForeground` | `hsl(220 10% 50%)` | `hsl(220 10% 60%)` | Secondary text |
| `primary` | `hsl(217 91% 60%)` | `hsl(217 91% 60%)` | Brand blue, CTAs |
| `destructive` | `hsl(0 84% 60%)` | `hsl(0 84% 60%)` | Errors |
| `border` | `hsl(220 13% 91%)` | `hsl(220 15% 20%)` | Borders, dividers |

### 7.3 Static Color Scales

These don't change with theme and are used for specific UI elements:

```typescript
colors.white      // "#ffffff"
colors.black      // "#000000"
colors.transparent // "transparent"

// Named scales (50-900)
colors.zinc[800]    // "#27272a" - Dark backgrounds
colors.green[500]   // "#22c55e" - Success states
colors.red[500]     // "#ef4444" - Error states
colors.blue[500]    // "#3b82f6" - Primary actions
colors.amber[500]   // "#f59e0b" - Warnings
colors.emerald[500] // "#10b981" - Slider/progress active
```

### 7.4 Confetti Palette

```typescript
const CONFETTI_COLORS = [
  colors.emerald[500], // #10b981
  colors.blue[500],    // #3b82f6
  colors.amber[500],   // #f59e0b
  colors.red[500],     // #ef4444
  "#8b5cf6",           // violet
  "#ec4899",           // pink
  "#06b6d4",           // cyan
  "#84cc16",           // lime
];
```

---

## 8. Spacing & Layout

### 8.1 Common Spacing Usage

| Token | Value | Use Case |
|-------|-------|----------|
| `spacing[0.5]` | 2px | Micro gaps, icon insets |
| `spacing[1]` | 4px | Tight padding, small gaps |
| `spacing[1.5]` | 6px | Pill padding, dot gaps |
| `spacing[2]` | 8px | Standard small spacing |
| `spacing[3]` | 12px | Card internal spacing |
| `spacing[4]` | 16px | Standard padding |
| `spacing[6]` | 24px | Section spacing |
| `spacing[8]` | 32px | Large section gaps |

### 8.2 Widget Container Pattern

```tsx
// WidgetContainer.tsx -- top-level wrapper
const containerStyle: React.CSSProperties = {
  maxWidth: "420px",
  width: "100%",
  backgroundColor: colors.card,
  color: colors.foreground,
  borderRadius: "20px",
  boxShadow: shadows.large,
  border: `1px solid ${colors.border}`,
  overflow: "hidden",
  position: "relative",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
};

<div className="trustware-widget" data-theme={theme} style={containerStyle}>
  <style>{INJECTED_STYLES}</style>
  {children}
</div>
```

### 8.3 Page Layout Pattern

```tsx
// Header
<div style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `${spacing[4]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border}`,
}}>
  <h1 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground }}>
    Title
  </h1>
</div>

// Content
<div style={{
  flex: 1,
  padding: `0 ${spacing[6]}`,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
}}>
  {children}
</div>

// Footer
<div style={{
  padding: `${spacing[4]} ${spacing[6]}`,
  borderTop: `1px solid ${colors.border}`,
}}>
  {footer}
</div>
```

### 8.4 Border Radius Scale

| Token | Value | Use Case |
|-------|-------|----------|
| `borderRadius.sm` | ~12px | Small buttons, badges |
| `borderRadius.md` | ~14px | Inputs, small cards |
| `borderRadius.lg` | 16px | Cards, dropdowns |
| `borderRadius.xl` | ~20px | Large cards, containers |
| `borderRadius.full` | 9999px | Pills, avatars, dots |
| `"20px"` (hardcoded) | 20px | SDK container |

---

## 9. Component Library

### 9.1 Style Utilities

Pre-defined style objects available from `commonStyles`:

```typescript
import { commonStyles, mergeStyles } from "@/widget-v2/styles";

// Flexbox
commonStyles.flexCenter    // display:flex, align:center, justify:center
commonStyles.flexCol       // display:flex, flexDirection:column
commonStyles.flexRow       // display:flex, flexDirection:row
commonStyles.flexBetween   // display:flex, align:center, justify:space-between

// Position
commonStyles.absolute      // position:absolute
commonStyles.relative      // position:relative
commonStyles.inset0        // position:absolute, top/right/bottom/left: 0

// Size
commonStyles.fullWidth     // width:100%
commonStyles.fullSize      // width:100%, height:100%

// Text
commonStyles.textCenter    // textAlign:center
commonStyles.truncate      // overflow:hidden, textOverflow:ellipsis, whiteSpace:nowrap

// Interaction
commonStyles.selectNone    // userSelect:none
commonStyles.buttonReset   // border:none, background:none, cursor:pointer, etc.
commonStyles.inputReset    // border:none, background:none, outline:none, width:100%

// Transition
commonStyles.transitionColors  // color, bg, border 0.2s
commonStyles.transitionAll     // all 0.2s ease-out
```

### 9.2 Button Pattern

```tsx
const primaryButtonStyle: React.CSSProperties = {
  ...commonStyles.flexCenter,
  ...commonStyles.buttonReset,
  gap: spacing[2],
  padding: `${spacing[2]} ${spacing[4]}`,
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
  borderRadius: borderRadius.md,
  transition: transitions.colors,
  width: "100%",
  height: "2.5rem",
};

// Disabled: opacity handled by injected CSS (button:disabled { opacity: 0.5 })
<button style={primaryButtonStyle} disabled={isDisabled}>
  Submit
</button>
```

### 9.3 Card Pattern

```tsx
const cardStyle: React.CSSProperties = {
  backgroundColor: colors.card,
  color: colors.cardForeground,
  borderRadius: borderRadius.lg,
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.sm,
  padding: spacing[6],
};
```

### 9.4 Pill/Badge Pattern

```tsx
// Selection Pill (draggable token selector)
const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[2],
  padding: `${spacing[1.5]} ${spacing[4]}`,
  backgroundColor: "rgba(39, 39, 42, 0.4)",
  borderRadius: borderRadius.full,
  border: "1px solid rgba(63, 63, 70, 0.5)",
  userSelect: "none",
  touchAction: "none",
  cursor: "grab",
};

// Quick Amount Button
const quickAmountStyle: React.CSSProperties = {
  ...commonStyles.buttonReset,
  padding: `${spacing[1]} ${spacing[3]}`,
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  color: colors.mutedForeground,
  backgroundColor: colors.muted,
  borderRadius: borderRadius.full,
  transition: transitions.colors,
};
```

### 9.5 Swipe-to-Confirm Pattern

```tsx
// Track container
const trackStyle: React.CSSProperties = {
  position: "relative",
  height: "3.5rem",
  borderRadius: borderRadius.full,
  overflow: "hidden",
  userSelect: "none",
};

// Track background (dynamic based on progress)
const trackBg = progress > 0
  ? `linear-gradient(to right, rgb(34, 197, 94) ${progress * 100}%, rgb(39, 39, 42) ${progress * 100}%)`
  : "rgb(39, 39, 42)";

// Thumb
const thumbStyle: React.CSSProperties = mergeStyles(
  {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: "3rem",
    height: "3rem",
    borderRadius: borderRadius.full,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    backgroundColor: colors.white,
    boxShadow: shadows.md,
    transition: "all 0.15s ease-out",
  },
  isDragging && { transform: "translateY(-50%) scale(1.05)", cursor: "grabbing" },
  isComplete && { backgroundColor: colors.green[500], color: colors.white },
);
```

**Dual confirmation modes:**
1. **Drag**: Swipe thumb to 80% threshold
2. **Long-press**: Hold for 1.5s with circular SVG progress indicator

### 9.6 Amount Slider

```tsx
// Background track
const backgroundTrackStyle: React.CSSProperties = {
  position: "absolute",
  left: 0, right: 0,
  height: "0.625rem",
  backgroundColor: colors.zinc[800],
  borderRadius: borderRadius.full,
  boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.2)",
};

// Active track (gradient + glow)
const activeTrackStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  height: "0.625rem",
  background: `linear-gradient(90deg, ${colors.emerald[500]}, ${colors.emerald[400]})`,
  borderRadius: borderRadius.full,
  transition: "all 75ms",
  boxShadow: `0 0 8px ${colors.emerald[500]}40`,
  width: `${percentage}%`,
};

// Thumb
const thumbStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "1.75rem",
  height: "1.75rem",
  backgroundColor: colors.white,
  borderRadius: borderRadius.full,
  boxShadow: `0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 3px ${colors.emerald[500]}`,
  border: `3px solid ${colors.emerald[500]}`,
  pointerEvents: "none",
  transition: "all 75ms",
  left: `calc(${percentage}% - 14px)`,
};
```

### 9.7 Token Carousel (TokenSwipePill)

```tsx
// Each token item uses transform-based positioning
const tokenStyle: React.CSSProperties = {
  position: "absolute",
  transition: isDragging ? "all 75ms" : "all 200ms ease-out",
  transform: `translateX(${offset}px) scale(${scale})`,
  opacity: isCenter ? 1 : 0.5,
  filter: `blur(${isCenter ? 0 : 1}px)`,
  zIndex: isCenter ? 10 : 5,
};

// Token icon container
const tokenIconStyle: React.CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  borderRadius: borderRadius.full,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.white,
  boxShadow: shadows.sm,
};

// Pagination dots (max 5 visible)
const dotStyle: React.CSSProperties = mergeStyles(
  {
    width: "0.375rem",
    height: "0.375rem",
    borderRadius: borderRadius.full,
    transition: "all 200ms ease-out",
    backgroundColor: colors.zinc[600],
  },
  isActive && {
    width: "0.75rem",
    backgroundColor: colors.white,
  },
);
```

### 9.8 Circular Progress

```tsx
<svg width={size} height={size}>
  {/* Background circle */}
  <circle
    cx={size / 2} cy={size / 2} r={radius}
    fill="none"
    stroke={colors.muted}
    strokeWidth={strokeWidth}
  />
  {/* Progress circle */}
  <circle
    cx={size / 2} cy={size / 2} r={radius}
    fill="none"
    stroke={colors.primary}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeDasharray={circumference}
    strokeDashoffset={offset}
    style={{ transition: "all 0.5s ease-out" }}
    transform={`rotate(-90 ${size / 2} ${size / 2})`}
  />
</svg>

// Indeterminate mode uses animation class:
// className="tw-animate-spin-slow"
```

### 9.9 Footer Pattern

```tsx
const footerStyle: React.CSSProperties = {
  ...commonStyles.flexCenter,
  gap: spacing[2],
  padding: `${spacing[4]} ${spacing[6]}`,
  borderTop: `1px solid ${colors.border}`,
};

<div style={footerStyle}>
  <Lock style={{ width: "0.875rem", height: "0.875rem", color: colors.mutedForeground }} />
  <span style={{ fontSize: fontSize.sm, color: colors.mutedForeground }}>
    Secured by{' '}
    <span style={{ fontWeight: fontWeight.semibold, color: colors.foreground }}>
      Trustware
    </span>
  </span>
</div>
```

---

## 10. Animation & Motion

### 10.1 Keyframe Definitions

All keyframes are defined in `src/widget-v2/styles/animations.ts` and injected via `<style>` tag. All names use the `tw-` prefix to avoid collisions with host app styles.

| Keyframe | Description |
|----------|-------------|
| `tw-slide-in-right` | Forward page navigation (translateX 1rem → 0) |
| `tw-slide-in-left` | Backward page navigation (translateX -1rem → 0) |
| `tw-fade-in` | Scale 0.95 → 1 with opacity |
| `tw-slide-up` | translateY 20px → 0 with opacity |
| `tw-scale-in` | Scale 0.9 → 1 with opacity |
| `tw-swipe-complete` | Background muted → green |
| `tw-token-hint-bounce` | Vertical bounce (-8px, 5px, -3px) |
| `tw-token-hint-bounce-x` | Horizontal bounce (-10px, 8px, -5px, 3px) |
| `tw-spin` | 360° rotation, 1s |
| `tw-spin-slow` | 360° rotation, 2s |
| `tw-confetti-fall` | translateY → 100vh, rotate 720°, opacity → 0 |
| `tw-pulse` | Opacity 1 → 0.5 → 1 |

### 10.2 Animation Utility Classes

Applied via `className`:

| Class | Animation | Duration |
|-------|-----------|----------|
| `.tw-animate-slide-in-right` | Forward nav | 150ms ease-out |
| `.tw-animate-slide-in-left` | Back nav | 150ms ease-out |
| `.tw-animate-fade-in` | Fade + scale | 300ms ease-out |
| `.tw-animate-slide-up` | Slide up | 400ms ease-out |
| `.tw-animate-scale-in` | Scale in | 300ms cubic-bezier |
| `.tw-animate-swipe-complete` | Swipe done | 300ms forwards |
| `.tw-animate-token-hint-bounce` | Bounce Y | 700ms ease-out |
| `.tw-animate-token-hint-bounce-x` | Bounce X | 800ms ease-out |
| `.tw-animate-spin` | Spinner | 1s linear infinite |
| `.tw-animate-spin-slow` | Slow spinner | 2s linear infinite |
| `.tw-animate-confetti` | Confetti fall | 2s forwards |
| `.tw-animate-pulse` | Pulse | 2s infinite |

### 10.3 Inline Animation Timings

For use with `style={{ animation: ... }}`:

```typescript
import { animationTimings } from "@/widget-v2/styles";

// animationTimings.fadeIn = "tw-fade-in 0.3s ease-out"
// animationTimings.spin  = "tw-spin 1s linear infinite"

<div style={{ animation: animationTimings.fadeIn }}>...</div>
```

### 10.4 Transition Patterns

| Pattern | Inline Style | Duration |
|---------|-------------|----------|
| Color change | `transition: transitions.colors` | 200ms |
| All properties | `transition: transitions.smooth` | 300ms |
| Fast response | `transition: transitions.fast` | 150ms |
| Normal | `transition: transitions.normal` | 200ms |
| Drag response | `transition: "all 75ms"` | 75ms |
| Bounce | `transition: transitions.bounce` | 400ms |

### 10.5 Page Transition Flow

```
Exit (150ms): opacity → 0, translateX ±1rem
Wait: component switch
Enter (150ms): tw-animate-slide-in-right or tw-animate-slide-in-left
```

### 10.6 Haptic Feedback

```typescript
// Light tap (token switch)
if (navigator.vibrate) navigator.vibrate(10);

// Confirmation (swipe complete)
if (navigator.vibrate) navigator.vibrate(50);

// Success pattern
if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
```

---

## 11. Responsive Design

### 11.1 Widget Constraints

The widget is designed as a **fixed-width mobile card** (max 420px). Responsiveness is handled by the widget fitting within its container, not by breakpoint-based layout changes.

```typescript
maxWidth: "420px",
width: "100%",
```

### 11.2 Test Viewports

| Device | Width | Height | Pixel Ratio |
|--------|-------|--------|-------------|
| iPhone SE | 375px | 667px | 2x |
| iPhone 14 Pro | 393px | 852px | 3x |
| iPhone 14 Pro Max | 430px | 932px | 3x |
| iPad Mini | 768px | 1024px | 2x |
| Desktop 1080p | 1920px | 1080px | 1x |

---

## 12. Accessibility Requirements

### 12.1 Focus States

Handled by injected CSS pseudo-state styles:

```css
.trustware-widget button:focus-visible,
.trustware-widget input:focus-visible,
.trustware-widget a:focus-visible {
  outline: 2px solid hsl(var(--tw-ring));
  outline-offset: 2px;
}
```

### 12.2 Disabled States

Handled by injected CSS:

```css
.trustware-widget button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
```

### 12.3 Screen Reader Support

```tsx
// Visually hidden text
<span style={{
  position: "absolute",
  width: "1px", height: "1px",
  padding: 0, margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
}}>
  Close
</span>

// ARIA labels
<button aria-label={`Select ${token.symbol}`} style={buttonStyle} />
```

### 12.4 Color Contrast

| Pairing | Ratio | Status |
|---------|-------|--------|
| `foreground` on `background` | 12.6:1 | AAA |
| `mutedForeground` on `background` | 4.5:1 | AA |
| `primaryForeground` on `primary` | 7.2:1 | AAA |
| `primary` on `background` | 4.8:1 | AA |

---

## 13. Widget State Machine

### 13.1 Navigation Steps

```typescript
type NavigationStep =
  | "home"          // Home screen with deposit options
  | "select-token"  // Chain and token selection
  | "crypto-pay"    // Amount entry, slider, fee summary, swipe-to-confirm
  | "processing"    // Transaction submitted, waiting for confirmation
  | "success"       // Success screen with confetti
  | "error"         // Error screen with retry

// Flow:
// home → select-token → crypto-pay → processing → success
//                                                → error
```

### 13.2 Transaction Status (Within Processing)

```typescript
type TransactionStatus =
  | "idle"
  | "confirming"    // Wallet confirmation pending
  | "processing"    // Transaction submitted
  | "bridging"      // Cross-chain bridge in progress
  | "success"       // Transaction complete
  | "error"         // Transaction failed
```

### 13.3 Page Components

| Step | Component | Key Interactions |
|------|-----------|-----------------|
| `home` | `Home.tsx` | Pay with crypto / Pay with fiat buttons |
| `select-token` | `SelectToken.tsx` | Two-column chain + token picker |
| `crypto-pay` | `CryptoPay.tsx` | Amount slider, token carousel, swipe-to-confirm |
| `processing` | `Processing.tsx` | Circular progress, transaction steps |
| `success` | `Success.tsx` | Confetti, completion message |
| `error` | `Error.tsx` | Error message, retry button |

---

## 14. Validation Protocol

### 14.1 Visual Checklist

```
□ Background color matches design token
□ Card shadows render correctly in both themes
□ Border radius consistent (20px on container)
□ Typography scale matches spec
□ Spacing matches 4px grid
□ Dark mode colors invert correctly
□ No Tailwind classes present in widget code
□ All styles are inline or injected via <style> tag
```

### 14.2 Interaction Audit

```
□ All buttons have focus-visible ring (via injected CSS)
□ Swipe threshold at 80% (drag) or 1.5s (long-press)
□ Drag thumb scales 105% while dragging
□ Spring-back animation plays when released early
□ Success state shows green-500 background
□ Confetti particle count: 50
□ Token carousel swipe threshold: 30px
□ Haptic feedback on swipe complete and token switch
```

### 14.3 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bundle Size | < 50 KB gzip | `npm run size` |
| Animation FPS | 60fps | DevTools |
| First Paint | < 1.0s | Lighthouse |
| LCP | < 2.5s | Lighthouse |
| CLS | < 0.1 | Lighthouse |

### 14.4 Embedding Compatibility

```
□ Works in Vite app without CSS config
□ Works in Next.js app without CSS config
□ Works in CRA app without CSS config
□ No style leakage to host app
□ No host app styles leaking into widget
□ Theme follows data-theme attribute, not host :root
```

---

## Appendix A: File Structure

```
src/widget-v2/
├── TrustwareWidgetV2.tsx           # Main widget with state machine + page transitions
├── styles/
│   ├── index.ts                    # Barrel export
│   ├── tokens.ts                   # Design tokens (colors, spacing, typography, etc.)
│   ├── theme.ts                    # CSS variables for light/dark (injected <style>)
│   ├── animations.ts              # Keyframes + animation classes (injected <style>)
│   └── utils.ts                    # mergeStyles(), commonStyles, helpers
├── context/
│   └── DepositContext.tsx          # Widget state (nav step, selected token, amounts)
├── hooks/
│   ├── index.ts
│   ├── useChains.ts               # Chain data
│   ├── useTokens.ts               # Token data
│   ├── useRouteBuilder.ts         # Quote/route construction
│   ├── useTransactionSubmit.ts    # Transaction submission + receipt
│   └── useTransactionPolling.ts   # Transaction status polling
├── components/
│   ├── WidgetContainer.tsx        # Top-level wrapper, style injection, theme
│   ├── AmountSlider.tsx           # Range slider with snap-to-tick
│   ├── TokenSwipePill.tsx         # Token carousel with swipe gestures
│   ├── SwipeToConfirmTokens.tsx   # Drag + long-press confirmation
│   ├── CircularProgress.tsx       # SVG progress indicator
│   ├── ConfettiEffect.tsx         # Success celebration (50 particles)
│   ├── Toast.tsx                  # Notification component
│   ├── ThemeToggle.tsx            # Light/dark theme switcher
│   ├── TransactionSteps.tsx       # Step progress indicator
│   ├── WalletSelector.tsx         # Wallet picker
│   └── WalletConnectModal.tsx     # WalletConnect QR code modal
├── lib/
│   └── utils.ts                   # cn() for animation classNames
└── pages/
    ├── Home.tsx                    # Step 1: Home screen
    ├── SelectToken.tsx             # Step 2: Chain/token selection
    ├── CryptoPay.tsx               # Step 3: Amount + confirm
    ├── Processing.tsx              # Step 4: Transaction processing
    ├── Success.tsx                 # Step 5: Success
    └── Error.tsx                   # Step 6: Error
```

---

## Appendix B: Quick Reference Card

### Colors (HSL)

```
Primary:      217 91% 60%   (Blue)
Destructive:  0 84% 60%     (Red)
Success:      142 76% 36%   (Green - in keyframes)
Background:   0 0% 98%      (Light) / 220 15% 10% (Dark)
Foreground:   220 15% 20%   (Light) / 0 0% 98% (Dark)
```

### Spacing

```
2px  = spacing[0.5]
4px  = spacing[1]     (tight)
8px  = spacing[2]     (small)
12px = spacing[3]     (card internal)
16px = spacing[4]     (standard)
24px = spacing[6]     (medium)
32px = spacing[8]     (large)
```

### Border Radius

```
~12px  = borderRadius.sm
~14px  = borderRadius.md
16px   = borderRadius.lg
~20px  = borderRadius.xl
9999px = borderRadius.full
```

### Shadows (Themed)

```
soft:   0 2px 8px -2px   (light: 8% opacity / dark: 20% opacity)
medium: 0 4px 16px -4px  (light: 12% opacity / dark: 30% opacity)
large:  0 8px 32px -8px  (light: 16% opacity / dark: 40% opacity)
```

### Style Composition

```typescript
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows, transitions } from "@/widget-v2/styles";
import { mergeStyles, commonStyles } from "@/widget-v2/styles";

// Static styles as constants
const myStyle: React.CSSProperties = {
  backgroundColor: colors.card,
  padding: spacing[4],
  borderRadius: borderRadius.lg,
};

// Conditional styles
<div style={mergeStyles(baseStyle, isActive && activeStyle)} />

// Animation classes
<div className="tw-animate-fade-in" />
```

---

*End of Trustware Design System Specification v2.0.0*
