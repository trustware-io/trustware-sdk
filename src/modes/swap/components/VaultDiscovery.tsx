import React, { useEffect, useMemo, useState } from "react";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "src/widget/styles";
import { TokenSearchInput } from "src/widget/features/token-selection";
import { WidgetSecurityFooter } from "src/widget/components";
import { Trustware } from "src/core";
import {
  searchVaults,
  getVaultDetails,
  getVaultPositions,
  getVaultRedeemActions,
} from "src/core/vaults";
import type { VaultSummary, Position } from "src/core/vaults";
import type { VaultDepositsConfig } from "src/types/config";

export interface VaultDiscoveryProps {
  config: VaultDepositsConfig;
  onSelect: (vault: VaultSummary) => void;
  onBack: () => void;
  /** Used to fetch "Your positions" (BVT-398). Omit/empty to skip that section entirely — no wallet, nothing to show a balance for. */
  walletAddress?: string | null;
}

const usdCompactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});

function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(2)}%`;
}

function formatTvl(vault: VaultSummary): string {
  const usd = Number(vault.tvl.usd);
  if (!Number.isFinite(usd)) return "—";
  return usdCompactFormatter.format(usd);
}

/**
 * `positionValueInAsset` is base units in the asset's own decimals — unlike
 * `asset.balanceUsd` (the wallet's total balance, not this position's),
 * confirmed live to actually vary per position and match `lpToken.balanceUsd`
 * once converted, so it's the one safe to display here.
 */
function formatAssetAmount(rawBaseUnits: string, decimals: number): string {
  const n = Number(rawBaseUnits) / 10 ** decimals;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Bands vaults.fyi's 0-100 reputation composite into a color + label. Bands
 * are this component's own judgment call, not something vaults.fyi defines —
 * chosen to separate "clearly fine" from "look closer" from "risky", not to
 * imply precision the underlying score doesn't have.
 */
function scoreBand(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "Strong", color: "hsl(142 71% 45%)" };
  if (score >= 50) return { label: "Moderate", color: "hsl(45 100% 51%)" };
  return { label: "Weak", color: colors.destructive };
}

/** Header, mirrors SwapTokenSelect's exactly — same back button, same title layout. Reused for both the vault list ("Earn") and the detail screen (the vault's name), with `onBack` meaning different things at each level (exit Earn vs. return to the list). */
function VaultDiscoveryHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
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
        aria-label="Go back"
        style={{
          padding: spacing[1],
          marginRight: spacing[2],
          borderRadius: borderRadius.lg,
          backgroundColor: "transparent",
          border: 0,
          cursor: "pointer",
        }}
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
        {title}
      </h1>
    </div>
  );
}

/**
 * Same row shape as AvailableTokenListItem (icon, name+subtitle, right value,
 * chevron), with an initials avatar in place of a fetched icon — no logo URL
 * exists on VaultSummary yet, and this is exactly the fallback the token list
 * already uses when an icon is missing.
 *
 * Carries a network chip: several real vaults share an identical name across
 * chains (e.g. "Compound v3 USDC" exists on mainnet, base, and optimism
 * simultaneously) — without it there's no way to tell them apart in the list.
 *
 * Tapping opens the detail screen rather than selecting immediately; onOpen
 * carries the vault, VaultDiscovery decides what to do with it.
 */
function VaultRow({
  vault,
  onOpen,
}: {
  vault: VaultSummary;
  onOpen: () => void;
}) {
  const hasFlags = vault.flags.length > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
        padding: `${spacing[2.5]} ${spacing[3]}`,
        borderRadius: borderRadius.lg,
        transition: "background-color 0.2s",
        backgroundColor: "transparent",
        border: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: "9999px",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.primary,
          }}
        >
          {vault.asset.symbol.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: spacing[1.5] }}
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
            {vault.name}
          </span>
          {hasFlags ? (
            <span
              title={vault.flags[0].content}
              style={{
                width: "0.4rem",
                height: "0.4rem",
                borderRadius: "9999px",
                backgroundColor: "hsl(45 100% 51%)",
                flexShrink: 0,
              }}
            />
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[1] }}>
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: fontWeight.medium,
              color: colors.mutedForeground,
              backgroundColor: colors.muted,
              padding: "1px 5px",
              borderRadius: borderRadius.sm,
              flexShrink: 0,
              textTransform: "capitalize",
            }}
          >
            {vault.network.name}
          </span>
          <span
            style={{
              fontSize: fontSize.xs,
              color: colors.mutedForeground,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {vault.protocol.displayName} · {formatTvl(vault)} TVL
          </span>
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: "hsl(142 71% 45%)",
          }}
        >
          {formatPct(vault.apy["7day"].total)}
        </span>
        <span
          style={{
            fontSize: "0.625rem",
            color: colors.mutedForeground,
            display: "block",
          }}
        >
          7d APY
        </span>
      </div>
    </button>
  );
}

/**
 * A row in "Your positions" — same visual language as VaultRow, but shows
 * this position's real held value instead of a discovery stat. Confirmed
 * against a live response (2026-09-23): `lpToken.balanceUsd` is this
 * position's actual value; `asset.balanceUsd` is the wallet's TOTAL balance
 * of that asset repeated identically on every position row, never the
 * per-position value — using it here would show the same dollar figure on
 * every position regardless of size.
 */
function PositionRow({
  position,
  onOpen,
  onWithdraw,
  isOpening,
}: {
  position: Position;
  /** Tapping the row body reopens it for a redeposit (existing behavior). */
  onOpen: () => void;
  /** The separate "Withdraw" action — a sibling control, not nested inside
   * the row's own button, since HTML forbids a button inside a button. */
  onWithdraw: () => void;
  isOpening: boolean;
}) {
  const usd = Number(position.lpToken.balanceUsd);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: borderRadius.lg,
        opacity: isOpening ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={isOpening}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          padding: `${spacing[2.5]} ${spacing[3]} ${spacing[1]}`,
          borderRadius: borderRadius.lg,
          backgroundColor: "transparent",
          border: 0,
          cursor: isOpening ? "default" : "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: "2.25rem",
            height: "2.25rem",
            borderRadius: "9999px",
            backgroundColor: "rgba(34,197,94,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: "hsl(142 71% 45%)",
            }}
          >
            {position.asset.symbol.slice(0, 2).toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.foreground,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {position.name}
          </span>
          <div
            style={{ display: "flex", alignItems: "center", gap: spacing[1] }}
          >
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: fontWeight.medium,
                color: colors.mutedForeground,
                backgroundColor: colors.muted,
                padding: "1px 5px",
                borderRadius: borderRadius.sm,
                flexShrink: 0,
                textTransform: "capitalize",
              }}
            >
              {position.network.name}
            </span>
            <span
              style={{ fontSize: fontSize.xs, color: colors.mutedForeground }}
            >
              {position.protocol.displayName}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.foreground,
            }}
          >
            {Number.isFinite(usd) ? usdCompactFormatter.format(usd) : "—"}
          </span>
          <span
            style={{
              fontSize: "0.625rem",
              color: "hsl(142 71% 45%)",
              display: "block",
            }}
          >
            {formatPct(position.apy.total)} APY
          </span>
        </div>
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: `0 ${spacing[3]} ${spacing[1.5]}`,
        }}
      >
        <button
          type="button"
          onClick={onWithdraw}
          disabled={isOpening}
          style={{
            fontSize: "0.6875rem",
            fontWeight: fontWeight.medium,
            color: colors.mutedForeground,
            background: "none",
            border: 0,
            padding: "2px 4px",
            cursor: isOpening ? "default" : "pointer",
          }}
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}

/** Loading skeleton — same shape/animation as TokenSelectorStateView's, copied rather than reused: that component's non-loading states carry token-specific copy that doesn't fit vaults. */
function VaultListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[3],
            padding: `${spacing[2.5]} ${spacing[3]}`,
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
          <div style={{ flex: 1 }}>
            <div
              style={{
                height: "1rem",
                width: "8rem",
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
        </div>
      ))}
    </div>
  );
}

function VaultStateMessage({
  title,
  detail,
  isError,
}: {
  title: string;
  detail?: string;
  isError?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${spacing[8]} ${spacing[4]}`,
        textAlign: "center",
      }}
    >
      <div>
        <p
          style={{
            fontSize: fontSize.sm,
            color: isError ? colors.destructive : colors.mutedForeground,
          }}
        >
          {title}
        </p>
        {detail ? (
          <p
            style={{
              fontSize: fontSize.xs,
              color: colors.mutedForeground,
              marginTop: spacing[1],
            }}
          >
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** "Find your own vault" — a manual vaultId/network lookup, open mode only. */
function ManualVaultEntry({
  onFound,
}: {
  onFound: (vault: VaultSummary) => void;
}) {
  const [vaultId, setVaultId] = useState("");
  const [network, setNetwork] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = vaultId.trim() !== "" && network.trim() !== "" && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const vault = await getVaultDetails(network.trim(), vaultId.trim());
      onFound(vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vault not found");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: `${spacing[2]} ${spacing[2.5]}`,
    fontSize: fontSize.xs,
    backgroundColor: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.lg,
    color: colors.foreground,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        marginTop: spacing[4],
        paddingTop: spacing[4],
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      <p
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: spacing[2],
        }}
      >
        Find your own vault
      </p>
      <div style={{ display: "flex", gap: spacing[1.5] }}>
        <input
          type="text"
          placeholder="Network (e.g. base)"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Vault address"
          value={vaultId}
          onChange={(e) => setVaultId(e.target.value)}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{
            padding: `${spacing[2]} ${spacing[3]}`,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.semibold,
            borderRadius: borderRadius.lg,
            border: 0,
            backgroundColor: canSubmit ? colors.primary : colors.muted,
            color: canSubmit
              ? colors.primaryForeground
              : colors.mutedForeground,
            cursor: canSubmit ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          {loading ? "…" : "Look up"}
        </button>
      </div>
      {error ? (
        <p
          style={{
            fontSize: fontSize.xs,
            color: colors.destructive,
            marginTop: spacing[1.5],
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

const APY_WINDOWS: { key: keyof VaultSummary["apy"]; label: string }[] = [
  { key: "1hour", label: "1h" },
  { key: "1day", label: "24h" },
  { key: "7day", label: "7d" },
  { key: "30day", label: "30d" },
];

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing[2]} 0`,
      }}
    >
      <span style={{ fontSize: fontSize.sm, color: colors.mutedForeground }}>
        {label}
      </span>
      <span
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: valueColor ?? colors.foreground,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The confirm step between picking a vault and forwarding to swap — every
 * field vaults.fyi's detail response carries that a depositor would actually
 * want before committing: reputation composite (+ its own component scores,
 * since the composite alone hides *why* a vault scored low), every APY
 * window (not just 7d — a vault whose 1h/24h numbers have diverged sharply
 * from its 30d average is worth seeing before depositing), tags, curator
 * (guarded — often empty in real responses), and any active flags in full,
 * not just the dot the list row shows.
 */
function VaultDetailView({
  vault,
  onBack,
  onConfirm,
}: {
  vault: VaultSummary;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const band = scoreBand(vault.score.vaultScore);
  const hasCurator = vault.curator.name.trim() !== "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        maxHeight: "70vh",
      }}
    >
      <VaultDiscoveryHeader title={vault.name} onBack={onBack} />

      <div style={{ flex: 1, overflow: "auto", padding: spacing[4] }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            marginBottom: spacing[1],
          }}
        >
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: fontWeight.medium,
              color: colors.mutedForeground,
              backgroundColor: colors.muted,
              padding: "1px 6px",
              borderRadius: borderRadius.sm,
              textTransform: "capitalize",
            }}
          >
            {vault.network.name}
          </span>
        </div>
        <p
          style={{
            fontSize: fontSize.xs,
            color: colors.mutedForeground,
            marginTop: 0,
            marginBottom: spacing[4],
          }}
        >
          {vault.protocol.displayName} · {vault.asset.symbol}
          {hasCurator ? ` · Curated by ${vault.curator.name}` : ""}
        </p>

        {vault.flags.length > 0 ? (
          <div
            style={{
              marginBottom: spacing[4],
              padding: spacing[3],
              borderRadius: borderRadius.lg,
              backgroundColor: "rgba(234,179,8,0.1)",
              border: "1px solid rgba(234,179,8,0.4)",
            }}
          >
            {vault.flags.map((f, i) => (
              <p
                key={i}
                style={{
                  fontSize: fontSize.xs,
                  color: colors.foreground,
                  margin: i === 0 ? 0 : `${spacing[1]} 0 0`,
                }}
              >
                {f.content}
              </p>
            ))}
          </div>
        ) : null}

        {/* APY across every window vaults.fyi reports */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: spacing[2],
            marginBottom: spacing[4],
          }}
        >
          {APY_WINDOWS.map(({ key, label }) => (
            <div
              key={key}
              style={{
                textAlign: "center",
                padding: spacing[2],
                borderRadius: borderRadius.lg,
                backgroundColor: colors.muted,
              }}
            >
              <div
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: "hsl(142 71% 45%)",
                }}
              >
                {formatPct(vault.apy[key].total)}
              </div>
              <div
                style={{
                  fontSize: "0.625rem",
                  color: colors.mutedForeground,
                  marginTop: "2px",
                }}
              >
                {label} APY
              </div>
            </div>
          ))}
        </div>

        <StatRow label="TVL" value={formatTvl(vault)} />
        <StatRow
          label="Reputation"
          value={`${Math.round(vault.score.vaultScore)}/100 · ${band.label}`}
          valueColor={band.color}
        />
        <StatRow
          label="Vault TVL score"
          value={Math.round(vault.score.vaultTvlScore)}
        />
        <StatRow
          label="Protocol TVL score"
          value={Math.round(vault.score.protocolTvlScore)}
        />
        <StatRow
          label="Holder score"
          value={Math.round(vault.score.holderScore)}
        />
        <StatRow
          label="Asset score"
          value={Math.round(vault.score.assetScore)}
        />

        {vault.tags.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing[1.5],
              marginTop: spacing[3],
            }}
          >
            {vault.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.625rem",
                  color: colors.mutedForeground,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.full,
                  padding: "2px 8px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div
        style={{ padding: spacing[4], borderTop: `1px solid ${colors.border}` }}
      >
        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: "100%",
            padding: `${spacing[3]} 0`,
            borderRadius: borderRadius.lg,
            border: 0,
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: "pointer",
          }}
        >
          Deposit into this vault
        </button>
      </div>
    </div>
  );
}

type WithdrawStatus = "idle" | "submitting" | "success" | "error";

/**
 * The confirm screen for "Withdraw" on a position row (BVT-398 withdrawal).
 * Full-balance redeem only, back to the position's own asset on its own
 * chain — vaults.fyi's redeem action never bridges (confirmed live), so
 * moving the withdrawn asset elsewhere (a different chain, a different
 * vault) is a second, ordinary step the user takes from the swap home
 * screen afterward, not something this screen does for them.
 */
function VaultWithdrawConfirm({
  position,
  status,
  error,
  txHash,
  onBack,
  onConfirm,
}: {
  position: Position;
  status: WithdrawStatus;
  error: string | null;
  txHash: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const submitting = status === "submitting";
  const succeeded = status === "success";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        maxHeight: "70vh",
      }}
    >
      <VaultDiscoveryHeader
        title={`Withdraw · ${position.name}`}
        onBack={onBack}
      />

      <div style={{ flex: 1, overflow: "auto", padding: spacing[4] }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            marginBottom: spacing[1],
          }}
        >
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: fontWeight.medium,
              color: colors.mutedForeground,
              backgroundColor: colors.muted,
              padding: "1px 6px",
              borderRadius: borderRadius.sm,
              textTransform: "capitalize",
            }}
          >
            {position.network.name}
          </span>
        </div>
        <p
          style={{
            fontSize: fontSize.xs,
            color: colors.mutedForeground,
            marginTop: 0,
            marginBottom: spacing[4],
          }}
        >
          {position.protocol.displayName} · {position.asset.symbol}
        </p>

        <div
          style={{
            textAlign: "center",
            padding: spacing[4],
            borderRadius: borderRadius.lg,
            backgroundColor: colors.muted,
            marginBottom: spacing[4],
          }}
        >
          <div
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.foreground,
            }}
          >
            {formatAssetAmount(
              position.asset.positionValueInAsset,
              position.asset.decimals
            )}{" "}
            {position.asset.symbol}
          </div>
          <div
            style={{
              fontSize: fontSize.xs,
              color: colors.mutedForeground,
              marginTop: spacing[1],
            }}
          >
            ≈{" "}
            {Number.isFinite(Number(position.lpToken.balanceUsd))
              ? usdCompactFormatter.format(Number(position.lpToken.balanceUsd))
              : "—"}
          </div>
        </div>

        <StatRow
          label="Returns to"
          value={`Your wallet, on ${position.network.name}`}
        />
        <StatRow
          label="Current APY"
          value={formatPct(position.apy.total)}
          valueColor="hsl(142 71% 45%)"
        />

        <p
          style={{
            fontSize: fontSize.xs,
            color: colors.mutedForeground,
            marginTop: spacing[3],
          }}
        >
          Withdraws your full balance from this vault back to{" "}
          {position.asset.symbol} on {position.network.name}. To move it to
          another chain or a different vault, do that as a separate step
          afterward from the swap screen.
        </p>

        {status === "error" && error ? (
          <div
            style={{
              marginTop: spacing[3],
              padding: spacing[3],
              borderRadius: borderRadius.lg,
              backgroundColor: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.4)",
            }}
          >
            <p
              style={{
                fontSize: fontSize.xs,
                color: colors.destructive,
                margin: 0,
              }}
            >
              {error}
            </p>
          </div>
        ) : null}

        {succeeded && txHash ? (
          <div
            style={{
              marginTop: spacing[3],
              padding: spacing[3],
              borderRadius: borderRadius.lg,
              backgroundColor: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.4)",
            }}
          >
            <p
              style={{
                fontSize: fontSize.xs,
                color: colors.foreground,
                margin: 0,
              }}
            >
              Withdrawn. Tx: {txHash.slice(0, 10)}…{txHash.slice(-6)}
            </p>
          </div>
        ) : null}
      </div>

      <div
        style={{ padding: spacing[4], borderTop: `1px solid ${colors.border}` }}
      >
        <button
          type="button"
          onClick={succeeded ? onBack : onConfirm}
          disabled={submitting}
          style={{
            width: "100%",
            padding: `${spacing[3]} 0`,
            borderRadius: borderRadius.lg,
            border: 0,
            backgroundColor: submitting ? colors.muted : colors.primary,
            color: submitting
              ? colors.mutedForeground
              : colors.primaryForeground,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {succeeded
            ? "Done"
            : submitting
              ? "Confirm in wallet…"
              : status === "error"
                ? "Try again"
                : "Withdraw"}
        </button>
      </div>
    </div>
  );
}

/**
 * The "Earn" screen (BVT-398) — a vault picker forwarded to the swap flow.
 * Reached from the settings popover once a wallet is connected. Two modes
 * from `config` (see VaultDepositsConfig): `curated` fetches detail for the
 * client's own whitelist (no discovery call); `open` searches vaults.fyi's
 * full catalog through the backend proxy, bounded by floor filters, plus an
 * optional manual vaultId/network lookup.
 */
export function VaultDiscovery({
  config,
  onSelect,
  onBack,
  walletAddress,
}: VaultDiscoveryProps): React.ReactElement {
  const [vaults, setVaults] = useState<VaultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Set once a row (or a manual lookup) is tapped — renders the confirm
  // screen in place of the list. null means "showing the list".
  const [detailVault, setDetailVault] = useState<VaultSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [openingPositionId, setOpeningPositionId] = useState<string | null>(
    null
  );
  // Set once "Withdraw" is tapped on a position — renders the withdraw
  // confirm screen in place of the list, mutually exclusive with detailVault.
  const [withdrawingPosition, setWithdrawingPosition] =
    useState<Position | null>(null);
  const [withdrawStatus, setWithdrawStatus] = useState<WithdrawStatus>("idle");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears stale positions if the wallet disconnects while this screen is open
      setPositions([]);
      return;
    }
    let cancelled = false;
    getVaultPositions(walletAddress)
      .then((result) => {
        if (!cancelled) setPositions(result);
      })
      .catch(() => {
        // Non-fatal: the discovery list is the primary content of this
        // screen, and a portfolio-fetch failure shouldn't block it.
        if (!cancelled) setPositions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // Reopens a position with fresh, full detail (score/tags/TVL — a position
  // response carries none of that) rather than building a VaultDetailView
  // from the thinner Position shape directly. Also doubles as the
  // "redeposit into an existing position" entry point, since it lands on
  // the exact same confirm screen a fresh selection would.
  const handleOpenPosition = (position: Position) => {
    setOpeningPositionId(position.vaultId);
    getVaultDetails(position.network.name, position.vaultId)
      .then((full) => setDetailVault(full))
      .finally(() => setOpeningPositionId(null));
  };

  const handleStartWithdraw = (position: Position) => {
    setWithdrawStatus("idle");
    setWithdrawError(null);
    setWithdrawTxHash(null);
    setWithdrawingPosition(position);
  };

  // Full-balance redeem only (all: true) — matches this backend endpoint's
  // one supported flow for now; a partial-withdraw amount input is a later
  // increment, same "one thing works end-to-end before generalizing"
  // discipline as the rest of this ticket.
  const handleConfirmWithdraw = async () => {
    if (!withdrawingPosition || !walletAddress) return;
    const position = withdrawingPosition;
    setWithdrawStatus("submitting");
    setWithdrawError(null);
    try {
      const actions = await getVaultRedeemActions({
        address: walletAddress,
        network: position.network.name,
        vaultId: position.vaultId,
        assetAddress: position.asset.address,
        all: true,
      });
      let lastHash: string | null = null;
      for (const action of actions) {
        lastHash = await Trustware.sendVaultRedeemTx(action);
      }
      setWithdrawTxHash(lastHash);
      setWithdrawStatus("success");
      setPositions((prev) =>
        prev.filter(
          (p) =>
            !(
              p.vaultId === position.vaultId &&
              p.network.name === position.network.name
            )
        )
      );
    } catch (err) {
      setWithdrawStatus("error");
      setWithdrawError(
        err instanceof Error ? err.message : "Withdrawal failed"
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets loading/error state at the start of each fetch triggered by a config change, not a render-time value
    setLoading(true);
    setError(null);

    const load =
      config.mode === "curated"
        ? Promise.all(
            config.curated.map((v) =>
              getVaultDetails(v.network, v.vaultId).catch(() => null)
            )
          ).then((results) =>
            results.filter((v): v is VaultSummary => v !== null)
          )
        : searchVaults({
            minTvl: config.open?.minTvl,
            minApy: config.open?.minApy,
            allowedProtocols: config.open?.allowedProtocols,
            disallowedProtocols: config.open?.disallowedProtocols,
            sortBy: "apy7day",
            sortOrder: "desc",
            perPage: 25,
          }).then((r) => r.vaults);

    load
      .then((result) => {
        if (cancelled) return;
        setVaults(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load vaults");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config]);

  const filteredVaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vaults;
    return vaults.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.protocol.displayName.toLowerCase().includes(q) ||
        v.asset.symbol.toLowerCase().includes(q)
    );
  }, [vaults, searchQuery]);

  const allowManualEntry =
    config.mode === "open" && (config.open?.allowManualEntry ?? true);

  if (detailVault) {
    return (
      <VaultDetailView
        vault={detailVault}
        onBack={() => setDetailVault(null)}
        onConfirm={() => onSelect(detailVault)}
      />
    );
  }

  if (withdrawingPosition) {
    return (
      <VaultWithdrawConfirm
        position={withdrawingPosition}
        status={withdrawStatus}
        error={withdrawError}
        txHash={withdrawTxHash}
        onBack={() => setWithdrawingPosition(null)}
        onConfirm={() => void handleConfirmWithdraw()}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        maxHeight: "70vh",
      }}
    >
      <VaultDiscoveryHeader title="Earn" onBack={onBack} />

      <div style={{ flex: 1, overflow: "auto", padding: spacing[3] }}>
        {positions.length > 0 ? (
          <div style={{ marginBottom: spacing[4] }}>
            <p
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: spacing[2],
                paddingLeft: spacing[1],
              }}
            >
              Your positions
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing[1],
              }}
            >
              {positions.map((p) => (
                <PositionRow
                  key={`${p.network.name}:${p.vaultId}`}
                  position={p}
                  onOpen={() => handleOpenPosition(p)}
                  onWithdraw={() => handleStartWithdraw(p)}
                  isOpening={openingPositionId === p.vaultId}
                />
              ))}
            </div>
          </div>
        ) : null}

        {config.mode === "open" ? (
          <div style={{ marginBottom: spacing[3] }}>
            <TokenSearchInput
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>
        ) : null}

        {loading ? (
          <VaultListSkeleton />
        ) : error ? (
          <VaultStateMessage
            title="Couldn't load vaults"
            detail={error}
            isError
          />
        ) : filteredVaults.length === 0 ? (
          <VaultStateMessage
            title={
              searchQuery
                ? `No vaults matching "${searchQuery}"`
                : "No vaults available"
            }
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[1],
            }}
          >
            {filteredVaults.map((v) => (
              <VaultRow
                key={`${v.network.name}:${v.vaultId}`}
                vault={v}
                onOpen={() => setDetailVault(v)}
              />
            ))}
          </div>
        )}

        {allowManualEntry ? (
          <ManualVaultEntry onFound={setDetailVault} />
        ) : null}
      </div>

      <WidgetSecurityFooter />
    </div>
  );
}
