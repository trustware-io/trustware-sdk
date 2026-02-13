import React, { useCallback, useMemo } from "react";
import { mergeStyles } from "../lib/utils";
import { colors, spacing, fontSize, fontWeight } from "../styles/tokens";

export interface AmountSliderProps {
  /** Current amount value */
  value: number;
  /** Callback when the slider value changes */
  onChange: (value: number) => void;
  /** Maximum amount (e.g., wallet balance or deposit limit) */
  max: number;
  /** Minimum amount (defaults to 0) */
  min?: number;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Whether the slider is disabled */
  disabled?: boolean;
}

/**
 * Tick mark configuration for slider labels
 */
interface TickMark {
  position: number;
  label: string;
  value: number;
}

const containerStyle: React.CSSProperties = {
  width: "100%",
};

const labelsContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: spacing[2],
  padding: `0 ${spacing[1]}`,
};

const labelStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  color: colors.zinc[500],
  fontWeight: fontWeight.medium,
};

const trackContainerStyle: React.CSSProperties = {
  position: "relative",
  height: "3rem",
  display: "flex",
  alignItems: "center",
};

const backgroundTrackStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: "0.625rem",
  borderRadius: "9999px",
  backgroundColor: "rgba(63, 63, 70, 0.8)",
  boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.2)",
};

const activeTrackStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  height: "0.625rem",
  borderRadius: "9999px",
  background: `linear-gradient(90deg, ${colors.emerald[500]}, ${colors.emerald[400]})`,
  boxShadow: `0 0 8px ${colors.emerald[500]}40`,
  transition: "all 75ms",
};

const tickButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  padding: "0.5rem",
  margin: "-0.5rem",
  border: 0,
  backgroundColor: "transparent",
  cursor: "pointer",
  outline: "none",
};

const tickMarkStyle: React.CSSProperties = {
  width: "3px",
  height: "0.875rem",
  borderRadius: "9999px",
  transition: "all 0.2s",
  transform: "translateX(-50%)",
};

const rangeInputStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  zIndex: 10,
  touchAction: "none",
  cursor: "pointer",
  WebkitAppearance: "none",
  appearance: "none",
};

const thumbStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "1.75rem",
  height: "1.75rem",
  borderRadius: "9999px",
  boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 3px ${colors.emerald[500]}30`,
  pointerEvents: "none",
  transition: "all 75ms",
  backgroundColor: colors.white,
  border: `3px solid ${colors.emerald[500]}`,
};

const tickLabelsContainerStyle: React.CSSProperties = {
  position: "relative",
  marginTop: spacing[2],
  height: "1.25rem",
};

const tickLabelStyle: React.CSSProperties = {
  position: "absolute",
  fontSize: "10px",
  fontWeight: fontWeight.semibold,
  transform: "translateX(-50%)",
  letterSpacing: "-0.01em",
};

const valueDisplayContainerStyle: React.CSSProperties = {
  marginTop: spacing[4],
  display: "flex",
  justifyContent: "center",
};

const valueDisplayStyle: React.CSSProperties = {
  padding: `${spacing[1.5]} ${spacing[4]}`,
  borderRadius: "9999px",
  fontSize: fontSize.base,
  fontWeight: fontWeight.bold,
  backgroundColor: "rgba(16, 185, 129, 0.15)",
  color: colors.emerald[400],
  border: `1px solid ${colors.emerald[500]}30`,
  letterSpacing: "-0.01em",
};

// Helper to round to nice numbers based on the range
const roundToNiceNumber = (value: number, range: number): number => {
  // Determine appropriate rounding precision
  let roundingFactor: number;

  if (range < 0.5) {
    roundingFactor = 1000; // Round to 0.001
  } else if (range < 1) {
    roundingFactor = 500; // Round to 0.002
  } else if (range < 5) {
    roundingFactor = 100; // Round to 0.01
  } else if (range < 10) {
    roundingFactor = 50; // Round to 0.02
  } else if (range < 50) {
    roundingFactor = 10; // Round to 0.1
  } else if (range < 100) {
    roundingFactor = 5; // Round to 0.2
  } else if (range < 500) {
    roundingFactor = 1; // Round to 1
  } else if (range < 1000) {
    roundingFactor = 5; // Round to 5
  } else if (range < 5000) {
    roundingFactor = 10; // Round to 10
  } else if (range < 10000) {
    roundingFactor = 50; // Round to 50
  } else {
    roundingFactor = 100; // Round to 100
  }

  return Math.round(value * roundingFactor) / roundingFactor;
};

// Format values appropriately
const formatValue = (value: number): string => {
  // Remove unnecessary decimal places
  if (value % 1 === 0) {
    return Math.round(value).toString();
  }

  // For values with decimals, show 1-2 decimal places based on size
  if (value < 1) {
    // Show up to 3 decimal places for very small values
    return parseFloat(value.toFixed(3)).toString();
  } else if (value < 10) {
    // Show up to 2 decimal places for small values
    return parseFloat(value.toFixed(2)).toString();
  } else if (value < 1000) {
    // Show up to 1 decimal place for medium values
    return parseFloat(value.toFixed(1)).toString();
  }

  // For large values, round to nearest integer
  return Math.round(value).toLocaleString();
};

/**
 * Range slider component for quickly adjusting deposit amounts.
 * Features:
 * - Smart tick marks that adapt to the max value
 * - Snap-to-tick behavior for precise amounts
 * - Smooth drag interaction
 * - Bidirectional sync with amount input
 */
export function AmountSlider({
  value,
  onChange,
  max,
  min = 0,
  style,
  disabled = false,
}: AmountSliderProps): React.ReactElement {
  /**
   * Generate smart tick marks based on the [min, max] range with even spacing
   */

  const generateTickMarks = useCallback(
    (minValue: number, maxValue: number): TickMark[] => {
      const range = maxValue - minValue;

      // For very small or zero range
      if (range <= 0) {
        return [
          {
            position: 100,
            label: `$${formatValue(maxValue)}`,
            value: maxValue,
          },
        ];
      }

      // Always create 5 evenly spaced points (min + 3 intermediate + max)
      // We'll return 4 tick marks (max + 3 intermediate), min will be handled separately
      const totalPoints = 5; // min + 3 intermediate + max
      const spacingPercent = 100 / (totalPoints - 1); // 25% spacing

      // Calculate nice rounded values for each intermediate position
      const ticks: TickMark[] = [];

      // First intermediate point (25%)
      const value1 = minValue + (range * 1) / 4;
      const niceValue1 = roundToNiceNumber(value1, range);

      // Second intermediate point (50%)
      const value2 = minValue + (range * 2) / 4;
      const niceValue2 = roundToNiceNumber(value2, range);

      // Third intermediate point (75%)
      const value3 = minValue + (range * 3) / 4;
      const niceValue3 = roundToNiceNumber(value3, range);

      // Add first intermediate tick (25%)
      ticks.push({
        position: spacingPercent * 1, // 25%
        label: `$${formatValue(niceValue1)}`,
        value: niceValue1,
      });

      // Add second intermediate tick (50%)
      ticks.push({
        position: spacingPercent * 2, // 50%
        label: `$${formatValue(niceValue2)}`,
        value: niceValue2,
      });

      // Add third intermediate tick (75%)
      ticks.push({
        position: spacingPercent * 3, // 75%
        label: `$${formatValue(niceValue3)}`,
        value: niceValue3,
      });

      // Always add Max at the end (100%)
      ticks.push({
        position: 100,
        label: `$${formatValue(maxValue)}`,
        value: maxValue,
      });

      console.log({ ticks, minValue, maxValue, range });
      return ticks;
    },
    []
  );

  const tickMarks = useMemo(
    () => generateTickMarks(min, max),
    [generateTickMarks, min, max]
  );

  /**
   * Calculate slider position percentage based on value
   * Uses tick positions for exact alignment when snapped to tick
   */
  const getPercentage = useCallback((): number => {
    if (max <= 0) return 0;

    // Check if at zero or min
    if (value <= min) return 0;

    // Create array of all points including min
    const allPoints = [
      { position: 0, value: min },
      ...tickMarks.filter((tick) => tick.position !== 0), // Ensure min isn't duplicated
    ];

    // Sort by position just in case
    allPoints.sort((a, b) => a.position - b.position);

    // Check if current value matches any point exactly
    for (const point of allPoints) {
      if (Math.abs(value - point.value) < 0.01) {
        return point.position;
      }
    }

    // Interpolate between points
    for (let i = 0; i < allPoints.length - 1; i++) {
      const lower = allPoints[i];
      const upper = allPoints[i + 1];
      if (value >= lower.value && value <= upper.value) {
        const valueRatio = (value - lower.value) / (upper.value - lower.value);
        return lower.position + valueRatio * (upper.position - lower.position);
      }
    }

    return Math.min(((value - min) / (max - min)) * 100, 100);
  }, [max, min, tickMarks, value]);

  // Snap threshold - 5% of max value for noticeable snap effect
  const snapThreshold = max * 0.05;

  const percentage = useMemo(() => getPercentage(), [getPercentage]);

  /**
   * Handle slider input change with snap-to-tick behavior
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = Math.min(Math.max(Number(e.target.value), min), max);

      // Check if close to any tick mark and snap to it
      for (const tick of tickMarks) {
        if (Math.abs(newValue - tick.value) <= snapThreshold) {
          newValue = tick.value;
          break;
        }
      }

      // Also snap to min if close
      if (newValue <= min + snapThreshold) {
        newValue = min;
      }

      onChange(newValue);
    },
    [onChange, min, max, tickMarks, snapThreshold]
  );

  /**
   * Handle clicking on a tick mark to jump to that value
   */
  const handleTickClick = useCallback(
    (tickValue: number) => {
      if (disabled) return;
      onChange(tickValue);
    },
    [onChange, disabled]
  );

  return (
    <div style={mergeStyles(containerStyle, style)}>
      {/* Slider Track */}
      <div style={{ position: "relative" }}>
        {/* Labels */}
        <div style={labelsContainerStyle}>
          <span style={labelStyle}>
            ${min}
            {min > 0 ? " Min" : ""}
          </span>
          <span style={labelStyle}>Max</span>
        </div>

        {/* Track Container */}
        <div style={trackContainerStyle}>
          {/* Background Track */}
          <div
            style={mergeStyles(
              backgroundTrackStyle,
              disabled && { backgroundColor: "rgba(63, 63, 70, 0.4)" }
            )}
          />

          {/* Active Track */}
          <div
            style={mergeStyles(
              activeTrackStyle,
              { width: `${percentage}%` },
              disabled && { backgroundColor: "rgba(4, 120, 87, 0.5)" }
            )}
          />

          {/* Tick Marks */}
          {tickMarks.map((tick) => {
            const isActive = percentage >= tick.position;
            return (
              <button
                key={tick.position}
                type="button"
                style={mergeStyles(tickButtonStyle, {
                  left: `${tick.position}%`,
                })}
                onClick={() => handleTickClick(tick.value)}
                disabled={disabled}
                aria-label={`Set amount to ${tick.label}`}
              >
                <div
                  style={mergeStyles(tickMarkStyle, {
                    backgroundColor: isActive
                      ? colors.emerald[400]
                      : colors.zinc[600],
                    boxShadow: isActive
                      ? `0 0 4px ${colors.emerald[500]}40`
                      : "none",
                  })}
                />
              </button>
            );
          })}

          {/* Range Input */}
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            style={mergeStyles(
              rangeInputStyle,
              disabled && { cursor: "not-allowed" }
            )}
            aria-label="Amount slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={`$${value.toLocaleString()}`}
          />

          {/* Thumb */}
          <div
            style={mergeStyles(
              thumbStyle,
              { left: `calc(${percentage}% - 12px)` },
              disabled && {
                backgroundColor: colors.zinc[600],
                border: `2px solid ${colors.zinc[500]}`,
              }
            )}
          />
        </div>

        {/* Tick Labels */}
        <div style={tickLabelsContainerStyle}>
          {tickMarks.map((tick) => (
            <span
              key={tick.position}
              style={mergeStyles(
                tickLabelStyle,
                { left: `${tick.position}%` },
                {
                  color:
                    percentage >= tick.position
                      ? colors.zinc[400]
                      : colors.zinc[600],
                }
              )}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      {/* Current Value Display */}
      <div style={valueDisplayContainerStyle}>
        <div
          style={mergeStyles(
            valueDisplayStyle,
            disabled && {
              backgroundColor: colors.zinc[800],
              color: colors.zinc[500],
            }
          )}
        >
          $
          {value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>
    </div>
  );
}

export default AmountSlider;
