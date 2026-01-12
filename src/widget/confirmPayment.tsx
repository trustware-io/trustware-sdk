import { useEffect, useMemo, useState } from "react";
import type { ChainDef, TokenDef } from "src/types";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import { getBalances, type BalanceRow } from "src/core/balances";
import { walletManager } from "src/wallets";
import {
  encodeAllowanceCallData,
  encodeApproveCallData,
  formatUsd,
  hexToBigInt,
  hexToRgba,
  resolveChainLabel,
  weiToDecimalString,
} from "src/utils";
import type { TrustwareRouteState } from "src/hooks";

export type ConfirmPaymentProps = {
  amount: string; // wei string (from AmountInput)
  selectedChain: ChainDef | null;
  selectedToken: TokenDef | null;
  routeState: TrustwareRouteState;
  routeRefreshMs?: number;
  onBack: () => void;
  onConfirm: () => void; // parent advances flow; this component doesn't send tx
};
// Try to pick spender from txReq (routeState) or optional chain contracts shape if present.
function pickSpender(
  txReq: { to?: string; target?: string } | undefined,
  chain: ChainDef | null
): string | null {
  const fromRoute = txReq?.to || txReq?.target;
  if (fromRoute) return fromRoute;
  const c =
    (chain as ChainDef & { squidContracts?: Record<string, string> })
      ?.squidContracts ?? {};
  return c.squidRouter ?? c.squidMulticall ?? c.squidCoralMulticall ?? null;
}

const MAX_UINT256 = (1n << 256n) - 1n;

export function ConfirmPayment({
  amount,
  selectedChain,
  selectedToken,
  routeState,
  routeRefreshMs,
  onBack,
  onConfirm,
}: ConfirmPaymentProps) {
  const { theme, messages } = useTrustwareConfig();
  const radius = theme.radius ?? 12;

  const amountWei = useMemo(() => {
    try {
      const v = BigInt(amount || "0");
      return v > 0n ? v : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const chainLabel = useMemo(
    () => (selectedChain ? resolveChainLabel(selectedChain) : "Unknown chain"),
    [selectedChain]
  );

  const tokenSymbol = selectedToken?.symbol ?? "TOKEN";
  const tokenDecimals = selectedToken?.decimals ?? 18;
  const tokenPriceUSD =
    typeof selectedToken?.usdPrice === "number" &&
    isFinite(selectedToken.usdPrice!)
      ? (selectedToken!.usdPrice as number)
      : null;

  // Derived amount displays
  const amountTokenStr = useMemo(() => {
    if (amountWei <= 0n) return "";
    return weiToDecimalString(amountWei, tokenDecimals, 8);
  }, [amountWei, tokenDecimals]);

  const amountUsdStr = useMemo(() => {
    if (amountWei <= 0n || !tokenPriceUSD) return "";
    const units = Number(
      weiToDecimalString(amountWei, tokenDecimals, Math.max(6, tokenDecimals))
    );
    if (!isFinite(units)) return "";
    return formatUsd(units * tokenPriceUSD);
  }, [amountWei, tokenDecimals, tokenPriceUSD]);

  // Route info (estimated receive / min)
  const routeInfo = useMemo(() => {
    if (routeState.status !== "ready") return null;
    const exchange = routeState.finalExchangeRate ?? {};
    const rawEstimate = routeState.raw?.route?.estimate ?? {};
    const fees =
      ((rawEstimate as Record<string, unknown>)?.fees as
        | Record<string, string>
        | undefined) ?? {};
    return {
      toAmount: exchange.toAmount ?? rawEstimate?.toAmount ?? null,
      minAmount:
        exchange.minimumReceived ??
        fees?.minimumReceived ??
        fees?.minimumReceivedAmount ??
        fees?.minReceived ??
        rawEstimate?.toAmount ??
        null,
    };
  }, [routeState]);

  // Timer (to mimic frontend UX)
  const refreshSeconds = Math.max(
    1,
    Math.ceil((routeRefreshMs ?? 60_000) / 1000)
  );
  const [timeLeft, setTimeLeft] = useState(refreshSeconds);
  useEffect(() => {
    if (routeState.status !== "ready") {
      setTimeLeft(refreshSeconds);
      return;
    }
    setTimeLeft(refreshSeconds);
    const t = setInterval(() => setTimeLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [refreshSeconds, routeState.status, routeState.intentId]);

  // Balance for selected token
  const [balanceWei, setBalanceWei] = useState<bigint>(0n);
  const [loadingBal, setLoadingBal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedChain || !selectedToken) return;
      const canonical = Number(selectedChain.chainId ?? selectedChain.id);
      if (!Number.isFinite(canonical)) return;

      const wallet = walletManager.simple;
      const address = wallet
        ? await wallet.getAddress().catch(() => undefined)
        : undefined;
      if (!address) {
        setBalanceWei(0n);
        return;
      }

      setLoadingBal(true);
      try {
        const rows: BalanceRow[] = await getBalances(canonical, address);
        const addrLower = (selectedToken.address || "").toLowerCase();
        const row =
          rows.find(
            (r) =>
              r.category === "erc20" && r.contract?.toLowerCase() === addrLower
          ) || rows.find((r) => r.category === "native");
        const b = row?.balance ? BigInt(row.balance) : 0n;
        if (!cancelled) setBalanceWei(b);
      } catch {
        if (!cancelled) setBalanceWei(0n);
      } finally {
        if (!cancelled) setLoadingBal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChain, selectedToken]);

  const balanceTokStr = useMemo(
    () => weiToDecimalString(balanceWei, tokenDecimals, 6),
    [balanceWei, tokenDecimals]
  );
  const balanceUsdStr = useMemo(() => {
    if (!(tokenPriceUSD && balanceWei >= 0n)) return "";
    const units = Number(balanceTokStr || "0");
    return formatUsd(units * tokenPriceUSD);
  }, [balanceTokStr, tokenPriceUSD, balanceWei]);

  const remainingWei = useMemo(
    () => balanceWei - amountWei,
    [balanceWei, amountWei]
  );
  const remainingTokStr = useMemo(
    () =>
      remainingWei >= 0n
        ? weiToDecimalString(remainingWei, tokenDecimals, 6)
        : "0",
    [remainingWei, tokenDecimals]
  );
  const remainingUsdStr = useMemo(() => {
    if (!(tokenPriceUSD && remainingWei >= 0n)) return "";
    const units = Number(remainingTokStr || "0");
    return formatUsd(units * tokenPriceUSD);
  }, [remainingTokStr, tokenPriceUSD, remainingWei]);

  // Spender + allowance (best-effort; SDK-only)
  const txReq = routeState.status === "ready" ? routeState.txReq : undefined;
  const spender = pickSpender(txReq, selectedChain);

  const isNative =
    (selectedToken?.address?.toLowerCase?.() ?? "") ===
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const [allowanceWei, setAllowanceWei] = useState<bigint | null>(
    isNative ? amountWei : null
  );
  const [readingAllowance, setReadingAllowance] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [waitingApproval, setWaitingApproval] = useState(false);

  const readAllowance = async () => {
    if (isNative) {
      setAllowanceWei(amountWei);
      return;
    }
    if (!selectedToken?.address || !spender) {
      setAllowanceWei(null);
      return;
    }
    const wallet = walletManager.wallet;
    if (!wallet || wallet.type !== "eip1193") {
      setAllowanceWei(null);
      return;
    }
    const owner = await wallet.getAddress().catch(() => undefined);
    if (!owner) {
      setAllowanceWei(null);
      return;
    }
    setReadingAllowance(true);
    try {
      const data = encodeAllowanceCallData(owner, spender);
      const result = await wallet.request({
        method: "eth_call",
        params: [
          {
            to: selectedToken.address,
            data,
          },
          "latest",
        ],
      });
      const parsed = hexToBigInt(result as string | null | undefined);
      setAllowanceWei(parsed ?? 0n);
    } catch {
      setAllowanceWei(null);
    } finally {
      setReadingAllowance(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await readAllowance();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readAllowance is stable
  }, [selectedToken?.address, spender, isNative, amountWei]);

  useEffect(() => {
    const wallet = walletManager.wallet;
    if (!approvalHash || wallet?.type !== "eip1193") return;
    let cancelled = false;
    setWaitingApproval(true);
    const poll = async () => {
      while (!cancelled) {
        try {
          const receipt = await wallet?.request({
            method: "eth_getTransactionReceipt",
            params: [approvalHash],
          });
          if ((receipt as { blockNumber?: string })?.blockNumber) {
            break;
          }
        } catch {
          // ignore polling errors
        }
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
      if (!cancelled) {
        setWaitingApproval(false);
        await readAllowance();
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readAllowance is stable
  }, [approvalHash]);

  const needsApproval =
    !isNative &&
    allowanceWei != null &&
    amountWei > 0n &&
    allowanceWei < amountWei;

  // Basic validation aligned to FE
  const errors: string[] = useMemo(() => {
    const e: string[] = [];
    if (amountWei <= 0n) e.push("Amount is invalid.");
    if (!loadingBal && balanceWei === 0n) e.push("Insufficient balance.");
    if (!loadingBal && amountWei > balanceWei)
      e.push("Amount exceeds available balance.");
    if (!isNative && spender == null)
      e.push("Missing Squid spender address for this route.");
    if (routeState.status === "error")
      e.push(routeState.error || "Route build failed.");
    if (routeState.status === "building") e.push("Building route…");
    if (routeState.status === "idle") e.push("Waiting for amount/token/chain…");
    return e;
  }, [amountWei, balanceWei, loadingBal, isNative, spender, routeState]);

  const canConfirm =
    routeState.status === "ready" &&
    amountWei > 0n &&
    errors.filter((x) => !/Building route|Waiting/.test(x)).length === 0 &&
    !(needsApproval === true);

  const muted = (o = 0.6) => hexToRgba(theme.textColor, o);

  const approve = async (amountToApprove: bigint) => {
    if (!selectedToken?.address || !spender) return;
    const wallet = walletManager.wallet;
    if (!wallet) return;
    setIsApproving(true);
    setApprovalHash(null);
    try {
      const data = encodeApproveCallData(spender, amountToApprove);
      if (wallet.type === "eip1193") {
        const from = await wallet.getAddress();
        const hash = await wallet.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: selectedToken.address,
              data,
            },
          ],
        });
        setApprovalHash(hash as string);
      } else {
        const chainId = Number(selectedChain?.chainId ?? selectedChain?.id);
        const { hash } = await wallet.sendTransaction({
          to: selectedToken.address as `0x${string}`,
          data: data as `0x${string}`,
          chainId: Number.isFinite(chainId) ? chainId : undefined,
        });
        setApprovalHash(hash);
        setAllowanceWei(amountToApprove);
        await readAllowance();
      }
    } catch {
      setWaitingApproval(false);
    } finally {
      setIsApproving(false);
    }
  };

  const approveExact = async () => {
    if (amountWei <= 0n) return;
    await approve(amountWei);
  };

  const approveMax = async () => {
    await approve(MAX_UINT256);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        width: "100%",
        color: theme.textColor,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: theme.textColor,
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: radius,
          }}
        >
          ← Back
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700 }}>Confirm transfer</div>
          <div style={{ fontSize: 12, color: muted() }}>
            {messages.description}
          </div>
        </div>
        <span style={{ width: 64 }} />
      </header>

      {/* Details */}
      <section
        style={{
          border: `1px solid ${theme.borderColor}`,
          borderRadius: radius,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: theme.backgroundColor,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: muted() }}>From chain</span>
          <span>{chainLabel}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: muted() }}>Token</span>
          <span>{tokenSymbol}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: muted() }}>Send exactly</span>
          <span>
            {amountTokenStr
              ? `${amountTokenStr} ${tokenSymbol}`
              : `${amountWei.toString()} wei ${tokenSymbol}`}
            {amountUsdStr ? ` (${amountUsdStr})` : ""}
          </span>
        </div>

        {/* Balance summary (optional but nice) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <span style={{ color: muted() }}>Available</span>
          <span>
            {loadingBal ? "Loading…" : `${balanceTokStr} ${tokenSymbol}`}
            {!loadingBal && tokenPriceUSD ? ` (${balanceUsdStr})` : ""}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <span style={{ color: muted() }}>Remaining after send</span>
          <span
            style={{ color: remainingWei < 0n ? "#ef4444" : theme.textColor }}
          >
            {remainingWei < 0n ? "—" : `${remainingTokStr} ${tokenSymbol}`}
            {tokenPriceUSD && remainingWei >= 0n ? ` (${remainingUsdStr})` : ""}
          </span>
        </div>

        {/* Route messages */}
        {routeState.status === "building" && (
          <div style={{ fontSize: 12, color: muted() }}>Building route…</div>
        )}
        {routeState.status === "error" && (
          <div style={{ fontSize: 12, color: "#b91c1c" }}>
            {routeState.error || "Failed to build route."}
          </div>
        )}
        {routeInfo && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 4,
              fontSize: 12,
            }}
          >
            <span>Estimated receive: {routeInfo.toAmount ?? "—"}</span>
            <span>Minimum guaranteed: {routeInfo.minAmount ?? "—"}</span>
          </div>
        )}

        {/* Spender / Allowance preview */}
        {!isNative && (
          <div
            style={{
              marginTop: 6,
              border: `1px solid ${hexToRgba(theme.borderColor, 0.8)}`,
              borderRadius: radius,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 12,
              background: hexToRgba(theme.backgroundColor, 0.6),
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: muted() }}>Spender</span>
              <span style={{ fontFamily: "monospace" }}>
                {spender
                  ? `${spender.slice(0, 6)}...${spender.slice(-4)}`
                  : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: muted() }}>Allowance</span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  justifyContent: "flex-end",
                  maxWidth: "60%",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    color: needsApproval ? "#b91c1c" : theme.textColor,
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {readingAllowance
                    ? "Checking…"
                    : allowanceWei == null
                      ? "Unknown"
                      : allowanceWei === MAX_UINT256
                        ? `Unlimited ${tokenSymbol}`
                        : `${weiToDecimalString(allowanceWei, tokenDecimals, 6)}`}
                </span>
                <span> {tokenSymbol}</span>
              </div>
            </div>
            <div
              style={{
                color: needsApproval
                  ? hexToRgba(theme.textColor, 0.9)
                  : theme.primaryColor,
                fontWeight: 600,
              }}
            >
              {readingAllowance
                ? "Checking allowance…"
                : needsApproval
                  ? "Approval required"
                  : "Allowance sufficient ✓"}
            </div>

            {needsApproval && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={isApproving || waitingApproval || !spender}
                  onClick={approveExact}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: radius,
                    border: "none",
                    cursor:
                      isApproving || waitingApproval
                        ? "not-allowed"
                        : "pointer",
                    background: theme.primaryColor,
                    color: theme.backgroundColor,
                    fontWeight: 600,
                  }}
                >
                  {isApproving || waitingApproval
                    ? "Approving…"
                    : "Approve Exact"}
                </button>
                <button
                  type="button"
                  disabled={isApproving || waitingApproval || !spender}
                  onClick={approveMax}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: radius,
                    border: `1px solid ${theme.borderColor}`,
                    cursor:
                      isApproving || waitingApproval
                        ? "not-allowed"
                        : "pointer",
                    background: "transparent",
                    color: theme.textColor,
                    fontWeight: 600,
                  }}
                >
                  Approve Max
                </button>
              </div>
            )}
            {approvalHash && (
              <div style={{ color: muted(0.75) }}>
                {waitingApproval
                  ? "Waiting for approval confirmation…"
                  : "Approval submitted."}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            background: hexToRgba(theme.primaryColor, 0.2),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: theme.primaryColor,
              animation: "pulse 1.5s infinite",
            }}
          />
        </div>
        <span style={{ fontSize: 14 }}>
          Time left to complete payment: {Math.floor(timeLeft / 60)}:
          {(timeLeft % 60).toString().padStart(2, "0")}
        </span>
      </div>

      {/* Footer */}
      <button
        type="button"
        onClick={() => {
          if (!canConfirm) return;
          onConfirm(); // SDK does not submit the tx; parent handles next step
        }}
        disabled={!canConfirm}
        style={{
          padding: "12px 16px",
          borderRadius: radius,
          border: "none",
          cursor: canConfirm ? "pointer" : "not-allowed",
          background: canConfirm
            ? theme.primaryColor
            : hexToRgba(theme.borderColor, 0.6),
          color: theme.backgroundColor,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Confirm payment
      </button>
    </div>
  );
}
