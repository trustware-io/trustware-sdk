import React from "react";

import type { ChainDef } from "../../../../types";
import type { Token, YourTokenData } from "../../../context/DepositContext";
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from "../../../styles";
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
  walletAddress,
}: TokenSelectorPanelProps): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: `${spacing[2]} ${spacing[3]}`,
          borderBottom: `1px solid rgba(63, 63, 70, 0.5)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            marginBottom: spacing[2],
          }}
        >
          <span
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              color: colors.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Token
          </span>
          {walletAddress && (
            <span
              style={{
                fontSize: "10px",
                color: colors.primary,
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                padding: `${spacing[0.5]} ${spacing[1.5]}`,
                borderRadius: borderRadius.md,
              }}
            >
              Wallet Connected
            </span>
          )}
        </div>
        {selectedChain ? (
          <TokenSearchInput
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `${spacing[2]} ${spacing[1]}`,
        }}
      >
        {!selectedChain ||
        isLoadingTokens ||
        tokensError ||
        filteredTokens.length === 0 ? (
          <TokenSelectorStateView
            isLoadingTokens={isLoadingTokens}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            state={
              !selectedChain ? "no-chain" : tokensError ? "error" : "empty"
            }
            tokensError={tokensError}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[0.5],
            }}
          >
            {filteredWalletTokens.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  paddingLeft: "0.5rem",
                  paddingRight: "0.5rem",
                  marginBottom: spacing[2],
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    lineHeight: "1rem",
                    color: colors.primary,
                  }}
                >
                  Your tokens
                </span>
              </div>
            ) : null}

            {filteredWalletTokens.map((token, i) => (
              <WalletTokenListItem
                key={`${token.address}-${i}`}
                token={token}
                onSelect={onSelectWalletToken}
              />
            ))}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                paddingLeft: "0.5rem",
                paddingRight: "0.5rem",
                marginBottom: spacing[2],
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  lineHeight: "1rem",
                  color: colors.primary,
                }}
              >
                Popular tokens
              </span>
            </div>

            {filteredTokens.map((token, i) => (
              <AvailableTokenListItem
                key={`${token.address}-${i}`}
                token={token}
                onSelect={onSelectToken}
              />
            ))}

            {hasNextPage ? (
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
          </div>
        )}
      </div>
    </div>
  );
}
