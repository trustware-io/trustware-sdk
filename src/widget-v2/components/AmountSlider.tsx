import React, { useCallback, useMemo } from "react";
import { cn } from "../lib/utils";

export interface AmountSliderProps {
  /** Current amount value */
  value: number;
  /** Callback when the slider value changes */
  onChange: (value: number) => void;
  /** Maximum amount (e.g., wallet balance or deposit limit) */
  max: number;
  /** Minimum amount (defaults to 0) */
  min?: number;
  /** Additional CSS classes */
  className?: string;
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
  className,
  disabled = false,
}: AmountSliderProps): React.ReactElement {
  /**
   * Generate smart tick marks based on max value with even spacing
   */
  const generateTickMarks = useCallback((maxValue: number): TickMark[] => {
    if (maxValue <= 0) return [{ position: 100, label: "$0", value: 0 }];

    // Define "nice" intervals based on max value
    let interval: number;
    if (maxValue <= 20) {
      interval = 5;
    } else if (maxValue <= 50) {
      interval = 10;
    } else if (maxValue <= 100) {
      interval = 25;
    } else if (maxValue <= 250) {
      interval = 50;
    } else if (maxValue <= 500) {
      interval = 100;
    } else if (maxValue <= 1000) {
      interval = 250;
    } else {
      interval = 500;
    }

    // Generate tick values at each interval
    const tickValues: number[] = [];
    for (let amount = interval; amount < maxValue; amount += interval) {
      tickValues.push(amount);
    }

    // Calculate even spacing - divide 100% by (number of ticks + 1 for Max)
    const totalTicks = tickValues.length + 1; // +1 for Max
    const spacing = 100 / totalTicks;

    // Create ticks with evenly distributed positions
    const ticks: TickMark[] = tickValues.map((amount, index) => ({
      position: spacing * (index + 1),
      label: `$${amount}`,
      value: amount,
    }));

    // Always add Max at the end at 100%
    ticks.push({
      position: 100,
      label: `$${Math.round(maxValue)}`,
      value: maxValue,
    });

    return ticks;
  }, []);

  const tickMarks = useMemo(
    () => generateTickMarks(max),
    [generateTickMarks, max]
  );

  // Snap threshold - 5% of max value for noticeable snap effect
  const snapThreshold = max * 0.05;

  /**
   * Calculate slider position percentage based on value
   * Uses tick positions for exact alignment when snapped to tick
   */
  const getPercentage = useCallback((): number => {
    if (max <= 0) return 0;

    // Check if at zero or min
    if (value <= min) return 0;

    // Check if current value matches a tick mark exactly (snapped)
    for (const tick of tickMarks) {
      if (Math.abs(value - tick.value) < 0.01) {
        return tick.position;
      }
    }

    // Otherwise interpolate between ticks for smooth dragging
    const allPoints = [{ position: 0, value: min }, ...tickMarks];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const lower = allPoints[i];
      const upper = allPoints[i + 1];
      if (value >= lower.value && value <= upper.value) {
        const valueRatio = (value - lower.value) / (upper.value - lower.value);
        return lower.position + valueRatio * (upper.position - lower.position);
      }
    }

    return Math.min(((value - min) / (max - min)) * 100, 100);
  }, [value, max, min, tickMarks]);

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
    <div className={cn("tw-w-full", className)}>
      {/* Slider Track */}
      <div className="tw-relative">
        {/* Labels */}
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-2 tw-px-1">
          <span className="tw-text-xs tw-text-zinc-500 tw-font-medium">
            ${min}
          </span>
          <span className="tw-text-xs tw-text-zinc-500 tw-font-medium">
            Max
          </span>
        </div>

        {/* Track Container */}
        <div className="tw-relative tw-h-10 tw-flex tw-items-center">
          {/* Background Track */}
          <div
            className={cn(
              "tw-absolute tw-inset-x-0 tw-h-2 tw-rounded-full",
              disabled ? "tw-bg-zinc-700/40" : "tw-bg-zinc-700/60"
            )}
          />

          {/* Active Track */}
          <div
            className={cn(
              "tw-absolute tw-left-0 tw-h-2 tw-rounded-full tw-transition-all tw-duration-75",
              disabled ? "tw-bg-emerald-700/50" : "tw-bg-emerald-500"
            )}
            style={{ width: `${percentage}%` }}
          />

          {/* Tick Marks */}
          {tickMarks.map((tick) => {
            const isActive = percentage >= tick.position;
            return (
              <button
                key={tick.position}
                type="button"
                className="tw-absolute tw-top-1/2 tw--translate-y-1/2 tw-p-0 tw-border-0 tw-bg-transparent tw-cursor-pointer tw-outline-none"
                style={{ left: `${tick.position}%` }}
                onClick={() => handleTickClick(tick.value)}
                disabled={disabled}
                aria-label={`Set amount to ${tick.label}`}
              >
                <div
                  className={cn(
                    "tw-w-0.5 tw-h-2.5 tw-rounded-full tw-transition-colors tw--translate-x-1/2",
                    isActive ? "tw-bg-emerald-500/50" : "tw-bg-zinc-500/20"
                  )}
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
            className={cn(
              "tw-absolute tw-inset-0 tw-w-full tw-h-full tw-opacity-0 tw-z-10 tw-touch-none",
              disabled ? "tw-cursor-not-allowed" : "tw-cursor-pointer"
            )}
            style={{
              WebkitAppearance: "none",
            }}
            aria-label="Amount slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={`$${value.toLocaleString()}`}
          />

          {/* Thumb */}
          <div
            className={cn(
              "tw-absolute tw-top-1/2 tw--translate-y-1/2 tw-w-6 tw-h-6 tw-rounded-full tw-shadow-lg tw-pointer-events-none tw-transition-all tw-duration-75",
              disabled
                ? "tw-bg-zinc-600 tw-border-2 tw-border-zinc-500"
                : "tw-bg-white tw-border-2 tw-border-emerald-500"
            )}
            style={{
              left: `calc(${percentage}% - 12px)`,
            }}
          />
        </div>

        {/* Tick Labels */}
        <div className="tw-relative tw-mt-1 tw-h-5">
          {tickMarks.map((tick) => (
            <span
              key={tick.position}
              className={cn(
                "tw-absolute tw-text-[9px] tw-font-medium tw--translate-x-1/2",
                percentage >= tick.position
                  ? "tw-text-zinc-400"
                  : "tw-text-zinc-600"
              )}
              style={{ left: `${tick.position}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      {/* Current Value Display */}
      <div className="tw-mt-3 tw-flex tw-justify-center">
        <div
          className={cn(
            "tw-px-3 tw-py-1 tw-rounded-full tw-text-sm tw-font-semibold",
            disabled
              ? "tw-bg-zinc-800 tw-text-zinc-500"
              : "tw-bg-emerald-500/10 tw-text-emerald-400"
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
