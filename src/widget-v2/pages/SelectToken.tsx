import React from "react";
import { mergeStyles } from "../lib/utils";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/tokens";
import { useDeposit } from "../context/DepositContext";
import type { Token } from "../context/DepositContext";
import { useChains } from "../hooks/useChains";
import { useTokens } from "../hooks/useTokens";
import { resolveChainLabel } from "../../utils";
import type { ChainDef } from "../../types/";

export interface SelectTokenProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * Format a token balance for display
 */
function formatTokenBalance(balance: string, decimals: number): string {
  try {
    const value = parseFloat(balance) / Math.pow(10, decimals);
    if (value === 0) return "0";
    if (value < 0.0001) return "<0.0001";
    if (value < 1) return value.toFixed(4);
    if (value < 1000) return value.toFixed(2);
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  } catch {
    return balance;
  }
}

// Styles
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "500px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: `${spacing[4]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border}`,
};

const backButtonStyle: React.CSSProperties = {
  padding: spacing[1],
  marginRight: spacing[2],
  borderRadius: borderRadius.lg,
  transition: "background-color 0.2s",
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
};

const backIconStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  color: colors.foreground,
};

const headerTitleStyle: React.CSSProperties = {
  flex: 1,
  fontSize: fontSize.lg,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
  textAlign: "center",
  marginRight: "1.75rem",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  overflow: "hidden",
};

// Left column styles
const leftColumnStyle: React.CSSProperties = {
  width: "140px",
  borderRight: `1px solid ${colors.border}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const columnHeaderStyle: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  borderBottom: `1px solid rgba(63, 63, 70, 0.5)`,
};

const columnLabelStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  color: colors.mutedForeground,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const chainListContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: `${spacing[2]} ${spacing[1]}`,
};

const skeletonContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[2],
  padding: `0 ${spacing[2]}`,
};

const skeletonRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[2]} 0`,
};

const skeletonCircleStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "9999px",
  backgroundColor: colors.muted,
};

const skeletonTextStyle: React.CSSProperties = {
  flex: 1,
  height: "1rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
};

const errorTextStyle: React.CSSProperties = {
  padding: `${spacing[3]} ${spacing[4]}`,
  textAlign: "center",
};

const errorMessageStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.destructive,
};

const retryLinkStyle: React.CSSProperties = {
  marginTop: spacing[2],
  fontSize: fontSize.xs,
  color: colors.primary,
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
  textDecoration: "underline",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: spacing[2],
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: `${spacing[1.5]} ${spacing[3]}`,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: fontWeight.medium,
  color: "rgba(161, 161, 170, 0.7)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const chainButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[2.5]} ${spacing[3]}`,
  borderRadius: borderRadius.lg,
  border: "1px solid transparent",
  transition: "all 0.2s",
  backgroundColor: "transparent",
  cursor: "pointer",
};

const chainButtonSelectedStyle: React.CSSProperties = {
  borderColor: colors.primary,
  backgroundColor: "rgba(59, 130, 246, 0.1)",
};

const chainIconStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "9999px",
  objectFit: "cover",
  flexShrink: 0,
};

const chainIconFallbackStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  borderRadius: "9999px",
  backgroundColor: colors.muted,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const chainIconFallbackTextStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.semibold,
  color: colors.mutedForeground,
};

const chainNameContainerStyle: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  minWidth: 0,
};

const chainNameStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
  color: colors.foreground,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
};

const selectionIndicatorStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  borderRadius: "9999px",
  backgroundColor: colors.primary,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const checkIconStyle: React.CSSProperties = {
  width: "0.75rem",
  height: "0.75rem",
  color: colors.primaryForeground,
};

const emptyStateStyle: React.CSSProperties = {
  padding: `${spacing[3]} ${spacing[4]}`,
  textAlign: "center",
};

const emptyTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

// Right column styles
const rightColumnStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const tokenHeaderStyle: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  borderBottom: `1px solid rgba(63, 63, 70, 0.5)`,
};

const tokenHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  marginBottom: spacing[2],
};

const walletBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  color: colors.primary,
  backgroundColor: "rgba(59, 130, 246, 0.1)",
  padding: `${spacing[0.5]} ${spacing[1.5]}`,
  borderRadius: borderRadius.md,
};

const searchContainerStyle: React.CSSProperties = {
  position: "relative",
};

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: spacing[2.5],
  top: "50%",
  transform: "translateY(-50%)",
  width: "1rem",
  height: "1rem",
  color: colors.mutedForeground,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  paddingLeft: spacing[8],
  paddingRight: spacing[3],
  paddingTop: spacing[2],
  paddingBottom: spacing[2],
  fontSize: fontSize.sm,
  backgroundColor: "rgba(63, 63, 70, 0.5)",
  border: `1px solid rgba(63, 63, 70, 0.5)`,
  borderRadius: borderRadius.lg,
  color: colors.foreground,
  outline: "none",
  transition: "all 0.2s",
};

const clearSearchButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: spacing[2.5],
  top: "50%",
  transform: "translateY(-50%)",
  padding: spacing[0.5],
  borderRadius: "9999px",
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
  transition: "background-color 0.2s",
};

const clearIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
  color: colors.mutedForeground,
};

const tokenListContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: `${spacing[2]} ${spacing[1]}`,
};

const centeredContainerStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `0 ${spacing[4]}`,
};

const centeredContentStyle: React.CSSProperties = {
  textAlign: "center",
};

const placeholderIconStyle: React.CSSProperties = {
  width: "3rem",
  height: "3rem",
  margin: `0 auto ${spacing[3]}`,
  color: "rgba(161, 161, 170, 0.5)",
};

const smallIconStyle: React.CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  margin: `0 auto ${spacing[2]}`,
};

const tokenSkeletonRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[2.5]} ${spacing[2]}`,
};

const tokenSkeletonCircleStyle: React.CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "9999px",
  backgroundColor: colors.muted,
};

const tokenSkeletonTextContainerStyle: React.CSSProperties = {
  flex: 1,
};

const tokenSkeletonTextSmStyle: React.CSSProperties = {
  height: "1rem",
  width: "4rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
  marginBottom: spacing[1.5],
};

const tokenSkeletonTextLgStyle: React.CSSProperties = {
  height: "0.75rem",
  width: "6rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
};

const tokenSkeletonBalanceStyle: React.CSSProperties = {
  height: "1rem",
  width: "3.5rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
};

const tokenListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[0.5],
};

const tokenButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[2.5]} ${spacing[3]}`,
  borderRadius: borderRadius.lg,
  transition: "all 0.2s",
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
};

const tokenIconStyle: React.CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "9999px",
  objectFit: "cover",
  flexShrink: 0,
};

const tokenIconFallbackStyle: React.CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "9999px",
  backgroundColor: "rgba(59, 130, 246, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const tokenIconFallbackTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: colors.primary,
};

const tokenInfoStyle: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  minWidth: 0,
};

const tokenSymbolContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1.5],
};

const tokenSymbolStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tokenNameStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  color: colors.mutedForeground,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
};

const tokenBalanceContainerStyle: React.CSSProperties = {
  textAlign: "right",
  flexShrink: 0,
};

const tokenBalanceStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
  color: colors.foreground,
};

const chevronStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  color: colors.mutedForeground,
  flexShrink: 0,
};

const footerStyle: React.CSSProperties = {
  padding: `${spacing[4]} ${spacing[6]}`,
  borderTop: `1px solid rgba(63, 63, 70, 0.3)`,
};

const footerContentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
};

const lockIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
  color: colors.mutedForeground,
};

const footerTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

const footerBrandStyle: React.CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};

/**
 * SelectToken page with two-column layout.
 * Left column displays available chains for selection.
 * Right column displays tokens for the selected chain with search functionality.
 */
export function SelectToken({ style }: SelectTokenProps): React.ReactElement {
  const {
    selectedChain,
    setSelectedChain,
    setSelectedToken,
    setCurrentStep,
    goBack,
    walletAddress,
  } = useDeposit();
  const { popularChains, otherChains, isLoading, error } = useChains();
  const {
    filteredTokens,
    isLoading: isLoadingTokens,
    error: tokensError,
    searchQuery,
    setSearchQuery,
  } = useTokens(selectedChain?.chainId ?? null);

  /**
   * Handle chain selection
   */
  const handleChainSelect = (chain: ChainDef) => {
    // Convert ChainDef to our Chain interface for context
    const chainId = Number(chain.chainId ?? chain.id);
    setSelectedChain({
      chainId,
      name: resolveChainLabel(chain),
      shortName:
        chain.nativeCurrency?.symbol ??
        resolveChainLabel(chain).slice(0, 3).toUpperCase(),
      iconUrl: chain.chainIconURI,
      isPopular: [1, 137, 8453].includes(chainId),
      nativeToken: chain.nativeCurrency?.symbol ?? "ETH",
      explorerUrl: chain.blockExplorerUrls?.[0],
    });
  };

  /**
   * Handle token selection
   */
  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token);
    setCurrentStep("crypto-pay");
  };

  /**
   * Check if a chain is currently selected
   */
  const isChainSelected = (chain: ChainDef): boolean => {
    if (!selectedChain) return false;
    const chainId = Number(chain.chainId ?? chain.id);
    return selectedChain.chainId === chainId;
  };

  /**
   * Render a single chain item
   */
  const renderChainItem = (chain: ChainDef, index: number) => {
    const key =
      chain.id ?? chain.chainId ?? chain.networkIdentifier ?? `chain-${index}`;
    const isSelected = isChainSelected(chain);
    const label = resolveChainLabel(chain);

    return (
      <button
        key={String(key)}
        type="button"
        onClick={() => handleChainSelect(chain)}
        style={mergeStyles(
          chainButtonStyle,
          isSelected && chainButtonSelectedStyle
        )}
      >
        {/* Chain Icon */}
        {chain.chainIconURI ? (
          <img src={chain.chainIconURI} alt={label} style={chainIconStyle} />
        ) : (
          <div style={chainIconFallbackStyle}>
            <span style={chainIconFallbackTextStyle}>
              {label.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Chain Name */}
        <div style={chainNameContainerStyle}>
          <span style={chainNameStyle}>{label}</span>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div style={selectionIndicatorStyle}>
            <svg
              style={checkIconStyle}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={mergeStyles(containerStyle, style)}>
      {/* Header */}
      <div style={headerStyle}>
        <button
          type="button"
          onClick={goBack}
          style={backButtonStyle}
          aria-label="Go back"
        >
          <svg
            style={backIconStyle}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 style={headerTitleStyle}>Select Token</h1>
      </div>

      {/* Content - Two Column Layout */}
      <div style={contentStyle}>
        {/* Left Column - Chain Selector */}
        <div style={leftColumnStyle}>
          <div style={columnHeaderStyle}>
            <span style={columnLabelStyle}>Chain</span>
          </div>

          <div style={chainListContainerStyle}>
            {isLoading ? (
              // Loading skeleton
              <div style={skeletonContainerStyle}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={skeletonRowStyle}>
                    <div
                      style={skeletonCircleStyle}
                      className="tw-animate-pulse"
                    />
                    <div
                      style={skeletonTextStyle}
                      className="tw-animate-pulse"
                    />
                  </div>
                ))}
              </div>
            ) : error ? (
              // Error state
              <div style={errorTextStyle}>
                <p style={errorMessageStyle}>{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={retryLinkStyle}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Popular Chains Section */}
                {popularChains.length > 0 && (
                  <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                      <span style={sectionLabelStyle}>Popular</span>
                    </div>
                    {popularChains.map((chain, idx) =>
                      renderChainItem(chain, idx)
                    )}
                  </div>
                )}

                {/* Other Chains Section */}
                {otherChains.length > 0 && (
                  <div>
                    {popularChains.length > 0 && (
                      <div
                        style={{
                          ...sectionHeaderStyle,
                          marginTop: spacing[2],
                        }}
                      >
                        <span style={sectionLabelStyle}>All Chains</span>
                      </div>
                    )}
                    {otherChains.map((chain, idx) =>
                      renderChainItem(chain, popularChains.length + idx)
                    )}
                  </div>
                )}

                {/* Empty state */}
                {popularChains.length === 0 && otherChains.length === 0 && (
                  <div style={emptyStateStyle}>
                    <p style={emptyTextStyle}>No chains available</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column - Token Selector */}
        <div style={rightColumnStyle}>
          {/* Header with search */}
          <div style={tokenHeaderStyle}>
            <div style={tokenHeaderRowStyle}>
              <span style={columnLabelStyle}>Token</span>
              {walletAddress && (
                <span style={walletBadgeStyle}>Wallet Connected</span>
              )}
            </div>
            {/* Search Input */}
            {selectedChain && (
              <div style={searchContainerStyle}>
                <svg
                  style={searchIconStyle}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={searchInputStyle}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={clearSearchButtonStyle}
                    aria-label="Clear search"
                  >
                    <svg
                      style={clearIconStyle}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Token List */}
          <div style={tokenListContainerStyle}>
            {!selectedChain ? (
              // No chain selected
              <div style={centeredContainerStyle}>
                <div style={centeredContentStyle}>
                  <svg
                    style={placeholderIconStyle}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                    />
                  </svg>
                  <p style={emptyTextStyle}>
                    Select a chain to view available tokens
                  </p>
                </div>
              </div>
            ) : isLoadingTokens ? (
              // Loading skeleton
              <div style={skeletonContainerStyle}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} style={tokenSkeletonRowStyle}>
                    <div
                      style={tokenSkeletonCircleStyle}
                      className="tw-animate-pulse"
                    />
                    <div style={tokenSkeletonTextContainerStyle}>
                      <div
                        style={tokenSkeletonTextSmStyle}
                        className="tw-animate-pulse"
                      />
                      <div
                        style={tokenSkeletonTextLgStyle}
                        className="tw-animate-pulse"
                      />
                    </div>
                    <div
                      style={tokenSkeletonBalanceStyle}
                      className="tw-animate-pulse"
                    />
                  </div>
                ))}
              </div>
            ) : tokensError ? (
              // Error state
              <div style={centeredContainerStyle}>
                <div style={centeredContentStyle}>
                  <svg
                    style={{ ...smallIconStyle, color: colors.destructive }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                  </svg>
                  <p
                    style={{
                      ...emptyTextStyle,
                      color: colors.destructive,
                      marginBottom: spacing[2],
                    }}
                  >
                    {tokensError}
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={retryLinkStyle}
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : filteredTokens.length === 0 ? (
              // No tokens found
              <div style={centeredContainerStyle}>
                <div style={centeredContentStyle}>
                  <svg
                    style={smallIconStyle}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" d="m21 21-4.35-4.35" />
                    <path strokeLinecap="round" d="M8 11h6" />
                  </svg>
                  <p style={emptyTextStyle}>
                    {searchQuery
                      ? `No tokens matching "${searchQuery}"`
                      : "No tokens available"}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      style={{ ...retryLinkStyle, marginTop: spacing[2] }}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // Token list
              <div style={tokenListStyle}>
                {filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => handleTokenSelect(token)}
                    style={tokenButtonStyle}
                  >
                    {/* Token Icon */}
                    {token.iconUrl ? (
                      <img
                        src={token.iconUrl}
                        alt={token.symbol}
                        style={tokenIconStyle}
                        onError={(e) => {
                          // Fallback to initials on image error
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          if (target.nextElementSibling) {
                            (
                              target.nextElementSibling as HTMLElement
                            ).style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        ...tokenIconFallbackStyle,
                        display: token.iconUrl ? "none" : "flex",
                      }}
                    >
                      <span style={tokenIconFallbackTextStyle}>
                        {token.symbol.slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    {/* Token Info */}
                    <div style={tokenInfoStyle}>
                      <div style={tokenSymbolContainerStyle}>
                        <span style={tokenSymbolStyle}>{token.symbol}</span>
                      </div>
                      <span style={tokenNameStyle}>{token.name}</span>
                    </div>

                    {/* Token Balance (if wallet connected) */}
                    {token.balance !== undefined && (
                      <div style={tokenBalanceContainerStyle}>
                        <span style={tokenBalanceStyle}>
                          {formatTokenBalance(token.balance, token.decimals)}
                        </span>
                      </div>
                    )}

                    {/* Chevron */}
                    <svg
                      style={chevronStyle}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m9 18 6-6-6-6"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <div style={footerContentStyle}>
          <svg
            style={lockIconStyle}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span style={footerTextStyle}>
            Secured by <span style={footerBrandStyle}>Trustware</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default SelectToken;
