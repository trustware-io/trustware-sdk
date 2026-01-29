/**
 * Theme CSS styles for injection via <style> tag
 * Contains CSS variables for light/dark themes and pseudo-state styles
 */

/**
 * CSS variables for theming - scoped to .trustware-widget
 * These variables are used by inline styles throughout the widget
 */
export const THEME_STYLES = `
/* CSS Variables for theming - scoped to widget */
.trustware-widget {
  /* Light theme (default) - New design system with bright blue primary */
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

  /* Shadow system */
  --tw-shadow-soft: 0 2px 8px -2px hsl(220 15% 20% / 0.08);
  --tw-shadow-medium: 0 4px 16px -4px hsl(220 15% 20% / 0.12);
  --tw-shadow-large: 0 8px 32px -8px hsl(220 15% 20% / 0.16);

  /* Transitions */
  --tw-transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --tw-transition-bounce: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* Font stack - SF Pro system fonts */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* Box sizing */
  box-sizing: border-box;
}

.trustware-widget *,
.trustware-widget *::before,
.trustware-widget *::after {
  box-sizing: border-box;
}

/* Dark theme */
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

  /* Dark mode shadows (slightly more visible) */
  --tw-shadow-soft: 0 2px 8px -2px hsl(0 0% 0% / 0.2);
  --tw-shadow-medium: 0 4px 16px -4px hsl(0 0% 0% / 0.3);
  --tw-shadow-large: 0 8px 32px -8px hsl(0 0% 0% / 0.4);
}
`;

/**
 * Pseudo-state styles that can't be done with inline styles
 * Kept minimal - only for hover/focus/active states
 */
export const PSEUDO_STYLES = `
/* Reset styles for elements inside widget */
.trustware-widget button {
  font-family: inherit;
  cursor: pointer;
}

.trustware-widget a {
  text-decoration: none;
  color: inherit;
}

.trustware-widget input {
  font-family: inherit;
}

/* Focus visible styles */
.trustware-widget button:focus-visible,
.trustware-widget input:focus-visible,
.trustware-widget a:focus-visible {
  outline: 2px solid hsl(var(--tw-ring));
  outline-offset: 2px;
}

/* Scrollbar hiding - apply to widget and all children */
.trustware-widget,
.trustware-widget *,
.tw-scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.trustware-widget::-webkit-scrollbar,
.trustware-widget *::-webkit-scrollbar,
.tw-scrollbar-none::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* Touch action utility */
.tw-touch-none {
  touch-action: none;
}

/* Safe area utilities */
.tw-safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
.tw-safe-area-top {
  padding-top: env(safe-area-inset-top);
}

/* Disabled state styles */
.trustware-widget button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Selection color */
.trustware-widget ::selection {
  background-color: hsl(var(--tw-primary) / 0.2);
}
`;

/**
 * Combined theme and pseudo-state styles for injection
 */
export const ALL_THEME_STYLES = THEME_STYLES + PSEUDO_STYLES;
