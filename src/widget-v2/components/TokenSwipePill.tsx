import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { mergeStyles } from "../lib/utils";
import { colors, spacing, fontSize, fontWeight } from "../styles/tokens";
import type { Token, Chain, YourTokenData } from "../context/DepositContext";

export interface TokenSwipePillProps {
  /** List of tokens to display in the carousel */
  tokens: Token[] | YourTokenData[];
  /** Currently selected token */
  selectedToken: Token | YourTokenData;
  /** Callback when a token is selected */
  onTokenChange: (token: Token | YourTokenData) => void;
  /** Callback when expand/dropdown button is clicked */
  onExpandClick?: () => void;
  /** Currently selected chain (for displaying chain info) */
  selectedChain?: Chain | null;
  /** Connected wallet address (optional, for display) */
  walletAddress?: string | null;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const containerStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "flex-start",
  gap: spacing[2],
  padding: `${spacing[1.5]} ${spacing[4]}`,
  backgroundColor: "rgba(39, 39, 42, 0.4)",
  borderRadius: "9999px",
  border: "1px solid rgba(63, 63, 70, 0.5)",
  userSelect: "none",
  touchAction: "none",
};

const leftSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const carouselRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: "3rem",
};

const chevronStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  color: colors.zinc[500],
};

const carouselContainerStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "3rem",
  width: "5rem",
  overflow: "hidden",
};

const tokenIconContainerStyle: React.CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  borderRadius: "9999px",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.white,
  boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
};

const tokenIconStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  objectFit: "contain",
};

const tokenInitialsStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.bold,
  color: colors.zinc[800],
};

const chainIconContainerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "-2px",
  right: "-2px",
  width: "1rem",
  height: "1rem",
  borderRadius: "9999px",
  backgroundColor: colors.zinc[900],
  border: `2px solid ${colors.zinc[900]}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const chainIconStyle: React.CSSProperties = {
  width: "0.75rem",
  height: "0.75rem",
  borderRadius: "9999px",
  objectFit: "cover",
};

const paginationContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  marginTop: spacing[1],
};

/**
 * Max number of pagination dots to show
 * When there are more tokens, we show a subset with ellipsis-like behavior
 */
const MAX_VISIBLE_DOTS = 5;

const walletIndicatorStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  marginTop: spacing[1],
};

const walletIconStyle: React.CSSProperties = {
  width: "0.75rem",
  height: "0.75rem",
  color: colors.zinc[500],
};

const walletAddressStyle: React.CSSProperties = {
  fontSize: "10px",
  color: colors.zinc[500],
};

const dividerStyle: React.CSSProperties = {
  width: "1px",
  height: "2rem",
  backgroundColor: "rgba(63, 63, 70, 0.5)",
  alignSelf: "center",
};

const tokenInfoButtonStyle: React.CSSProperties = {
  alignSelf: "center",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  borderRadius: "0.5rem",
  padding: `${spacing[1]} ${spacing[2]}`,
  margin: `0 -${spacing[1]}`,
  transition: "background-color 0.2s",
  border: 0,
  outline: "none",
  cursor: "pointer",
  backgroundColor: "transparent",
};

const tokenSymbolStyle: React.CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: colors.white,
  fontSize: fontSize.sm,
  lineHeight: 1.25,
  margin: 0,
};

const chainNameStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  color: colors.zinc[400],
  lineHeight: 1.25,
  margin: 0,
};

const expandChevronStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  color: colors.zinc[400],
};

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
  // selectedChain,
  walletAddress,
  style,
}: TokenSwipePillProps): React.ReactElement | null {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current index in tokens array
  const currentIndex = tokens.findIndex(
    (t) =>
      t.address === selectedToken.address && t.symbol === selectedToken.symbol
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
      const newIndex =
        (currentIndex + direction + tokens.length) % tokens.length;

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
    return symbol?.slice(0, 2).toUpperCase();
  };

  // Don't render if no tokens
  if (tokens.length === 0) {
    return null;
  }

  const chainBadge = useMemo(() => {
    const url =
      (selectedToken as YourTokenData).chainData?.chainIconURI ||
      (
        (selectedToken as YourTokenData)
          .chainData as YourTokenData["chainData"] & {
          iconUrl: string;
        }
      )?.iconUrl;
    return url?.toString();
  }, [selectedToken]);

  return (
    <div
      ref={containerRef}
      style={mergeStyles(
        containerStyle,
        hasMultipleTokens && { cursor: "grab" },
        isDragging && { backgroundColor: "rgba(39, 39, 42, 0.6)" },
        style
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left Section: Carousel + Dots + Wallet Indicator */}
      <div style={leftSectionStyle}>
        <div style={carouselRowStyle}>
          {/* Left Chevron Arrow */}
          {hasMultipleTokens && (
            <svg
              style={chevronStyle}
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
          <div style={carouselContainerStyle}>
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
              const zIndexVal = isCenter ? 10 : 5;

              return (
                <div
                  key={`carousel-${index}-${token.address}`}
                  style={{
                    position: "absolute",
                    transition: isDragging ? "all 75ms" : "all 200ms ease-out",
                    transform: `translateX(${currentOffset}px) scale(${scale})`,
                    opacity,
                    filter: `blur(${blur}px)`,
                    zIndex: zIndexVal,
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <div style={tokenIconContainerStyle}>
                      {token.iconUrl ? (
                        <img
                          src={token.iconUrl}
                          alt={token.symbol}
                          style={tokenIconStyle}
                        />
                      ) : (
                        <span style={tokenInitialsStyle}>
                          {getTokenInitials(token.symbol as string)}
                        </span>
                      )}
                    </div>
                    {/* Chain Icon - only on center token */}

                    {isCenter && (selectedToken as YourTokenData).chainData && (
                      <div style={chainIconContainerStyle}>
                        <img
                          src={chainBadge}
                          alt={
                            (selectedToken as YourTokenData).chainData
                              ?.networkName
                          }
                          style={chainIconStyle}
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
              style={chevronStyle}
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
          <div style={paginationContainerStyle}>
            {(() => {
              const total = tokens.length;

              // If we have few tokens, show all dots
              if (total <= MAX_VISIBLE_DOTS) {
                return tokens.map((token, index) => (
                  <button
                    key={`dot-${index}-${token.address}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTokenChange(token);
                    }}
                    style={{
                      height: "0.375rem",
                      borderRadius: "9999px",
                      transition: "all 0.2s",
                      border: 0,
                      outline: "none",
                      cursor: "pointer",
                      backgroundColor:
                        index === currentIndex
                          ? colors.white
                          : colors.zinc[600],
                      width: index === currentIndex ? "0.75rem" : "0.375rem",
                    }}
                    aria-label={`Select ${token.symbol}`}
                  />
                ));
              }

              // For many tokens, show limited dots with scaling effect
              // Show: first, prev, current, next, last (when applicable)
              const visibleIndices: number[] = [];

              // Always show first
              visibleIndices.push(0);

              // Show dots around current
              if (currentIndex > 1) {
                visibleIndices.push(currentIndex - 1);
              }
              if (currentIndex > 0 && currentIndex < total - 1) {
                visibleIndices.push(currentIndex);
              }
              if (currentIndex < total - 2) {
                visibleIndices.push(currentIndex + 1);
              }

              // Always show last
              if (total > 1) {
                visibleIndices.push(total - 1);
              }

              // Dedupe and sort
              const uniqueIndices = [...new Set(visibleIndices)].sort(
                (a, b) => a - b
              );

              return uniqueIndices.map((index, i) => {
                const token = tokens[index];
                const prevIndex = uniqueIndices[i - 1];
                const showGap = i > 0 && index - prevIndex > 1;

                return (
                  <React.Fragment key={`dot-${index}-${token.address}`}>
                    {/* Gap indicator for skipped tokens */}
                    {showGap && (
                      <span
                        style={{
                          width: "0.25rem",
                          height: "0.25rem",
                          borderRadius: "9999px",
                          backgroundColor: colors.zinc[700],
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTokenChange(token);
                      }}
                      style={{
                        height: "0.375rem",
                        borderRadius: "9999px",
                        transition: "all 0.2s",
                        border: 0,
                        outline: "none",
                        cursor: "pointer",
                        backgroundColor:
                          index === currentIndex
                            ? colors.white
                            : colors.zinc[600],
                        width: index === currentIndex ? "0.75rem" : "0.375rem",
                      }}
                      aria-label={`Select ${token.symbol} (${index + 1} of ${total})`}
                    />
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}

        {/* Wallet indicator - minimal */}
        {hasMultipleTokens && walletAddress && (
          <div style={walletIndicatorStyle}>
            {/* Wallet icon */}
            <svg
              style={walletIconStyle}
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
            <span style={walletAddressStyle}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={dividerStyle} />

      {/* Token Info with Expand Button */}
      <button
        type="button"
        style={tokenInfoButtonStyle}
        onClick={(e) => {
          e.stopPropagation();
          onExpandClick?.();
        }}
      >
        <div>
          <p style={tokenSymbolStyle}>{selectedToken.symbol}</p>
          {(selectedToken as YourTokenData).chainData && (
            <p style={chainNameStyle}>
              {(selectedToken as YourTokenData)?.chainData?.networkName ||
                ((selectedToken as YourTokenData)?.chainData as Chain)?.name}
            </p>
          )}
        </div>
        {/* Chevron Down icon */}
        <svg
          style={expandChevronStyle}
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
