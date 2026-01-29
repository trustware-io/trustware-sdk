import React, { useState, useRef, useCallback, useEffect } from "react";
import { mergeStyles } from "../lib/utils";
import { colors, spacing, fontSize, fontWeight } from "../styles/tokens";
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
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: spacing[3],
};

const trackStyle: React.CSSProperties = {
  position: "relative",
  height: "3.5rem",
  width: "100%",
  borderRadius: "9999px",
  overflow: "hidden",
  userSelect: "none",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  outline: "none",
};

const trackTextStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.2s",
};

const swipeTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.white,
  fontWeight: fontWeight.bold,
};

const countdownContainerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const countdownInnerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
};

const countdownTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.white,
  fontWeight: fontWeight.bold,
};

const checkmarkContainerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const thumbStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "3rem",
  height: "3rem",
  borderRadius: "9999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "grab",
  zIndex: 10,
  backgroundColor: colors.zinc[800],
};

const tokenIconStyle: React.CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  objectFit: "contain",
  borderRadius: "9999px",
};

const destinationIconStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "3rem",
  height: "3rem",
  borderRadius: "9999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.2s",
};

const chevronIconStyle: React.CSSProperties = {
  width: "1.5rem",
  height: "1.5rem",
  color: colors.white,
};

const labelStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  color: colors.zinc[400],
};

/**
 * Swipe-to-confirm component with token icons and horizontal drag interaction.
 */
export function SwipeToConfirmTokens({
  fromToken,
  toTokenIcon,
  toTokenSymbol,
  toChainName,
  onConfirm,
  disabled = false,
  isWalletConnected = false,
  style,
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
  const LONG_PRESS_DURATION = 1500;
  const thumbSize = 48;
  const padding = 4;
  const threshold = 0.8;

  const getMaxDrag = useCallback(() => {
    if (!trackRef.current) return 0;
    return trackRef.current.offsetWidth - thumbSize - padding * 2;
  }, []);

  const getProgress = useCallback(() => {
    const maxDrag = getMaxDrag();
    return maxDrag > 0 ? dragX / maxDrag : 0;
  }, [dragX, getMaxDrag]);

  const handleDragStart = useCallback(() => {
    if (disabled || isComplete) return;
    setIsDragging(true);
  }, [disabled, isComplete]);

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

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const progress = getProgress();
    if (progress >= threshold) {
      setDragX(getMaxDrag());
      setIsComplete(true);
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => onConfirm(), 150);
    } else {
      setDragX(0);
    }
  }, [isDragging, getProgress, getMaxDrag, onConfirm]);

  const triggerConfirmation = useCallback(() => {
    if (isComplete) return;
    setDragX(getMaxDrag());
    setIsComplete(true);
    if (navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => onConfirm(), 150);
  }, [isComplete, getMaxDrag, onConfirm]);

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

  const startLongPress = useCallback(() => {
    if (disabled || isComplete || isDragging) return;
    setIsLongPressing(true);
    longPressStartRef.current = Date.now();
    const animateProgress = () => {
      if (!longPressStartRef.current) return;
      const elapsed = Date.now() - longPressStartRef.current;
      const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1);
      setLongPressProgress(progress);
      if (progress >= 1) {
        cancelLongPress();
        triggerConfirmation();
      } else {
        longPressAnimationRef.current = requestAnimationFrame(animateProgress);
      }
    };
    longPressAnimationRef.current = requestAnimationFrame(animateProgress);
  }, [disabled, isComplete, isDragging, triggerConfirmation, cancelLongPress]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || isComplete) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
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

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (longPressAnimationRef.current) cancelAnimationFrame(longPressAnimationRef.current);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => handleDragMove(e.clientX),
    [handleDragMove]
  );

  const handleMouseUp = useCallback(() => handleDragEnd(), [handleDragEnd]);

  const handleTouchStart = (_e: React.TouchEvent) => handleDragStart();
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX);
  const handleTouchEnd = () => handleDragEnd();

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
  const effectiveProgress = isLongPressing ? longPressProgress : progress;

  const getTokenInitials = (symbol: string) => symbol.slice(0, 2).toUpperCase();

  const getAriaLabel = () => {
    if (!isWalletConnected) return "Connect your wallet to deposit";
    if (isComplete) return "Transaction confirmed";
    if (isLongPressing) return `Confirming... ${Math.round(longPressProgress * 100)}% complete.`;
    return `Confirm transaction. Swipe right to confirm.`;
  };

  const trackBg = effectiveProgress > 0
    ? `linear-gradient(to right, rgb(34, 197, 94) ${effectiveProgress * 100}%, rgb(39, 39, 42) ${effectiveProgress * 100}%)`
    : "rgb(39, 39, 42)";

  return (
    <div style={mergeStyles(containerStyle, style)}>
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
        style={mergeStyles(
          trackStyle,
          { background: trackBg },
          disabled && { opacity: 0.5, cursor: "not-allowed" }
        )}
      >
        {/* Swipe text */}
        <div style={mergeStyles(trackTextStyle, effectiveProgress > 0.15 && { opacity: 0 })}>
          <span style={swipeTextStyle}>
            {isWalletConnected ? "Swipe to confirm" : "Connect your wallet to deposit"}
          </span>
        </div>

        {/* Long-press countdown */}
        {isLongPressing && !isComplete && (
          <div style={countdownContainerStyle}>
            <div style={countdownInnerStyle}>
              <svg style={{ width: "2rem", height: "2rem", transform: "rotate(-90deg)" }} viewBox="0 0 36 36">
                <circle stroke={colors.zinc[600]} strokeWidth="3" fill="transparent" r="15.9155" cx="18" cy="18" />
                <circle
                  stroke={colors.white}
                  strokeWidth="3"
                  strokeDasharray={`${longPressProgress * 100}, 100`}
                  strokeLinecap="round"
                  fill="transparent"
                  r="15.9155"
                  cx="18"
                  cy="18"
                  style={{ transition: "all 100ms" }}
                />
              </svg>
              <span style={countdownTextStyle}>
                {Math.ceil((1 - longPressProgress) * (LONG_PRESS_DURATION / 1000) * 10) / 10}s
              </span>
            </div>
          </div>
        )}

        {/* Checkmark on complete */}
        {isComplete && (
          <div style={checkmarkContainerStyle}>
            <svg style={{ width: "1.5rem", height: "1.5rem", color: colors.white }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Draggable Thumb */}
        <div
          ref={thumbRef}
          style={mergeStyles(
            thumbStyle,
            { left: `${dragX + padding}px` },
            { transition: isDragging ? "transform 0.1s" : "left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s" },
            isDragging && { transform: "translateY(-50%) scale(1.05)" },
            isLongPressing && { transform: "translateY(-50%) scale(1.1)", boxShadow: `0 0 0 2px ${colors.green[500]}` },
            isComplete && { backgroundColor: colors.green[500] }
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {fromToken.iconUrl ? (
            <img src={fromToken.iconUrl} alt={fromToken.symbol} style={tokenIconStyle} />
          ) : (
            <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.white }}>
              {getTokenInitials(fromToken.symbol)}
            </span>
          )}
        </div>

        {/* Destination Icon */}
        {toTokenIcon && (
          <div style={mergeStyles(destinationIconStyle, { right: `${padding}px`, opacity: 0.2 + effectiveProgress * 0.8 })}>
            <img src={toTokenIcon} alt={toTokenSymbol || "destination"} style={tokenIconStyle} />
          </div>
        )}

        {/* Chevron hint */}
        {!toTokenIcon && !isComplete && (
          <div style={mergeStyles(destinationIconStyle, { right: `${padding}px`, opacity: 0.3 + effectiveProgress * 0.7 })}>
            <svg style={chevronIconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      {isWalletConnected && toChainName && (
        <span style={labelStyle}>
          {fromToken.symbol} → {toTokenSymbol || ""} on {toChainName}
        </span>
      )}
    </div>
  );
}

export default SwipeToConfirmTokens;
