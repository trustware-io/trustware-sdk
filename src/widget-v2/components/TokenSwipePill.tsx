import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "../lib/utils";
import type { Token, Chain } from "../context/DepositContext";

export interface TokenSwipePillProps {
  /** List of tokens to display in the carousel */
  tokens: Token[];
  /** Currently selected token */
  selectedToken: Token;
  /** Callback when a token is selected */
  onTokenChange: (token: Token) => void;
  /** Callback when expand/dropdown button is clicked */
  onExpandClick?: () => void;
  /** Currently selected chain (for displaying chain info) */
  selectedChain?: Chain | null;
  /** Connected wallet address (optional, for display) */
  walletAddress?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Horizontal carousel component for quickly switching between tokens.
 * Supports swipe/drag gestures to navigate between tokens.
 * Displays token icons with pagination dots below.
 */
export function TokenSwipePill({
  tokens,
  selectedToken,
  onTokenChange,
  onExpandClick,
  selectedChain,
  walletAddress,
  className,
}: TokenSwipePillProps): React.ReactElement | null {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current index in tokens array
  const currentIndex = tokens.findIndex(
    (t) => t.address === selectedToken.address && t.symbol === selectedToken.symbol
  );

  const swipeThreshold = 30;
  const hasMultipleTokens = tokens.length > 1;

  /**
   * Calculate position for continuous carousel effect
   */
  const getPosition = (index: number) => {
    const offset = index - currentIndex;
    const total = tokens.length;
    let pos = ((offset % total) + total) % total;
    if (pos > Math.floor(total / 2)) {
      pos = pos - total;
    }
    return pos;
  };

  /**
   * Start drag interaction
   */
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
  }, []);

  /**
   * Handle drag movement
   */
  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return;
      const delta = startXRef.current - clientX;
      setDragOffset(delta);
    },
    [isDragging]
  );

  /**
   * End drag and determine if token should change
   */
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (Math.abs(dragOffset) > swipeThreshold) {
      // Swipe left (positive delta) = next token, swipe right (negative delta) = prev token
      const direction = dragOffset > 0 ? 1 : -1;
      const newIndex = (currentIndex + direction + tokens.length) % tokens.length;

      onTokenChange(tokens[newIndex]);
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }

    setDragOffset(0);
  }, [isDragging, dragOffset, currentIndex, tokens, onTokenChange]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!hasMultipleTokens) return;
    e.preventDefault();
    handleDragStart(e.clientX);
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

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleTokens) return;
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!hasMultipleTokens) return;
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Add/remove global mouse listeners for drag tracking
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

  // Clamp drag offset for visual effect (limit visual range)
  const visualOffset = Math.max(-40, Math.min(40, dragOffset * 0.5));

  /**
   * Generate fallback initials from token symbol
   */
  const getTokenInitials = (symbol: string) => {
    return symbol.slice(0, 2).toUpperCase();
  };

  // Don't render if no tokens
  if (tokens.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "tw-relative tw-inline-flex tw-items-start tw-gap-2 tw-px-4 tw-py-1.5 tw-bg-zinc-800/40 tw-rounded-full tw-border tw-border-zinc-700/50 tw-select-none tw-touch-none",
        hasMultipleTokens && "tw-cursor-grab active:tw-cursor-grabbing",
        isDragging && "tw-bg-zinc-800/60",
        className
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left Section: Carousel + Dots + Wallet Indicator */}
      <div className="tw-flex tw-flex-col tw-items-center">
        <div className="tw-flex tw-items-center tw-h-12">
          {/* Left Chevron Arrow */}
          {hasMultipleTokens && (
            <svg
              className="tw-w-4 tw-h-4 tw-text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          )}

          {/* Carousel Container */}
          <div className="tw-relative tw-flex tw-items-center tw-justify-center tw-h-12 tw-w-20 tw-overflow-hidden">
            {/* Tokens in carousel */}
            {tokens.map((token, index) => {
              const pos = getPosition(index);
              const isCenter = pos === 0;
              const isVisible = Math.abs(pos) <= 1;

              if (!isVisible) return null;

              // Calculate transform based on position + drag offset
              const baseOffset = pos * 32;
              const currentOffset = baseOffset - visualOffset;
              const scale = isCenter ? 1 : 0.6;
              const opacity = isCenter ? 1 : 0.5;
              const blur = isCenter ? 0 : 1;
              const zIndex = isCenter ? 10 : 5;

              return (
                <div
                  key={`${token.address}-${token.symbol}`}
                  className={cn(
                    "tw-absolute tw-transition-all",
                    isDragging ? "tw-duration-75" : "tw-duration-200 tw-ease-out"
                  )}
                  style={{
                    transform: `translateX(${currentOffset}px) scale(${scale})`,
                    opacity,
                    filter: `blur(${blur}px)`,
                    zIndex,
                  }}
                >
                  <div className="tw-relative">
                    <div className="tw-w-10 tw-h-10 tw-rounded-full tw-overflow-hidden tw-flex tw-items-center tw-justify-center tw-bg-white tw-shadow-sm">
                      {token.iconUrl ? (
                        <img
                          src={token.iconUrl}
                          alt={token.symbol}
                          className="tw-w-8 tw-h-8 tw-object-contain"
                        />
                      ) : (
                        <span className="tw-text-xs tw-font-bold tw-text-zinc-800">
                          {getTokenInitials(token.symbol)}
                        </span>
                      )}
                    </div>
                    {/* Chain Icon - only on center token */}
                    {isCenter && selectedChain?.iconUrl && (
                      <div className="tw-absolute tw--bottom-0.5 tw--right-0.5 tw-w-4 tw-h-4 tw-rounded-full tw-bg-zinc-900 tw-border-2 tw-border-zinc-900 tw-flex tw-items-center tw-justify-center tw-overflow-hidden">
                        <img
                          src={selectedChain.iconUrl}
                          alt={selectedChain.name}
                          className="tw-w-3 tw-h-3 tw-rounded-full tw-object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Chevron Arrow */}
          {hasMultipleTokens && (
            <svg
              className="tw-w-4 tw-h-4 tw-text-zinc-500"
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
          )}
        </div>

        {/* Pagination Dots - directly under carousel */}
        {hasMultipleTokens && (
          <div className="tw-flex tw-items-center tw-gap-1.5 tw-mt-1">
            {tokens.map((token, index) => (
              <button
                key={`dot-${token.address}-${token.symbol}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTokenChange(token);
                }}
                className={cn(
                  "tw-h-1.5 tw-rounded-full tw-transition-all tw-duration-200 tw-border-0 tw-outline-none tw-cursor-pointer",
                  index === currentIndex
                    ? "tw-bg-white tw-w-3"
                    : "tw-bg-zinc-600 tw-w-1.5 hover:tw-bg-zinc-500"
                )}
                aria-label={`Select ${token.symbol}`}
              />
            ))}
          </div>
        )}

        {/* Wallet indicator - minimal */}
        {hasMultipleTokens && walletAddress && (
          <div className="tw-flex tw-items-center tw-gap-1 tw-mt-1">
            {/* Wallet icon */}
            <svg
              className="tw-w-3 tw-h-3 tw-text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <span className="tw-text-[10px] tw-text-zinc-500">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="tw-w-px tw-h-8 tw-bg-zinc-700/50 tw-self-center" />

      {/* Token Info with Expand Button */}
      <button
        type="button"
        className="tw-self-center tw-text-left tw-flex tw-items-center tw-gap-2 hover:tw-bg-zinc-700/40 tw-rounded-lg tw-px-2 tw-py-1 tw--mx-1 tw-transition-colors tw-border-0 tw-outline-none tw-cursor-pointer tw-bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          onExpandClick?.();
        }}
      >
        <div>
          <p className="tw-font-semibold tw-text-white tw-text-sm tw-leading-tight tw-m-0">
            {selectedToken.symbol}
          </p>
          {selectedChain && (
            <p className="tw-text-xs tw-text-zinc-400 tw-leading-tight tw-m-0">
              {selectedChain.name}
            </p>
          )}
        </div>
        {/* Chevron Down icon */}
        <svg
          className="tw-w-4 tw-h-4 tw-text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
}

export default TokenSwipePill;
