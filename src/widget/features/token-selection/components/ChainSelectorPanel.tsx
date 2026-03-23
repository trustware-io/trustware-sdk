import React from "react";

import type { ChainDef } from "../../../../types";
import { resolveChainLabel } from "../../../../utils";
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
} from "../../../styles";

export interface ChainSelectorPanelProps {
  error: string | null;
  isChainSelected: (chain: ChainDef) => boolean;
  isLoading: boolean;
  onChainSelect: (chain: ChainDef) => void;
  otherChains: ChainDef[];
  popularChains: ChainDef[];
}

function ChainItem({
  chain,
  index,
  isSelected,
  onSelect,
}: {
  chain: ChainDef;
  index: number;
  isSelected: boolean;
  onSelect: (chain: ChainDef) => void;
}) {
  const key =
    chain.id ?? chain.chainId ?? chain.networkIdentifier ?? `chain-${index}`;
  const label = resolveChainLabel(chain);

  return (
    <button
      key={String(key)}
      type="button"
      onClick={() => onSelect(chain)}
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

      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
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
}

export function ChainSelectorPanel({
  error,
  isChainSelected,
  isLoading,
  onChainSelect,
  otherChains,
  popularChains,
}: ChainSelectorPanelProps): React.ReactElement {
  return (
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
          <div
            style={{
              padding: `${spacing[3]} ${spacing[4]}`,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: fontSize.sm, color: colors.destructive }}>
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
            {popularChains.length > 0 && (
              <div style={{ marginBottom: spacing[2] }}>
                <div style={{ padding: `${spacing[1.5]} ${spacing[3]}` }}>
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
                {popularChains.map((chain, idx) => (
                  <ChainItem
                    key={String(
                      chain.id ??
                        chain.chainId ??
                        chain.networkIdentifier ??
                        `popular-${idx}`
                    )}
                    chain={chain}
                    index={idx}
                    isSelected={isChainSelected(chain)}
                    onSelect={onChainSelect}
                  />
                ))}
              </div>
            )}

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
                {otherChains.map((chain, idx) => (
                  <ChainItem
                    key={String(
                      chain.id ??
                        chain.chainId ??
                        chain.networkIdentifier ??
                        `other-${idx}`
                    )}
                    chain={chain}
                    index={popularChains.length + idx}
                    isSelected={isChainSelected(chain)}
                    onSelect={onChainSelect}
                  />
                ))}
              </div>
            )}

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
  );
}
