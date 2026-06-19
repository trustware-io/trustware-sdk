import React, { useState, useEffect } from "react";

import type { ChainDef } from "../../../../types";
import type { Token, YourTokenData } from "../../../context/DepositContext";
import { colors, fontWeight, spacing, borderRadius } from "../../../styles";
import { AvailableTokenListItem } from "./AvailableTokenListItem";
import { TokenSearchInput } from "./TokenSearchInput";
import { TokenSelectorStateView } from "./TokenSelectorStateView";
import { WalletTokenListItem } from "./WalletTokenListItem";

export interface TokenSelectorPanelProps {
  filteredTokens: Token[];
  filteredWalletTokens: YourTokenData[];
  hasNextPage: boolean;
  isLoadingTokens: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  onSelectToken: (token: Token) => Promise<void>;
  onSelectWalletToken: (token: YourTokenData) => void;
  searchQuery: string;
  selectedChain: ChainDef | null;
  setSearchQuery: (value: string) => void;
  tokensError: string | null;
  walletAddress: string | null;
}

function TokenSectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: "wallet" | "spark";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        paddingLeft: spacing[3],
        paddingRight: spacing[3],
        paddingTop: spacing[1],
        paddingBottom: spacing[1],
        marginTop: spacing[1],
        marginBottom: spacing[1],
      }}
    >
      {icon === "wallet" ? (
        <svg
          style={{
            width: "0.75rem",
            height: "0.75rem",
            color: colors.primary,
            flexShrink: 0,
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18-3H3m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6"
          />
        </svg>
      ) : (
        <svg
          style={{
            width: "0.75rem",
            height: "0.75rem",
            color: colors.primary,
            flexShrink: 0,
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
        </svg>
      )}
      <span
        style={{
          fontSize: "0.75rem",
          lineHeight: "1rem",
          fontWeight: fontWeight.medium,
          color: colors.primary,
        }}
      >
        {children}
      </span>
    </div>
  );
}

const INITIAL_TOKEN_LIMIT = 50;

export function TokenSelectorPanel({
  filteredTokens,
  filteredWalletTokens,
  hasNextPage,
  isLoadingTokens,
  isLoadingMore,
  loadMore,
  onSelectToken,
  onSelectWalletToken,
  searchQuery,
  selectedChain,
  setSearchQuery,
  tokensError,
}: TokenSelectorPanelProps): React.ReactElement {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination when chain or search changes
    setShowAll(false);
  }, [selectedChain, searchQuery]);

  const hasWalletTokens = filteredWalletTokens.length > 0;
  const hasPopularTokens = filteredTokens.length > 0;
  const visibleTokens =
    showAll || filteredTokens.length <= INITIAL_TOKEN_LIMIT
      ? filteredTokens
      : filteredTokens.slice(0, INITIAL_TOKEN_LIMIT);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Search - always visible */}
      <div
        style={{
          padding: `${spacing[2]} ${spacing[2]}`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <TokenSearchInput
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `${spacing[1]} ${spacing[1]}`,
        }}
      >
        {!selectedChain ? (
          <TokenSelectorStateView
            isLoadingTokens={isLoadingTokens}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            state="no-chain"
            tokensError={null}
          />
        ) : isLoadingTokens && !hasWalletTokens ? (
          <TokenSelectorStateView
            isLoadingTokens={true}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            state="empty"
            tokensError={null}
          />
        ) : tokensError && !hasWalletTokens ? (
          <TokenSelectorStateView
            isLoadingTokens={false}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            state="error"
            tokensError={tokensError}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Your tokens */}
            {hasWalletTokens && (
              <>
                <TokenSectionLabel icon="wallet">Your tokens</TokenSectionLabel>
                {filteredWalletTokens.map((token, i) => (
                  <WalletTokenListItem
                    key={`${token.address}-${i}`}
                    token={token}
                    onSelect={onSelectWalletToken}
                  />
                ))}
              </>
            )}

            {/* Popular tokens */}
            {isLoadingTokens ? (
              <TokenSelectorStateView
                isLoadingTokens={true}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                state="empty"
                tokensError={null}
              />
            ) : hasPopularTokens ? (
              <>
                <TokenSectionLabel icon="spark">
                  Popular tokens
                </TokenSectionLabel>
                {visibleTokens.map((token, i) => (
                  <AvailableTokenListItem
                    key={`${token.address}-${i}`}
                    token={token}
                    onSelect={onSelectToken}
                  />
                ))}
                {!showAll && filteredTokens.length > INITIAL_TOKEN_LIMIT ? (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    style={{
                      marginTop: spacing[2],
                      marginLeft: spacing[2],
                      marginRight: spacing[2],
                      padding: `${spacing[2]} ${spacing[3]}`,
                      borderRadius: borderRadius.lg,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                    }}
                  >
                    Show all {filteredTokens.length} tokens
                  </button>
                ) : hasNextPage ? (
                  <button
                    type="button"
                    onClick={() => {
                      void loadMore();
                    }}
                    disabled={isLoadingMore}
                    style={{
                      marginTop: spacing[2],
                      marginLeft: spacing[2],
                      marginRight: spacing[2],
                      padding: `${spacing[2]} ${spacing[3]}`,
                      borderRadius: borderRadius.lg,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      cursor: isLoadingMore ? "wait" : "pointer",
                    }}
                  >
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </button>
                ) : null}
              </>
            ) : !hasWalletTokens ? (
              <TokenSelectorStateView
                isLoadingTokens={false}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                state="empty"
                tokensError={null}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
