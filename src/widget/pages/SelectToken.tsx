import React, { useCallback, useMemo } from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles";

import { useDeposit } from "../context/DepositContext";
import type { Chain, Token, YourTokenData } from "../context/DepositContext";

import { formatTokenBalance, resolveChainLabel } from "../../utils";
import type { ChainDef } from "../../types/";
import { getBalances } from "src/core/balances";
import { useChains, useTokens } from "../hooks";

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
  const {
    selectedChain,
    setSelectedChain,
    setSelectedToken,
    goBack,
    walletAddress,
    yourWalletTokens,
  } = useDeposit();
  const { popularChains, otherChains, isLoading, error } = useChains();
  const {
    filteredTokens,
    isLoading: isLoadingTokens,
    error: tokensError,
    searchQuery,
    setSearchQuery,
  } = useTokens((selectedChain?.chainId as number) ?? null);

  /**
   * Handle chain selection
   */
  const handleChainSelect = (chain: ChainDef) => {
    // Convert ChainDef to our Chain interface for context
    // console.log({ chainselect: chain });
    const chainId = Number(chain.chainId ?? chain.id);
    setSelectedChain({
      chainId,
      name: resolveChainLabel(chain),
      shortName:
        chain.nativeCurrency?.symbol ??
        resolveChainLabel(chain).slice(0, 3).toUpperCase(),
      iconUrl: chain.chainIconURI,
      isPopular: [1, 137, 8453].includes(chainId),
      nativeToken: chain.nativeCurrency?.symbol,
      explorerUrl: chain.blockExplorerUrls?.[0],
    } as Chain);
  };

  // Get balance in USD

  /**
   * Handle token selection
   */
  const handleTokenSelect = async (token: Token) => {
    // console.log({ selectToken: token });
    if (token.balance !== undefined) return (setSelectedToken(token), goBack());

    const balance = await getBalances(
      selectedChain?.chainId as string | number,
      walletAddress as string
    );

    const match = balance.find(
      (b) => b.contract?.toLowerCase() === token.address.toLowerCase()
    );
    const tokenWithBalance = {
      ...token,
      balance: match?.balance?.toString?.() ?? "0",
    };

    const concToken = {
      ...tokenWithBalance,
      chainData: selectedChain as Chain,
    } as unknown as YourTokenData;

    setSelectedToken(concToken);

    goBack();
  };

  const handleYourTokenSelect = useCallback(
    (token: YourTokenData) => {
      setSelectedToken(token);
      setSelectedChain(token.chainData as Chain);
      goBack();
    },
    [goBack, setSelectedChain, setSelectedToken]
  );

  /**
   * Check if a chain is currently selected
   */
  const isChainSelected = (chain: ChainDef): boolean => {
    if (!selectedChain) return false;
    const chainId = Number(chain.chainId ?? chain.id);
    return selectedChain.chainId === chainId;
  };

  const normalizedSearchQuery = searchQuery.toLowerCase().trim();

  const matchesSearch = (token: {
    symbol?: string;
    name?: string;
    address?: string;
  }) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    const symbol = token.symbol?.toLowerCase() ?? "";
    const name = token.name?.toLowerCase() ?? "";
    const address = token.address?.toLowerCase() ?? "";

    return (
      symbol.includes(normalizedSearchQuery) ||
      name.includes(normalizedSearchQuery) ||
      address.includes(normalizedSearchQuery)
    );
  };

  const filteredWalletTokens = useMemo(() => {
    if (!selectedChain?.chainId) {
      return [];
    }

    return (yourWalletTokens ?? []).filter((token) => {
      return (
        Number(token.chainId) === Number(selectedChain.chainId) &&
        matchesSearch(token)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSearchQuery, selectedChain?.chainId, yourWalletTokens]);

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
        style={{
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
          ...(isSelected && {
            border: `1px solid ${colors.primary}`,
            backgroundColor: "rgba(59, 130, 246, 0.1)",
          }),
        }}
      >
        {/* Chain Icon */}
        {chain.chainIconURI ? (
          <img
            src={chain.chainIconURI}
            alt={label}
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "9999px",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "9999px",
              backgroundColor: colors.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: colors.mutedForeground,
              }}
            >
              {label.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Chain Name */}
        <div
          style={{
            flex: 1,
            textAlign: "left",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.foreground,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {label}
          </span>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div
            style={{
              width: "1.25rem",
              height: "1.25rem",
              borderRadius: "9999px",
              backgroundColor: colors.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              style={{
                width: "0.75rem",
                height: "0.75rem",
                color: colors.primaryForeground,
              }}
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
        {/* Left Column - Chain Selector */}
        <div
          style={{
            width: "140px",
            borderRight: `1px solid ${colors.border}`,
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
            <span
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
                color: colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Chain
            </span>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: `${spacing[2]} ${spacing[1]}`,
            }}
          >
            {isLoading ? (
              // Loading skeleton
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[2],
                  padding: `0 ${spacing[2]}`,
                }}
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[3],
                      padding: `${spacing[2]} 0`,
                    }}
                  >
                    <div
                      style={{
                        width: "2rem",
                        height: "2rem",
                        borderRadius: "9999px",
                        backgroundColor: colors.muted,
                      }}
                      className="tw-animate-pulse"
                    />
                    <div
                      style={{
                        flex: 1,
                        height: "1rem",
                        backgroundColor: colors.muted,
                        borderRadius: borderRadius.md,
                      }}
                      className="tw-animate-pulse"
                    />
                  </div>
                ))}
              </div>
            ) : error ? (
              // Error state
              <div
                style={{
                  padding: `${spacing[3]} ${spacing[4]}`,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: fontSize.sm,
                    color: colors.destructive,
                  }}
                >
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{
                    marginTop: spacing[2],
                    fontSize: fontSize.xs,
                    color: colors.primary,
                    backgroundColor: "transparent",
                    border: 0,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Popular Chains Section */}
                {popularChains.length > 0 && (
                  <div
                    style={{
                      marginBottom: spacing[2],
                    }}
                  >
                    <div
                      style={{
                        padding: `${spacing[1.5]} ${spacing[3]}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: fontWeight.medium,
                          color: "rgba(161, 161, 170, 0.7)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Popular
                      </span>
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
                          padding: `${spacing[1.5]} ${spacing[3]}`,
                          marginTop: spacing[2],
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: fontWeight.medium,
                            color: "rgba(161, 161, 170, 0.7)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          All Chains
                        </span>
                      </div>
                    )}
                    {otherChains.map((chain, idx) =>
                      renderChainItem(chain, popularChains.length + idx)
                    )}
                  </div>
                )}

                {/* Empty state */}
                {popularChains.length === 0 && otherChains.length === 0 && (
                  <div
                    style={{
                      padding: `${spacing[3]} ${spacing[4]}`,
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: fontSize.sm,
                        color: colors.mutedForeground,
                      }}
                    >
                      No chains available
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column - Token Selector */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header with search */}
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
            {/* Search Input */}
            {selectedChain && (
              <div
                style={{
                  position: "relative",
                }}
              >
                <svg
                  style={{
                    position: "absolute",
                    left: spacing[2.5],
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "1rem",
                    height: "1rem",
                    color: colors.mutedForeground,
                  }}
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
                  style={{
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
                  }}
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{
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
                    }}
                    aria-label="Clear search"
                  >
                    <svg
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        color: colors.mutedForeground,
                      }}
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
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: `${spacing[2]} ${spacing[1]}`,
            }}
          >
            {!selectedChain ? (
              // No chain selected
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `0 ${spacing[4]}`,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                  }}
                >
                  <svg
                    style={{
                      width: "3rem",
                      height: "3rem",
                      margin: `0 auto ${spacing[3]}`,
                      color: "rgba(161, 161, 170, 0.5)",
                    }}
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
                  <p
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.mutedForeground,
                    }}
                  >
                    Select a chain to view available tokens
                  </p>
                </div>
              </div>
            ) : isLoadingTokens ? (
              // Loading skeleton
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[2],
                  padding: `0 ${spacing[2]}`,
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[3],
                      padding: `${spacing[2.5]} ${spacing[2]}`,
                    }}
                  >
                    <div
                      style={{
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "9999px",
                        backgroundColor: colors.muted,
                      }}
                      className="tw-animate-pulse"
                    />
                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          height: "1rem",
                          width: "4rem",
                          backgroundColor: colors.muted,
                          borderRadius: borderRadius.md,
                          marginBottom: spacing[1.5],
                        }}
                        className="tw-animate-pulse"
                      />
                      <div
                        style={{
                          height: "0.75rem",
                          width: "6rem",
                          backgroundColor: colors.muted,
                          borderRadius: borderRadius.md,
                        }}
                        className="tw-animate-pulse"
                      />
                    </div>
                    <div
                      style={{
                        height: "1rem",
                        width: "3.5rem",
                        backgroundColor: colors.muted,
                        borderRadius: borderRadius.md,
                      }}
                      className="tw-animate-pulse"
                    />
                  </div>
                ))}
              </div>
            ) : tokensError ? (
              // Error state
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `0 ${spacing[4]}`,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                  }}
                >
                  <svg
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      margin: `0 auto ${spacing[2]}`,
                      color: colors.destructive,
                    }}
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
                      fontSize: fontSize.sm,

                      color: colors.destructive,
                      marginBottom: spacing[2],
                    }}
                  >
                    {tokensError}
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={{
                      marginTop: spacing[2],
                      fontSize: fontSize.xs,
                      color: colors.primary,
                      backgroundColor: "transparent",
                      border: 0,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : filteredTokens.length === 0 ? (
              // No tokens found
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `0 ${spacing[4]}`,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                  }}
                >
                  <svg
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      margin: `0 auto ${spacing[2]}`,
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" d="m21 21-4.35-4.35" />
                    <path strokeLinecap="round" d="M8 11h6" />
                  </svg>
                  <p
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.mutedForeground,
                    }}
                  >
                    {searchQuery
                      ? `No tokens matching "${searchQuery}"`
                      : "No tokens available"}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      style={{
                        marginTop: spacing[2],
                        fontSize: fontSize.xs,
                        color: colors.primary,
                        backgroundColor: "transparent",
                        border: 0,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // Token list
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
                    {/* <Sparkles className="w-3.5 h-3.5 text-primary" /> */}
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
                  <button
                    onClick={() => handleYourTokenSelect(token)}
                    style={{
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
                    }}
                    key={`${token.address}-${i}`}
                  >
                    {/* Token Icon with Chain Badge */}
                    <div
                      style={{
                        position: "relative",
                      }}
                    >
                      {token.iconUrl ||
                      (token as typeof token & { logo_url: string })
                        .logo_url ? (
                        <img
                          src={
                            token.iconUrl ||
                            (token as typeof token & { logo_url: string })
                              .logo_url
                          }
                          alt={token.symbol}
                          style={{
                            width: "2.25rem",
                            height: "2.25rem",
                            borderRadius: "9999px",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "2.25rem",
                            height: "2.25rem",
                            borderRadius: "9999px",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: colors.foreground,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {token.symbol}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "-0.125rem",
                          right: "-0.125rem",
                          width: "1rem",
                          height: "1rem",
                          borderRadius: "100%",
                          backgroundColor: colors.background,
                          border: `2px solid ${colors.background}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <img
                          src={token.chainIconURI}
                          alt={token.chainId?.toString()}
                          style={{
                            width: "0.875rem",
                            height: "0.875rem",
                            borderRadius: "9999px",
                          }}
                        />
                      </div>
                    </div>

                    {/* Token Info */}
                    <div
                      style={{
                        flex: 1,
                        textAlign: "left",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: spacing[1.5],
                        }}
                      >
                        <span
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.semibold,
                            color: colors.foreground,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {token.symbol}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.mutedForeground,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {formatTokenBalance(token.balance, token.decimals)}{" "}
                        {token.symbol}
                      </span>
                    </div>
                  </button>
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

                {filteredTokens.map((token: Token, i) => (
                  <button
                    type="button"
                    onClick={() => handleTokenSelect(token)}
                    style={{
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
                    }}
                    key={`${token.address}-${i}`}
                  >
                    {/* Token Icon */}
                    {token.iconUrl ? (
                      <img
                        src={token.iconUrl}
                        alt={token.symbol}
                        style={{
                          width: "2.25rem",
                          height: "2.25rem",
                          borderRadius: "9999px",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
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
                        width: "2.25rem",
                        height: "2.25rem",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        display: token.iconUrl ? "none" : "flex",
                      }}
                    >
                      <span
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                          color: colors.primary,
                        }}
                      >
                        {token.symbol.slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    {/* Token Info */}
                    <div
                      style={{
                        flex: 1,
                        textAlign: "left",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: spacing[1.5],
                        }}
                      >
                        <span
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.semibold,
                            color: colors.foreground,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {token.symbol}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.mutedForeground,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {token.name}
                      </span>
                    </div>

                    {/* Token Balance (if wallet connected) */}
                    {token.balance !== undefined && (
                      <div
                        style={{
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.medium,
                            color: colors.foreground,
                          }}
                        >
                          {formatTokenBalance(token.balance, token.decimals)}
                        </span>
                      </div>
                    )}

                    {/* Chevron */}
                    <svg
                      style={{
                        width: "1rem",
                        height: "1rem",
                        color: colors.mutedForeground,
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
      <div
        style={{
          padding: `${spacing[4]} ${spacing[6]}`,
          borderTop: `1px solid rgba(63, 63, 70, 0.3)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[2],
          }}
        >
          <svg
            style={{
              width: "0.875rem",
              height: "0.875rem",
              color: colors.mutedForeground,
            }}
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
          <span
            style={{
              fontSize: fontSize.sm,
              color: colors.mutedForeground,
            }}
          >
            Secured by{" "}
            <span
              style={{
                fontWeight: fontWeight.semibold,
                color: colors.foreground,
              }}
            >
              Trustware
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default SelectToken;
