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
 * Creates a style object with a single property.
 * Useful for avoiding object literal creation in render.
 *
 * @example
 * ```tsx
 * <div style={styleIf(isActive, 'backgroundColor', 'blue')} />
 * ```
 */
export function styleIf<K extends keyof StyleObject>(
  condition: boolean,
  property: K,
  value: StyleObject[K]
): StyleObject | undefined {
  return condition ? { [property]: value } : undefined;
}

/**
 * Creates a conditional style object.
 * Returns the style object if condition is true, undefined otherwise.
 *
 * @example
 * ```tsx
 * <div style={mergeStyles(
 *   baseStyles,
 *   conditionalStyle(isActive, { backgroundColor: 'blue' })
 * )} />
 * ```
 */
export function conditionalStyle(
  condition: boolean,
  style: StyleObject
): StyleObject | undefined {
  return condition ? style : undefined;
}

/**
 * Common style patterns for consistency
 */
export const commonStyles = {
  // Flexbox utilities
  flexCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as StyleObject,

  flexCol: {
    display: "flex",
    flexDirection: "column",
  } as StyleObject,

  flexRow: {
    display: "flex",
    flexDirection: "row",
  } as StyleObject,

  flexBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as StyleObject,

  // Position utilities
  absolute: {
    position: "absolute",
  } as StyleObject,

  relative: {
    position: "relative",
  } as StyleObject,

  fixed: {
    position: "fixed",
  } as StyleObject,

  inset0: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  } as StyleObject,

  // Size utilities
  fullWidth: {
    width: "100%",
  } as StyleObject,

  fullHeight: {
    height: "100%",
  } as StyleObject,

  fullSize: {
    width: "100%",
    height: "100%",
  } as StyleObject,

  // Text utilities
  textCenter: {
    textAlign: "center",
  } as StyleObject,

  textLeft: {
    textAlign: "left",
  } as StyleObject,

  textRight: {
    textAlign: "right",
  } as StyleObject,

  // Overflow utilities
  overflowHidden: {
    overflow: "hidden",
  } as StyleObject,

  overflowAuto: {
    overflow: "auto",
  } as StyleObject,

  // Truncate text
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as StyleObject,

  // User select
  selectNone: {
    userSelect: "none",
  } as StyleObject,

  // Pointer events
  pointerEventsNone: {
    pointerEvents: "none",
  } as StyleObject,

  // Shrink prevention
  shrink0: {
    flexShrink: 0,
  } as StyleObject,

  // Button reset
  buttonReset: {
    border: "none",
    background: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
  } as StyleObject,

  // Input reset
  inputReset: {
    border: "none",
    background: "none",
    padding: 0,
    margin: 0,
    outline: "none",
    font: "inherit",
    color: "inherit",
    width: "100%",
  } as StyleObject,

  // Transition utilities
  transitionColors: {
    transition: "color 0.2s, background-color 0.2s, border-color 0.2s",
  } as StyleObject,

  transitionAll: {
    transition: "all 0.2s ease-out",
  } as StyleObject,

  transitionOpacity: {
    transition: "opacity 0.2s ease-out",
  } as StyleObject,

  transitionTransform: {
    transition: "transform 0.2s ease-out",
  } as StyleObject,
} as const;

/**
 * Creates a circle style with given size
 */
export function circleStyle(size: string | number): StyleObject {
  const sizeValue = typeof size === "number" ? `${size}px` : size;
  return {
    width: sizeValue,
    height: sizeValue,
    borderRadius: "9999px",
  };
}

/**
 * Creates a rounded style with given radius
 */
export function roundedStyle(radius: string): StyleObject {
  return {
    borderRadius: radius,
  };
}

/**
 * Creates padding style
 */
export function paddingStyle(
  all: string
): StyleObject;
export function paddingStyle(
  vertical: string,
  horizontal: string
): StyleObject;
export function paddingStyle(
  top: string,
  horizontal: string,
  bottom: string
): StyleObject;
export function paddingStyle(
  top: string,
  right: string,
  bottom: string,
  left: string
): StyleObject;
export function paddingStyle(...args: string[]): StyleObject {
  if (args.length === 1) {
    return { padding: args[0] };
  }
  if (args.length === 2) {
    return { padding: `${args[0]} ${args[1]}` };
  }
  if (args.length === 3) {
    return { padding: `${args[0]} ${args[1]} ${args[2]}` };
  }
  return { padding: `${args[0]} ${args[1]} ${args[2]} ${args[3]}` };
}

/**
 * Creates margin style
 */
export function marginStyle(
  all: string
): StyleObject;
export function marginStyle(
  vertical: string,
  horizontal: string
): StyleObject;
export function marginStyle(
  top: string,
  horizontal: string,
  bottom: string
): StyleObject;
export function marginStyle(
  top: string,
  right: string,
  bottom: string,
  left: string
): StyleObject;
export function marginStyle(...args: string[]): StyleObject {
  if (args.length === 1) {
    return { margin: args[0] };
  }
  if (args.length === 2) {
    return { margin: `${args[0]} ${args[1]}` };
  }
  if (args.length === 3) {
    return { margin: `${args[0]} ${args[1]} ${args[2]}` };
  }
  return { margin: `${args[0]} ${args[1]} ${args[2]} ${args[3]}` };
}

/**
 * Creates gap style for flexbox/grid
 */
export function gapStyle(gap: string): StyleObject {
  return { gap };
}

/**
 * Creates a font style object
 */
export function fontStyle(
  size: string,
  weight: string | number = 400,
  lineHeight: string | number = 1.5
): StyleObject {
  return {
    fontSize: size,
    fontWeight: weight,
    lineHeight,
  };
}
