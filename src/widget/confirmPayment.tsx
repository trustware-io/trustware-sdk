import { useEffect, useMemo, useRef, useState } from "react";
import type { ChainDef, TokenDef } from "src/types";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import { getBalances, type BalanceRow } from "src/core/balances";
import { walletManager } from "src/wallets";
import { formatUsd, hexToRgba, resolveChainLabel, weiToDecimalString } from "src/utils";
import type { TrustwareRouteState } from "src/hooks";


export type ConfirmPaymentProps = {
  amount: string; // wei string (from AmountInput)
  selectedChain: ChainDef | null;
  selectedToken: TokenDef | null;
  routeState: TrustwareRouteState;
  onBack: () => void;
  onConfirm: () => void; // parent advances flow; this component doesn't send tx
};
// Try to pick spender from txReq (routeState) or optional chain contracts shape if present.
function pickSpender(txReq: any, chain: ChainDef | null): string | null {
  const fromRoute = (txReq?.to || txReq?.target) as string | undefined;
  if (fromRoute) return fromRoute;
  const c: any = (chain as any)?.squidContracts ?? {};
  return c.squidRouter ?? c.squidMulticall ?? c.squidCoralMulticall ?? null;
}

// Minimal ERC20 allowance read if walletManager exposes a readContract.
// We guard calls so SDK works even when this isn’t available.
const ERC20_ALLOWANCE = {
  name: "allowance",
  type: "function",
  stateMutability: "view",
  inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
} as const;

export function ConfirmPayment({
  amount,
  selectedChain,
  selectedToken,
  routeState,
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
    typeof selectedToken?.usdPrice === "number" && isFinite(selectedToken.usdPrice!)
      ? (selectedToken!.usdPrice as number)
      : null;

  // Derived amount displays
  const amountTokenStr = useMemo(() => {
    if (amountWei <= 0n) return "";
    return weiToDecimalString(amountWei, tokenDecimals, 8);
  }, [amountWei, tokenDecimals]);

  const amountUsdStr = useMemo(() => {
    if (amountWei <= 0n || !tokenPriceUSD) return "";
    const units = Number(weiToDecimalString(amountWei, tokenDecimals, Math.max(6, tokenDecimals)));
    if (!isFinite(units)) return "";
    return formatUsd(units * tokenPriceUSD);
  }, [amountWei, tokenDecimals, tokenPriceUSD]);

  // Route info (estimated receive / min)
  const routeInfo = useMemo(() => {
    if (routeState.status !== "ready") return null;
    const exchange = routeState.finalExchangeRate ?? {};
    const rawEstimate: any = routeState.raw?.route?.estimate ?? {};
    const fees: any = rawEstimate?.fees ?? {};
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
  const [timeLeft, setTimeLeft] = useState(60);
  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

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
      const address = wallet ? await wallet.getAddress().catch(() => undefined) : undefined;
      if (!address) {
        setBalanceWei(0n);
        return;
      }

      setLoadingBal(true);
      try {
        const rows: BalanceRow[] = await getBalances(canonical, address);
        const addrLower = (selectedToken.address || "").toLowerCase();
        let row =
          rows.find((r) => r.category === "erc20" && r.contract?.toLowerCase() === addrLower) ||
          rows.find((r) => r.category === "native");
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
  }, [balanceTokStr, tokenPriceUSD]);

  const remainingWei = useMemo(() => balanceWei - amountWei, [balanceWei, amountWei]);
  const remainingTokStr = useMemo(
    () => (remainingWei >= 0n ? weiToDecimalString(remainingWei, tokenDecimals, 6) : "0"),
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

  const isNative = (selectedToken?.address?.toLowerCase?.() ?? "") === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const [allowanceWei, setAllowanceWei] = useState<bigint | null>(isNative ? amountWei : null);
  const [readingAllowance, setReadingAllowance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isNative) {
        setAllowanceWei(amountWei);
        return;
      }
      if (!selectedToken?.address || !spender) {
        setAllowanceWei(null);
        return;
      }
      const reader = (walletManager as any)?.simple?.readContract;
      if (typeof reader !== "function") {
        setAllowanceWei(null); // unknown in this environment
        return;
      }
      // Try read allowance(owner -> spender)
      const owner = await (walletManager as any)?.simple?.getAddress?.().catch(() => undefined);
      if (!owner) {
        setAllowanceWei(null);
        return;
      }
      setReadingAllowance(true);
      try {
        const res = await reader({
          address: selectedToken.address,
          abi: [ERC20_ALLOWANCE],
          functionName: "allowance",
          args: [owner, spender],
        });
        if (!cancelled) setAllowanceWei(typeof res === "bigint" ? res : BigInt(res ?? 0));
      } catch {
        if (!cancelled) setAllowanceWei(null);
      } finally {
        if (!cancelled) setReadingAllowance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedToken?.address, spender, isNative, amountWei]);

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
    if (!loadingBal && amountWei > balanceWei) e.push("Amount exceeds available balance.");
    if (!isNative && spender == null) e.push("Missing Squid spender address for this route.");
    if (routeState.status === "error") e.push(routeState.error || "Route build failed.");
    if (routeState.status === "building") e.push("Building route…");
    if (routeState.status === "idle") e.push("Waiting for amount/token/chain…");
    return e;
  }, [amountWei, balanceWei, loadingBal, isNative, spender, routeState]);

  const canConfirm =
    routeState.status === "ready" &&
    amountWei > 0n &&
    errors.filter((x) => !/Building route|Waiting/.test(x)).length === 0 &&
    // if we *know* allowance and it's insufficient, block; if unknown, allow (SDK cannot approve here)
    !(needsApproval === true);

  const muted = (o = 0.6) => hexToRgba(theme.textColor, o);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", color: theme.textColor }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
          <div style={{ fontSize: 12, color: muted() }}>{messages.description}</div>
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
            {amountTokenStr ? `${amountTokenStr} ${tokenSymbol}` : `${amountWei.toString()} wei ${tokenSymbol}`}
            {amountUsdStr ? ` (${amountUsdStr})` : ""}
          </span>
        </div>

        {/* Balance summary (optional but nice) */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: muted() }}>Available</span>
          <span>
            {loadingBal ? "Loading…" : `${balanceTokStr} ${tokenSymbol}`}
            {!loadingBal && tokenPriceUSD ? ` (${balanceUsdStr})` : ""}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: muted() }}>Remaining after send</span>
          <span style={{ color: remainingWei < 0n ? "#ef4444" : theme.textColor }}>
            {remainingWei < 0n ? "—" : `${remainingTokStr} ${tokenSymbol}`}
            {tokenPriceUSD && remainingWei >= 0n ? ` (${remainingUsdStr})` : ""}
          </span>
        </div>


        {/* Route messages */}
        {routeState.status === "building" && (
          <div style={{ fontSize: 12, color: muted() }}>Building route…</div>
        )}
        {routeState.status === "error" && (
          <div style={{ fontSize: 12, color: "#b91c1c" }}>{routeState.error || "Failed to build route."}</div>
        )}
        {routeInfo && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, fontSize: 12 }}>
            <span>Estimated receive: {routeInfo.toAmount ?? "—"}</span>
            <span>Minimum guaranteed: {routeInfo.minAmount ?? "—"}</span>
          </div>
        )}

        {/* Spender / Allowance preview */}
        {!isNative && (
          <div
            style={{
              marginTop: 6,
              borderTop: `1px dashed ${hexToRgba(theme.borderColor, 0.7)}`,
              paddingTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: muted() }}>Spender</span>
              <span style={{ fontFamily: "monospace" }}>
                {spender ? `${spender.slice(0, 6)}...${spender.slice(-4)}` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: muted() }}>Allowance</span>
              <span>
                {readingAllowance
                  ? "Checking…"
                  : allowanceWei == null
                    ? "Unknown"
                    : `${weiToDecimalString(allowanceWei, tokenDecimals, 6)} ${tokenSymbol}`}
              </span>
            </div>
            {needsApproval && (
              <div style={{ color: "#ef4444" }}>
                Allowance insufficient for this amount. Approve in your wallet first.
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
          background: canConfirm ? theme.primaryColor : hexToRgba(theme.borderColor, 0.6),
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

