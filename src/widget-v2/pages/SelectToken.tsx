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
import {
  containerStyle,
  headerStyle,
  backButtonStyle,
  backIconStyle,
  tokenSkeletonCircleStyle,
  tokenSkeletonTextContainerStyle,
  tokenSkeletonTextSmStyle,
  tokenSkeletonTextLgStyle,
  tokenSkeletonBalanceStyle,
  tokenListStyle,
  tokenButtonStyle,
  tokenIconStyle,
  tokenIconFallbackStyle,
  tokenIconFallbackTextStyle,
  tokenInfoStyle,
  tokenSymbolContainerStyle,
  tokenSymbolStyle,
  tokenNameStyle,
  tokenBalanceContainerStyle,
  tokenBalanceStyle,
  chevronStyle,
  footerStyle,
  footerContentStyle,
  lockIconStyle,
  footerTextStyle,
  footerBrandStyle,
  sectionLabelStyle,
  sectionHeaderStyle,
  sectionStyle,
  retryLinkStyle,
  headerTitleStyle,
  contentStyle,
  leftColumnStyle,
  columnHeaderStyle,
  columnLabelStyle,
  centeredContainerStyle,
  centeredContentStyle,
  chainButtonSelectedStyle,
  chainButtonStyle,
  chainIconFallbackStyle,
  chainIconFallbackTextStyle,
  chainIconStyle,
  chainListContainerStyle,
  chainNameContainerStyle,
  chainNameStyle,
  checkIconStyle,
  clearIconStyle,
  clearSearchButtonStyle,
  emptyStateStyle,
  emptyTextStyle,
  errorMessageStyle,
  errorTextStyle,
  placeholderIconStyle,
  rightColumnStyle,
  searchContainerStyle,
  searchIconStyle,
  searchInputStyle,
  selectionIndicatorStyle,
  skeletonCircleStyle,
  skeletonContainerStyle,
  skeletonRowStyle,
  skeletonTextStyle,
  smallIconStyle,
  tokenHeaderRowStyle,
  tokenHeaderStyle,
  tokenListContainerStyle,
  tokenSkeletonRowStyle,
  walletBadgeStyle,
} from "./styles";

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
