/**
 * Trustware Widget Style System
 *
 * This module provides a complete inline-style-based design system for the widget.
 * It replaces Tailwind CSS to ensure the widget works when embedded in any host app.
 *
 * Components:
 * - tokens: Design tokens (colors, spacing, typography, etc.)
 * - theme: CSS variables for light/dark theming (injected via <style> tag)
 * - animations: Keyframe animations (injected via <style> tag)
 * - utils: Utility functions for working with inline styles
 */

// Design tokens
export * from "./tokens";

// Theme CSS (for injection)
export { ALL_THEME_STYLES } from "./theme";

// Animation CSS (for injection)
export { ALL_ANIMATION_STYLES } from "./animations";
