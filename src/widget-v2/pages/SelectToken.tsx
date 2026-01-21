import React from "react";
import { cn } from "../lib/utils";
import { useDeposit } from "../context/DepositContext";
import { useChains } from "../hooks/useChains";
import { resolveChainLabel } from "../../utils";
import type { ChainDef } from "../../types/";

export interface SelectTokenProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * SelectToken page with two-column layout.
 * Left column displays available chains for selection.
 * Right column will display tokens (US-014).
 */
export function SelectToken({ className }: SelectTokenProps): React.ReactElement {
  const { selectedChain, setSelectedChain, goBack } = useDeposit();
  const { popularChains, otherChains, isLoading, error } = useChains();

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

        {/* Right Column - Token Selector (Placeholder for US-014) */}
        <div className="tw-flex-1 tw-flex tw-flex-col tw-overflow-hidden">
          <div className="tw-px-4 tw-py-2 tw-border-b tw-border-border/50">
            <span className="tw-text-xs tw-font-medium tw-text-muted-foreground tw-uppercase tw-tracking-wide">
              Token
            </span>
          </div>

          <div className="tw-flex-1 tw-overflow-y-auto tw-px-4 tw-py-4">
            {!selectedChain ? (
              // No chain selected
              <div className="tw-h-full tw-flex tw-items-center tw-justify-center">
                <p className="tw-text-sm tw-text-muted-foreground tw-text-center">
                  Select a chain to view available tokens
                </p>
              </div>
            ) : (
              // Chain selected - token list will be implemented in US-014
              <div className="tw-h-full tw-flex tw-items-center tw-justify-center">
                <p className="tw-text-sm tw-text-muted-foreground tw-text-center">
                  Loading tokens for {selectedChain.name}...
                </p>
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
