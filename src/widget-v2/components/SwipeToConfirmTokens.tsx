import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "../lib/utils";
import type { Token } from "../context/DepositContext";

export interface SwipeToConfirmTokensProps {
  /** Token being sent/deposited */
  fromToken: Token;
  /** URL to destination token icon */
  toTokenIcon?: string;
  /** Destination token symbol (e.g., 'USDC') */
  toTokenSymbol?: string;
  /** Destination chain name (e.g., 'Base') */
  toChainName?: string;
  /** Callback when swipe reaches confirmation threshold */
  onConfirm: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether wallet is connected (affects display text) */
  isWalletConnected?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Swipe-to-confirm component with token icons and horizontal drag interaction.
 * Shows the source token icon as draggable thumb and destination token on the right.
 * Triggers onConfirm when the user drags past 80% of the track.
 */
export function SwipeToConfirmTokens({
  fromToken,
  toTokenIcon,
  toTokenSymbol,
  toChainName,
  onConfirm,
  disabled = false,
  isWalletConnected = false,
  className,
}: SwipeToConfirmTokensProps): React.ReactElement {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Long-press state
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<number | null>(null);
  const longPressAnimationRef = useRef<number | null>(null);

  // Constants
  const LONG_PRESS_DURATION = 1500; // 1.5 seconds

  // Dimensions
  const thumbSize = 48;
  const padding = 4;
  const threshold = 0.8; // 80% threshold for confirmation

  /**
   * Calculate the maximum drag distance
   */
  const getMaxDrag = useCallback(() => {
    if (!trackRef.current) return 0;
    return trackRef.current.offsetWidth - thumbSize - padding * 2;
  }, []);

  /**
   * Calculate current progress (0 to 1)
   */
  const getProgress = useCallback(() => {
    const maxDrag = getMaxDrag();
    return maxDrag > 0 ? dragX / maxDrag : 0;
  }, [dragX, getMaxDrag]);

  /**
   * Start drag interaction
   */
  const handleDragStart = useCallback(() => {
    if (disabled || isComplete) return;
    setIsDragging(true);
  }, [disabled, isComplete]);

  /**
   * Handle drag movement
   */
  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging || !trackRef.current || isComplete) return;

      const rect = trackRef.current.getBoundingClientRect();
      const newX = clientX - rect.left - thumbSize / 2 - padding;
      const maxDrag = getMaxDrag();
      const clampedX = Math.max(0, Math.min(newX, maxDrag));

      setDragX(clampedX);
    },
    [isDragging, isComplete, getMaxDrag]
  );

  /**
   * End drag interaction and check for confirmation
   */
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const progress = getProgress();

    if (progress >= threshold) {
      // Snap to end and mark complete
      setDragX(getMaxDrag());
      setIsComplete(true);

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Trigger onConfirm after a brief delay for visual feedback
      setTimeout(() => {
        onConfirm();
      }, 150);
    } else {
      // Reset position smoothly
      setDragX(0);
    }
  }, [isDragging, getProgress, getMaxDrag, onConfirm]);

  /**
   * Trigger confirmation (shared between swipe and long-press)
   */
  const triggerConfirmation = useCallback(() => {
    if (isComplete) return;

    setDragX(getMaxDrag());
    setIsComplete(true);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Trigger onConfirm after a brief delay for visual feedback
    setTimeout(() => {
      onConfirm();
    }, 150);
  }, [isComplete, getMaxDrag, onConfirm]);

  /**
   * Cancel long-press timer
   */
  const cancelLongPress = useCallback(() => {
    setIsLongPressing(false);
    setLongPressProgress(0);
    longPressStartRef.current = null;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressAnimationRef.current) {
      cancelAnimationFrame(longPressAnimationRef.current);
      longPressAnimationRef.current = null;
    }
  }, []);

  /**
   * Start long-press timer
   */
  const startLongPress = useCallback(() => {
    if (disabled || isComplete || isDragging) return;

    setIsLongPressing(true);
    longPressStartRef.current = Date.now();

    // Animate progress
    const animateProgress = () => {
      if (!longPressStartRef.current) return;

      const elapsed = Date.now() - longPressStartRef.current;
      const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1);
      setLongPressProgress(progress);

      if (progress >= 1) {
        // Long press completed
        cancelLongPress();
        triggerConfirmation();
      } else {
        longPressAnimationRef.current = requestAnimationFrame(animateProgress);
      }
    };

    longPressAnimationRef.current = requestAnimationFrame(animateProgress);
  }, [disabled, isComplete, isDragging, triggerConfirmation, cancelLongPress]);

  /**
   * Handle keyboard interaction (Enter key for confirmation)
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || isComplete) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        // Start long-press on key down
        startLongPress();
      }
    },
    [disabled, isComplete, startLongPress]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        cancelLongPress();
      }
    },
    [cancelLongPress]
  );

  // Cleanup long-press on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (longPressAnimationRef.current) {
        cancelAnimationFrame(longPressAnimationRef.current);
      }
    };
  }, []);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleDragMove(e.clientX);
    },
    [handleDragMove]
  );

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Touch event handlers
  const handleTouchStart = (_e: React.TouchEvent) => {
    handleDragStart();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Add/remove global mouse listeners for drag tracking outside element
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const progress = getProgress();

  /**
   * Generate fallback initials for token icons
   */
  const getTokenInitials = (symbol: string) => {
    return symbol.slice(0, 2).toUpperCase();
  };

  // Calculate the effective progress (swipe or long-press)
  const effectiveProgress = isLongPressing ? longPressProgress : progress;

  // Generate aria-label based on state
  const getAriaLabel = () => {
    if (!isWalletConnected) {
      return "Connect your wallet to deposit";
    }
    if (isComplete) {
      return "Transaction confirmed";
    }
    if (isLongPressing) {
      return `Confirming... ${Math.round(longPressProgress * 100)}% complete. Release to cancel.`;
    }
    return `Confirm transaction. Swipe right to confirm, or press and hold for ${LONG_PRESS_DURATION / 1000} seconds. Keyboard: hold Enter or Space.`;
  };

  return (
    <div className={cn("tw-flex tw-flex-col tw-items-center tw-gap-3", className)}>
      {/* Swipe Track */}
      <div
        ref={trackRef}
        role="slider"
        aria-label={getAriaLabel()}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(effectiveProgress * 100)}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={cn(
          "tw-relative tw-h-14 tw-w-full tw-rounded-full tw-overflow-hidden tw-select-none tw-border tw-border-white/10 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-green-500 focus:tw-ring-offset-2 focus:tw-ring-offset-zinc-900",
          disabled && "tw-opacity-50 tw-cursor-not-allowed"
        )}
        style={{
          background:
            effectiveProgress > 0
              ? `linear-gradient(to right, rgb(34, 197, 94) ${effectiveProgress * 100}%, rgb(39, 39, 42) ${effectiveProgress * 100}%)`
              : "rgb(39, 39, 42)",
        }}
      >
        {/* "Swipe to confirm" or "Connect wallet" text */}
        <div
          className={cn(
            "tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-transition-opacity tw-duration-200",
            effectiveProgress > 0.15 && "tw-opacity-0"
          )}
        >
          <span className="tw-text-sm tw-text-white tw-font-bold">
            {isWalletConnected
              ? "Swipe to confirm"
              : "Connect your wallet to deposit"}
          </span>
        </div>

        {/* Long-press countdown indicator */}
        {isLongPressing && !isComplete && (
          <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
            <div className="tw-flex tw-items-center tw-gap-2">
              {/* Circular countdown indicator */}
              <svg
                className="tw-w-8 tw-h-8 tw--rotate-90"
                viewBox="0 0 36 36"
              >
                <circle
                  className="tw-text-zinc-600"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="transparent"
                  r="15.9155"
                  cx="18"
                  cy="18"
                />
                <circle
                  className="tw-text-white tw-transition-all tw-duration-100"
                  strokeWidth="3"
                  strokeDasharray={`${longPressProgress * 100}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="15.9155"
                  cx="18"
                  cy="18"
                />
              </svg>
              <span className="tw-text-sm tw-text-white tw-font-bold">
                {Math.ceil((1 - longPressProgress) * (LONG_PRESS_DURATION / 1000) * 10) / 10}s
              </span>
            </div>
          </div>
        )}

        {/* Checkmark indicator when complete */}
        {isComplete && (
          <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
            <svg
              className="tw-w-6 tw-h-6 tw-text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}

        {/* Draggable Thumb - Token icon */}
        <div
          ref={thumbRef}
          className={cn(
            "tw-absolute tw-top-1/2 tw--translate-y-1/2 tw-w-12 tw-h-12 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-cursor-grab active:tw-cursor-grabbing tw-z-10 tw-bg-zinc-800",
            isDragging && "tw-scale-105",
            isLongPressing && "tw-scale-110 tw-ring-2 tw-ring-green-500",
            isComplete && "tw-bg-green-500"
          )}
          style={{
            left: `${dragX + padding}px`,
            transition: isDragging
              ? "transform 0.1s"
              : "left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s",
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {fromToken.iconUrl ? (
            <img
              src={fromToken.iconUrl}
              alt={fromToken.symbol}
              className="tw-w-10 tw-h-10 tw-object-contain tw-rounded-full"
            />
          ) : (
            <span className="tw-text-sm tw-font-bold tw-text-white">
              {getTokenInitials(fromToken.symbol)}
            </span>
          )}
        </div>

        {/* Destination Icon - Becomes more visible as you drag closer */}
        {toTokenIcon && (
          <div
            className="tw-absolute tw-top-1/2 tw--translate-y-1/2 tw-w-12 tw-h-12 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-transition-opacity"
            style={{
              right: `${padding}px`,
              opacity: 0.2 + effectiveProgress * 0.8,
            }}
          >
            <img
              src={toTokenIcon}
              alt={toTokenSymbol || "destination"}
              className="tw-w-10 tw-h-10 tw-object-contain tw-rounded-full"
            />
          </div>
        )}

        {/* Chevron arrow hint (when no destination icon) */}
        {!toTokenIcon && !isComplete && (
          <div
            className="tw-absolute tw-top-1/2 tw--translate-y-1/2 tw-w-12 tw-h-12 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-transition-opacity"
            style={{
              right: `${padding}px`,
              opacity: 0.3 + effectiveProgress * 0.7,
            }}
          >
            <svg
              className="tw-w-6 tw-h-6 tw-text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Token to Chain label below - only show when wallet connected */}
      {isWalletConnected && toChainName && (
        <span className="tw-text-xs tw-text-zinc-400">
          {fromToken.symbol} → {toTokenSymbol || ""} on {toChainName}
        </span>
      )}
    </div>
  );
}

export default SwipeToConfirmTokens;
