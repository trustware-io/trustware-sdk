import React from "react";

/**
 * Style object type for inline styles
 */
export type StyleObject = React.CSSProperties;

/**
 * Style input can be a style object, false, null, or undefined (for conditional styles)
 */
export type StyleInput = StyleObject | false | null | undefined;

/**
 * Merges multiple style objects into one.
 * Falsy values are filtered out, allowing conditional styles.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <div style={mergeStyles({ padding: '1rem' }, { backgroundColor: 'red' })} />
 *
 * // Conditional styles
 * <div style={mergeStyles(
 *   { padding: '1rem' },
 *   isActive && { backgroundColor: 'blue' },
 *   isDisabled && { opacity: 0.5 }
 * )} />
 * ```
 */
export function mergeStyles(...styles: StyleInput[]): StyleObject {
  return styles.reduce<StyleObject>((acc, style) => {
    if (!style) return acc;
    return { ...acc, ...style };
  }, {});
}

/**
 * Class name utility for combining CSS class strings.
 * This is a simplified version that just joins non-empty strings.
 * Used for animation classes that must be applied via className.
 *
 * @example
 * ```tsx
 * <div className={cn("tw-animate-fade-in", isActive && "tw-animate-pulse")} />
 * ```
 */
export function cn(
  ...inputs: (string | false | null | undefined)[]
): string {
  return inputs.filter(Boolean).join(" ");
}
