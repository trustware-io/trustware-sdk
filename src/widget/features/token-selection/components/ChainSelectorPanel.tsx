import React, { useState, useMemo } from "react";

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
          loading="lazy"
          style={{
            width: "1.5rem",
            height: "1.5rem",
            borderRadius: "9999px",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: "1.5rem",
            height: "1.5rem",
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

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: "spark" | "sort";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: `${spacing[1.5]} ${spacing[3]}`,
        marginTop: spacing[2],
      }}
    >
      {icon === "spark" ? (
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
            d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
          />
        </svg>
      )}
      <span
        style={{
          fontSize: "10px",
          fontWeight: fontWeight.medium,
          color: colors.primary,
        }}
      >
        {children}
      </span>
    </div>
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
  const [chainSearch, setChainSearch] = useState("");

  const filteredPopular = useMemo(() => {
    if (!chainSearch) return popularChains;
    const q = chainSearch.toLowerCase();
    return popularChains.filter((c) =>
      resolveChainLabel(c).toLowerCase().includes(q)
    );
  }, [popularChains, chainSearch]);

  const filteredOther = useMemo(() => {
    if (!chainSearch) return otherChains;
    const q = chainSearch.toLowerCase();
    return otherChains.filter((c) =>
      resolveChainLabel(c).toLowerCase().includes(q)
    );
  }, [otherChains, chainSearch]);

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
      {/* Chain search */}
      <div
        style={{
          padding: `${spacing[2]} ${spacing[2]}`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ position: "relative" }}>
          <svg
            style={{
              position: "absolute",
              left: spacing[2.5],
              top: "50%",
              transform: "translateY(-50%)",
              width: "1rem",
              height: "1rem",
              color: colors.mutedForeground,
              pointerEvents: "none",
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
            placeholder="Chain"
            value={chainSearch}
            onChange={(e) => setChainSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              paddingLeft: spacing[8],
              paddingRight: spacing[3],
              paddingTop: spacing[2],
              paddingBottom: spacing[2],
              fontSize: fontSize.sm,
              backgroundColor: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.lg,
              color: colors.foreground,
              outline: "none",
              transition: "all 0.2s",
            }}
          />
        </div>
      </div>

      {/* Chain list */}
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
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
            {filteredPopular.length > 0 && (
              <div>
                <SectionLabel icon="spark">Popular chains</SectionLabel>
                {filteredPopular.map((chain, idx) => (
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

            {filteredOther.length > 0 && (
              <div>
                <SectionLabel icon="sort">Chains A-Z</SectionLabel>
                {filteredOther.map((chain, idx) => (
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

            {filteredPopular.length === 0 && filteredOther.length === 0 && (
              <div
                style={{
                  padding: `${spacing[3]} ${spacing[2]}`,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.mutedForeground,
                  }}
                >
                  No chains found
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
