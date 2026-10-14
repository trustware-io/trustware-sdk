import React, { useState, useMemo, useEffect } from "react";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "src/widget/styles";
import { getSharedRegistry } from "src/core/registryClient";
import { mapTokenDefToToken } from "src/core/useTokens";
import { useTokens } from "src/widget/hooks";
import {
  ChainSelectorPanel,
  TokenSelectorPanel,
  useSelectTokenModel,
} from "src/widget/features/token-selection";
import { WidgetSecurityFooter } from "src/widget/components";
import { normalizeChainType } from "src/utils/chains";
import { onlyAllowedTokens, withoutToken } from "../tokenFilters";
import { refsOnChain } from "../tokenRefs";
import type { ChainDef } from "src/types";
import type { SwapTokenRef } from "src/types/config";
import type { Token, YourTokenData } from "src/widget/state/deposit/types";

interface SwapTokenSelectProps {
  side: "from" | "to";
  selectedChain: ChainDef | null;
  walletAddress: string | null;
  yourWalletTokens?: YourTokenData[];
  onSelect: (token: Token | YourTokenData, chain: ChainDef) => void;
  onBack: () => void;
  popularChains: ChainDef[];
  otherChains: ChainDef[];
  chainsLoading: boolean;
  chainsError: string | null;
  /**
   * When provided, only these tokens are shown (dest side restriction).
   * We fetch them directly by address so pagination order never matters.
   */
  allowedTokens?: SwapTokenRef[];
  /** Token that must not appear in the list (prevents swapping a token to itself on the same chain). */
  excludeToken?: { address: string; chainId: string | number } | null;
}

export function SwapTokenSelect({
  side,
  selectedChain: initialChain,
  walletAddress,
  yourWalletTokens = [],
  onSelect,
  onBack,
  popularChains,
  otherChains,
  chainsLoading,
  chainsError,
  allowedTokens,
  excludeToken,
}: SwapTokenSelectProps): React.ReactElement {
  const [localChain, setLocalChain] = useState<ChainDef | null>(initialChain);

  // ── Allowlist path ────────────────────────────────────────────────────────────
  // When allowedTokens is provided we skip useTokens entirely and fetch the exact
  // allowed tokens for the current chain directly from the registry by address.
  // This is guaranteed correct regardless of pagination order.
  const [pinnedTokens, setPinnedTokens] = useState<Token[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);

  useEffect(() => {
    if (!allowedTokens || allowedTokens.length === 0 || !localChain) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinnedTokens([]);
      return;
    }

    const tokensForChain = refsOnChain(allowedTokens, localChain);
    if (tokensForChain.length === 0) {
      setPinnedTokens([]);
      return;
    }

    let cancelled = false;
    setPinnedLoading(true);
    setPinnedTokens([]);

    const registry = getSharedRegistry();

    Promise.all(
      tokensForChain.map((ref) =>
        registry
          .lookupToken(localChain.chainId, ref.address)
          .then((match) => (match ? mapTokenDefToToken(match) : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setPinnedTokens(results.filter((t): t is Token => t !== null));
      setPinnedLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [localChain, allowedTokens]);

  // ── Normal path ───────────────────────────────────────────────────────────────
  // Only active when no allowlist is set. Skip loading when allowlist is active
  // by passing undefined (which causes useTokens to return empty immediately).
  const hasAllowlist = !!allowedTokens && allowedTokens.length > 0;
  const {
    filteredTokens: rawFilteredTokens,
    isLoading: rawLoading,
    isLoadingMore,
    error: tokensError,
    hasNextPage,
    loadMore,
    searchQuery,
    setSearchQuery,
  } = useTokens(
    hasAllowlist
      ? undefined
      : localChain !== null
        ? localChain.chainId
        : undefined
  );

  // Merge: use pinned tokens when allowlist is active, raw list otherwise
  const filteredTokens = hasAllowlist ? pinnedTokens : rawFilteredTokens;
  const isLoadingTokens = hasAllowlist ? pinnedLoading : rawLoading;

  const {
    filteredWalletTokens: rawWalletTokens,
    handleChainSelect,
    handleTokenSelect,
    handleYourTokenSelect,
    isChainSelected,
  } = useSelectTokenModel({
    goBack: onBack,
    searchQuery,
    selectedChain: localChain,
    setSelectedChain: setLocalChain,
    setSelectedToken: (token) => {
      if (!token) return;
      const chain =
        "chainData" in token
          ? ((token as YourTokenData).chainData as ChainDef)
          : (localChain as ChainDef);
      onSelect(token as Token | YourTokenData, chain);
    },
    walletAddress,
    yourWalletTokens,
  });

  const chainType = normalizeChainType(localChain);

  // The pinned catalog list is already the allowlist; wallet rows are not.
  const filteredWalletTokens = useMemo(
    () => onlyAllowedTokens(rawWalletTokens, allowedTokens, chainType),
    [rawWalletTokens, allowedTokens, chainType]
  );

  const visibleTokens = useMemo(
    () => withoutToken(filteredTokens, excludeToken ?? null, chainType),
    [filteredTokens, excludeToken, chainType]
  );

  const visibleWalletTokens = useMemo(
    () => withoutToken(filteredWalletTokens, excludeToken ?? null, chainType),
    [filteredWalletTokens, excludeToken, chainType]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        maxHeight: "70vh",
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
          onClick={onBack}
          style={{
            padding: spacing[1],
            marginRight: spacing[2],
            borderRadius: borderRadius.lg,
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
          {side === "from" ? "Select token to sell" : "Select token to buy"}
        </h1>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ChainSelectorPanel
          error={chainsError}
          isChainSelected={isChainSelected}
          isLoading={chainsLoading}
          onChainSelect={handleChainSelect}
          otherChains={otherChains}
          popularChains={popularChains}
        />
        <TokenSelectorPanel
          filteredTokens={visibleTokens}
          filteredWalletTokens={visibleWalletTokens}
          hasNextPage={hasAllowlist ? false : hasNextPage}
          isLoadingTokens={isLoadingTokens}
          isLoadingMore={hasAllowlist ? false : isLoadingMore}
          loadMore={loadMore}
          onSelectToken={handleTokenSelect}
          onSelectWalletToken={handleYourTokenSelect}
          searchQuery={searchQuery}
          selectedChain={localChain}
          setSearchQuery={setSearchQuery}
          tokensError={tokensError}
          walletAddress={walletAddress}
        />
      </div>

      <WidgetSecurityFooter />
    </div>
  );
}
