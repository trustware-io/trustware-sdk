import React from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles";

import {
  useDepositForm,
  useDepositNavigation,
  useDepositWallet,
} from "../context/DepositContext";
import { useChains, useTokens } from "../hooks";
import { WidgetSecurityFooter } from "../components";
import {
  ChainSelectorPanel,
  TokenSelectorPanel,
  useSelectTokenModel,
} from "../features/token-selection";

export interface SelectTokenProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * SelectToken page with two-column layout.
 * Left column displays available chains for selection.
 * Right column displays tokens for the selected chain with search functionality.
 */
export function SelectToken({ style }: SelectTokenProps): React.ReactElement {
  const { selectedChain, setSelectedChain, setSelectedToken } =
    useDepositForm();
  const { goBack } = useDepositNavigation();
  const { walletAddress, yourWalletTokens } = useDepositWallet();
  const { popularChains, otherChains, isLoading, error } = useChains();
  const {
    filteredTokens,
    isLoading: isLoadingTokens,
    isLoadingMore,
    error: tokensError,
    hasNextPage,
    loadMore,
    searchQuery,
    setSearchQuery,
  } = useTokens(selectedChain?.chainId ?? null);
  const {
    filteredWalletTokens,
    handleChainSelect,
    handleTokenSelect,
    handleYourTokenSelect,
    isChainSelected,
  } = useSelectTokenModel({
    goBack,
    searchQuery,
    selectedChain,
    setSelectedChain,
    setSelectedToken,
    walletAddress,
    yourWalletTokens,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        maxHeight: "70vh",
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `${spacing[4]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <button
          type="button"
          onClick={goBack}
          style={{
            padding: spacing[1],
            marginRight: spacing[2],
            borderRadius: borderRadius.lg,
            transition: "background-color 0.2s",
            backgroundColor: "transparent",
            border: 0,
            cursor: "pointer",
          }}
          aria-label="Go back"
        >
          <svg
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: colors.foreground,
            }}
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
        <h1
          style={{
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.foreground,
            textAlign: "center",
            marginRight: "1.75rem",
          }}
        >
          Select Token
        </h1>
      </div>

      {/* Content - Two Column Layout */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <ChainSelectorPanel
          error={error}
          isChainSelected={isChainSelected}
          isLoading={isLoading}
          onChainSelect={handleChainSelect}
          otherChains={otherChains}
          popularChains={popularChains}
        />

        <TokenSelectorPanel
          filteredTokens={filteredTokens}
          filteredWalletTokens={filteredWalletTokens}
          hasNextPage={hasNextPage}
          isLoadingTokens={isLoadingTokens}
          isLoadingMore={isLoadingMore}
          loadMore={loadMore}
          onSelectToken={handleTokenSelect}
          onSelectWalletToken={handleYourTokenSelect}
          searchQuery={searchQuery}
          selectedChain={selectedChain}
          setSearchQuery={setSearchQuery}
          tokensError={tokensError}
          walletAddress={walletAddress}
        />
      </div>

      <WidgetSecurityFooter />
    </div>
  );
}

export default SelectToken;
