import React from "react";
import { cn } from "../lib/utils";
import { useDeposit } from "../context/DepositContext";
import type { Token } from "../context/DepositContext";
import { useChains } from "../hooks/useChains";
import { useTokens } from "../hooks/useTokens";
import { resolveChainLabel } from "../../utils";
import type { ChainDef } from "../../types/";

export interface SelectTokenProps {
  /** Additional CSS classes */
  className?: string;
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
export function SelectToken({ className }: SelectTokenProps): React.ReactElement {
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
      shortName: chain.nativeCurrency?.symbol ?? resolveChainLabel(chain).slice(0, 3).toUpperCase(),
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
    const chainId = Number(chain.chainId ?? chain.id);
    const key = chain.id ?? chain.chainId ?? chain.networkIdentifier ?? `chain-${index}`;
    const isSelected = isChainSelected(chain);
    const label = resolveChainLabel(chain);

    return (
      <button
        key={String(key)}
        type="button"
        onClick={() => handleChainSelect(chain)}
        className={cn(
          "tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-lg tw-border tw-transition-all tw-duration-200",
          isSelected
            ? "tw-border-primary tw-bg-primary/10"
            : "tw-border-transparent hover:tw-bg-muted/50"
        )}
      >
        {/* Chain Icon */}
        {chain.chainIconURI ? (
          <img
            src={chain.chainIconURI}
            alt={label}
            className="tw-w-8 tw-h-8 tw-rounded-full tw-object-cover tw-flex-shrink-0"
          />
        ) : (
          <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-muted tw-flex tw-items-center tw-justify-center tw-flex-shrink-0">
            <span className="tw-text-xs tw-font-semibold tw-text-muted-foreground">
              {label.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Chain Name */}
        <div className="tw-flex-1 tw-text-left tw-min-w-0">
          <span className={cn(
            "tw-text-sm tw-font-medium tw-truncate tw-block",
            isSelected ? "tw-text-foreground" : "tw-text-foreground"
          )}>
            {label}
          </span>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className="tw-w-5 tw-h-5 tw-rounded-full tw-bg-primary tw-flex tw-items-center tw-justify-center tw-flex-shrink-0">
            <svg className="tw-w-3 tw-h-3 tw-text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className={cn("tw-flex tw-flex-col tw-min-h-[500px]", className)}>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-px-4 tw-py-4 tw-border-b tw-border-border">
        <button
          type="button"
          onClick={goBack}
          className="tw-p-1 tw-mr-2 tw-rounded-lg hover:tw-bg-muted/50 tw-transition-colors"
          aria-label="Go back"
        >
          <svg className="tw-w-5 tw-h-5 tw-text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="tw-flex-1 tw-text-lg tw-font-semibold tw-text-foreground tw-text-center tw-mr-7">
          Select Token
        </h1>
      </div>

      {/* Content - Two Column Layout */}
      <div className="tw-flex-1 tw-flex tw-overflow-hidden">
        {/* Left Column - Chain Selector */}
        <div className="tw-w-[140px] tw-border-r tw-border-border tw-flex tw-flex-col tw-overflow-hidden">
          <div className="tw-px-3 tw-py-2 tw-border-b tw-border-border/50">
            <span className="tw-text-xs tw-font-medium tw-text-muted-foreground tw-uppercase tw-tracking-wide">
              Chain
            </span>
          </div>

          <div className="tw-flex-1 tw-overflow-y-auto tw-py-2 tw-px-1">
            {isLoading ? (
              // Loading skeleton
              <div className="tw-flex tw-flex-col tw-gap-2 tw-px-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="tw-flex tw-items-center tw-gap-3 tw-py-2">
                    <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-muted tw-animate-pulse" />
                    <div className="tw-flex-1 tw-h-4 tw-bg-muted tw-rounded tw-animate-pulse" />
                  </div>
                ))}
              </div>
            ) : error ? (
              // Error state
              <div className="tw-px-3 tw-py-4 tw-text-center">
                <p className="tw-text-sm tw-text-destructive">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="tw-mt-2 tw-text-xs tw-text-primary hover:tw-underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Popular Chains Section */}
                {popularChains.length > 0 && (
                  <div className="tw-mb-2">
                    <div className="tw-px-3 tw-py-1.5">
                      <span className="tw-text-[10px] tw-font-medium tw-text-muted-foreground/70 tw-uppercase tw-tracking-wide">
                        Popular
                      </span>
                    </div>
                    {popularChains.map((chain, idx) => renderChainItem(chain, idx))}
                  </div>
                )}

                {/* Other Chains Section */}
                {otherChains.length > 0 && (
                  <div>
                    {popularChains.length > 0 && (
                      <div className="tw-px-3 tw-py-1.5 tw-mt-2">
                        <span className="tw-text-[10px] tw-font-medium tw-text-muted-foreground/70 tw-uppercase tw-tracking-wide">
                          All Chains
                        </span>
                      </div>
                    )}
                    {otherChains.map((chain, idx) => renderChainItem(chain, popularChains.length + idx))}
                  </div>
                )}

                {/* Empty state */}
                {popularChains.length === 0 && otherChains.length === 0 && (
                  <div className="tw-px-3 tw-py-4 tw-text-center">
                    <p className="tw-text-sm tw-text-muted-foreground">No chains available</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column - Token Selector */}
        <div className="tw-flex-1 tw-flex tw-flex-col tw-overflow-hidden">
          {/* Header with search */}
          <div className="tw-px-3 tw-py-2 tw-border-b tw-border-border/50">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
              <span className="tw-text-xs tw-font-medium tw-text-muted-foreground tw-uppercase tw-tracking-wide">
                Token
              </span>
              {walletAddress && (
                <span className="tw-text-[10px] tw-text-primary tw-bg-primary/10 tw-px-1.5 tw-py-0.5 tw-rounded">
                  Wallet Connected
                </span>
              )}
            </div>
            {/* Search Input */}
            {selectedChain && (
              <div className="tw-relative">
                <svg
                  className="tw-absolute tw-left-2.5 tw-top-1/2 tw--translate-y-1/2 tw-w-4 tw-h-4 tw-text-muted-foreground"
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
                  className={cn(
                    "tw-w-full tw-pl-8 tw-pr-3 tw-py-2 tw-text-sm",
                    "tw-bg-muted/50 tw-border tw-border-border/50 tw-rounded-lg",
                    "tw-text-foreground placeholder:tw-text-muted-foreground",
                    "focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-primary/30 focus:tw-border-primary/50",
                    "tw-transition-all"
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="tw-absolute tw-right-2.5 tw-top-1/2 tw--translate-y-1/2 tw-p-0.5 tw-rounded-full hover:tw-bg-muted tw-transition-colors"
                    aria-label="Clear search"
                  >
                    <svg className="tw-w-3.5 tw-h-3.5 tw-text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Token List */}
          <div className="tw-flex-1 tw-overflow-y-auto tw-py-2 tw-px-1">
            {!selectedChain ? (
              // No chain selected
              <div className="tw-h-full tw-flex tw-items-center tw-justify-center tw-px-4">
                <div className="tw-text-center">
                  <svg
                    className="tw-w-12 tw-h-12 tw-mx-auto tw-mb-3 tw-text-muted-foreground/50"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  <p className="tw-text-sm tw-text-muted-foreground">
                    Select a chain to view available tokens
                  </p>
                </div>
              </div>
            ) : isLoadingTokens ? (
              // Loading skeleton
              <div className="tw-flex tw-flex-col tw-gap-2 tw-px-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="tw-flex tw-items-center tw-gap-3 tw-py-2.5 tw-px-2">
                    <div className="tw-w-9 tw-h-9 tw-rounded-full tw-bg-muted tw-animate-pulse" />
                    <div className="tw-flex-1">
                      <div className="tw-h-4 tw-w-16 tw-bg-muted tw-rounded tw-animate-pulse tw-mb-1.5" />
                      <div className="tw-h-3 tw-w-24 tw-bg-muted tw-rounded tw-animate-pulse" />
                    </div>
                    <div className="tw-h-4 tw-w-14 tw-bg-muted tw-rounded tw-animate-pulse" />
                  </div>
                ))}
              </div>
            ) : tokensError ? (
              // Error state
              <div className="tw-h-full tw-flex tw-items-center tw-justify-center tw-px-4">
                <div className="tw-text-center">
                  <svg
                    className="tw-w-10 tw-h-10 tw-mx-auto tw-mb-2 tw-text-destructive"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                  </svg>
                  <p className="tw-text-sm tw-text-destructive tw-mb-2">{tokensError}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="tw-text-xs tw-text-primary hover:tw-underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : filteredTokens.length === 0 ? (
              // No tokens found
              <div className="tw-h-full tw-flex tw-items-center tw-justify-center tw-px-4">
                <div className="tw-text-center">
                  <svg
                    className="tw-w-10 tw-h-10 tw-mx-auto tw-mb-2 tw-text-muted-foreground/50"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" d="m21 21-4.35-4.35" />
                    <path strokeLinecap="round" d="M8 11h6" />
                  </svg>
                  <p className="tw-text-sm tw-text-muted-foreground">
                    {searchQuery ? `No tokens matching "${searchQuery}"` : "No tokens available"}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="tw-mt-2 tw-text-xs tw-text-primary hover:tw-underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // Token list
              <div className="tw-flex tw-flex-col tw-gap-0.5">
                {filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => handleTokenSelect(token)}
                    className={cn(
                      "tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-lg",
                      "tw-transition-all tw-duration-200",
                      "hover:tw-bg-muted/70 active:tw-bg-muted"
                    )}
                  >
                    {/* Token Icon */}
                    {token.iconUrl ? (
                      <img
                        src={token.iconUrl}
                        alt={token.symbol}
                        className="tw-w-9 tw-h-9 tw-rounded-full tw-object-cover tw-flex-shrink-0"
                        onError={(e) => {
                          // Fallback to initials on image error
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.nextElementSibling?.classList.remove("tw-hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={cn(
                        "tw-w-9 tw-h-9 tw-rounded-full tw-bg-primary/10 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0",
                        token.iconUrl ? "tw-hidden" : ""
                      )}
                    >
                      <span className="tw-text-sm tw-font-semibold tw-text-primary">
                        {token.symbol.slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    {/* Token Info */}
                    <div className="tw-flex-1 tw-text-left tw-min-w-0">
                      <div className="tw-flex tw-items-center tw-gap-1.5">
                        <span className="tw-text-sm tw-font-semibold tw-text-foreground tw-truncate">
                          {token.symbol}
                        </span>
                      </div>
                      <span className="tw-text-xs tw-text-muted-foreground tw-truncate tw-block">
                        {token.name}
                      </span>
                    </div>

                    {/* Token Balance (if wallet connected) */}
                    {token.balance !== undefined && (
                      <div className="tw-text-right tw-flex-shrink-0">
                        <span className="tw-text-sm tw-font-medium tw-text-foreground">
                          {formatTokenBalance(token.balance, token.decimals)}
                        </span>
                      </div>
                    )}

                    {/* Chevron */}
                    <svg
                      className="tw-w-4 tw-h-4 tw-text-muted-foreground tw-flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="tw-px-6 tw-py-4 tw-border-t tw-border-border/30">
        <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
          <svg
            className="tw-w-3.5 tw-h-3.5 tw-text-muted-foreground"
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
          <span className="tw-text-sm tw-text-muted-foreground">
            Secured by{" "}
            <span className="tw-font-semibold tw-text-foreground">
              Trustware
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default SelectToken;
