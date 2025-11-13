import { useEffect, useMemo, useRef, useState } from "react";
import type { ChainDef, TokenDef } from "src/types";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import { getBalances, type BalanceRow } from "src/core/balances";
import { walletManager } from "src/wallets";
import { hexToRgba, weiToDecimalString, parseDecimalToWeiUnsafe, divRoundDown } from "src/utils";

type Mode = "USD" | "TOKEN" | "WEI";

export type AmountInputProps = {
  selectedChain: ChainDef | null;
  selectedToken: TokenDef | null;
  amount: string;                         // prefer wei string; empty if none
  onAmountChange: (weiOrEmpty: string) => void;  // will emit wei or ""
  onBack: () => void;
  onNext: () => void;                    // fires only if valid; passes via onAmountChange already
};


export function AmountInput({
  selectedChain,
  selectedToken,
  amount,
  onAmountChange,
  onBack,
  onNext,
}: AmountInputProps) {
  const { theme } = useTrustwareConfig();
  const radius = theme.radius ?? 12;

  const [mode, setMode] = useState<Mode>("USD");
  const [input, setInput] = useState<string>("");

  const [balanceWei, setBalanceWei] = useState<bigint>(0n);
  const [isLoadingBal, setIsLoadingBal] = useState<boolean>(false);
  const hadErrorsRef = useRef(false);

  const tokenDecimals = selectedToken?.decimals ?? 18;
  const tokenSymbol = selectedToken?.symbol ?? "TOKEN";
  const tokenPriceUSD = selectedToken?.usdPrice;
  const hasUsdPrice = typeof tokenPriceUSD === "number" && isFinite(tokenPriceUSD) && tokenPriceUSD > 0;

  // if parent passes a new wei amount, reflect it only in WEI mode (avoids jarring switching)
  useEffect(() => {
    if (!amount) return;
    if (mode === "WEI" && /^\d+$/.test(amount)) {
      setInput(amount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  // force mode away from USD if no price
  useEffect(() => {
    if (!hasUsdPrice && mode === "USD") setMode("TOKEN");
  }, [hasUsdPrice, mode]);

  // fetch balance using SDK wallet + balances API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedChain || !selectedToken) return;
      const chainId = Number(selectedChain.chainId ?? selectedChain.id);
      if (!Number.isFinite(chainId)) return;

      const wallet = walletManager.simple;
      const addr = wallet ? await wallet.getAddress().catch(() => undefined) : undefined;
      if (!addr) {
        setBalanceWei(0n);
        return;
      }

      setIsLoadingBal(true);
      try {
        const rows: BalanceRow[] = await getBalances(chainId, addr);
        const addrLower = (selectedToken.address || "").toLowerCase();

        // pick best matching balance row (erc20 by address OR native by symbol)
        let row =
          rows.find((r) => r.category === "erc20" && r.contract?.toLowerCase() === addrLower) ||
          rows.find((r) => r.category === "native");

        const b = row?.balance ? BigInt(row.balance) : 0n;
        if (!cancelled) setBalanceWei(b);
      } catch {
        if (!cancelled) setBalanceWei(0n);
      } finally {
        if (!cancelled) setIsLoadingBal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChain, selectedToken]);

  // compute wei for current input+mode
  const amountWei: bigint | null = useMemo(() => {
    if (!input?.trim()) return null;

    if (mode === "WEI") {
      if (!/^\d+$/.test(input.trim())) return null;
      try {
        return BigInt(input.trim());
      } catch {
        return null;
      }
    }

    if (mode === "TOKEN") {
      return parseDecimalToWeiUnsafe(input, tokenDecimals);
    }

    // USD
    if (!hasUsdPrice) return null;
    if (!/^\d*(\.\d*)?$/.test(input.trim())) return null;
    const usd = Number(input.trim());
    if (!isFinite(usd)) return null;
    const tokenUnits = usd / tokenPriceUSD!;
    return parseDecimalToWeiUnsafe(String(tokenUnits), tokenDecimals);
  }, [input, mode, tokenDecimals, tokenPriceUSD, hasUsdPrice]);

  // derived display
  const amountTokenStr = useMemo(() => {
    if (amountWei == null) return "";
    return weiToDecimalString(amountWei, tokenDecimals, 8);
  }, [amountWei, tokenDecimals]);

  const amountUsdStr = useMemo(() => {
    if (amountWei == null || !hasUsdPrice) return "";
    const tokenUnits = Number(weiToDecimalString(amountWei, tokenDecimals, Math.max(6, tokenDecimals)));
    if (!isFinite(tokenUnits)) return "";
    return (tokenUnits * tokenPriceUSD!).toFixed(2);
  }, [amountWei, tokenDecimals, tokenPriceUSD, hasUsdPrice]);

  const balanceTokenStr = useMemo(
    () => weiToDecimalString(balanceWei, tokenDecimals, 6),
    [balanceWei, tokenDecimals]
  );
  const balanceUsdStr = useMemo(() => {
    if (!hasUsdPrice) return "";
    const tokenUnits = Number(balanceTokenStr || "0");
    return (tokenUnits * tokenPriceUSD!).toFixed(2);
  }, [balanceTokenStr, hasUsdPrice, tokenPriceUSD]);

  // dynamic font size based on input length 
  const dynamicFontSize = useMemo(() => {
    // What the user *sees* as the main value
    const raw = input || (mode === "WEI" ? "0" : "0.00");

    // Ignore any formatting; we care about how many digits / chars
    const visible = raw.replace(/[^0-9.]/g, "");
    const len = visible.length || 1;

    // Tunable bounds
    const MAX = 40; // really big for short values
    const MIN = 18; // don’t go below this

    let size = MAX;

    if (len <= 4) {
      // 0, 1.2, 10.5 → huge
      size = MAX;
    } else if (len <= 8) {
      // gradually shrink for mid-size values
      size = MAX - (len - 4) * 2; // 4→40px, 8→32px
    } else if (len <= 14) {
      // longer values shrink more
      size = MAX - 8 - (len - 8) * 1.5; // 9..14 → ~30..21px
    } else {
      // anything insane (big wei) → clamp to MIN
      size = MIN;
    }

    // Wei strings tend to be long; nudge down a bit more
    if (mode === "WEI") size -= 2;

    return Math.max(MIN, size);
  }, [input, mode]);


  // validate
  const errors: string[] = useMemo(() => {
    const errs: string[] = [];
    if (isLoadingBal) return errs;

    if (amountWei == null || amountWei <= 0n) {
      errs.push("Enter a valid amount.");
      return errs;
    }
    if (balanceWei === 0n) {
      errs.push("Insufficient balance.");
      return errs;
    }
    if (amountWei > balanceWei) {
      errs.push("Amount exceeds available balance.");
    }
    return errs;
  }, [amountWei, balanceWei, isLoadingBal]);

  const canProceed = amountWei != null && amountWei > 0n && errors.length === 0;

  // emit wei (or empty) upward
  useEffect(() => {
    if (canProceed && amountWei != null) onAmountChange(amountWei.toString());
    else onAmountChange("");
  }, [canProceed, amountWei, onAmountChange]);

  // quick % setters (respect current mode)
  const setPct = (pct: number) => {
    if (balanceWei === 0n) return;
    const wei = divRoundDown(balanceWei * BigInt(Math.round(pct * 100)), 100n);
    if (mode === "WEI") {
      setInput(wei.toString());
    } else if (mode === "TOKEN") {
      setInput(weiToDecimalString(wei, tokenDecimals, 8));
    } else if (mode === "USD" && hasUsdPrice) {
      const tokenUnits = Number(weiToDecimalString(wei, tokenDecimals, Math.max(6, tokenDecimals)));
      setInput((tokenUnits * (tokenPriceUSD as number)).toFixed(2));
    }
  };

  const muted = (o = 0.6) => hexToRgba(theme.textColor, o);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16, color: theme.textColor }}>
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
        <span style={{ fontWeight: 700 }}>Select Amount</span>
        <span style={{ width: 64 }} />
      </header>

      {/* Token + Chain summary */}
      <section
        style={{
          border: `1px solid ${theme.borderColor}`,
          borderRadius: radius,
          padding: 16,
          background: theme.backgroundColor,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",

          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: muted() }}>
          You’ll pay in{" "}
          <b>{selectedToken?.symbol ?? "TOKEN"}</b>
          {selectedChain?.networkName ? <> on <b>{selectedChain.networkName}</b></> : null}
        </div>

        {/* Mode toggles */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: `1px solid ${theme.borderColor}`,
            padding: 4,
            borderRadius: 999,
            width: "fit-content",
          }}
        >
          <button
            disabled={!hasUsdPrice}
            onClick={() => setMode("USD")}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "none",
              cursor: hasUsdPrice ? "pointer" : "not-allowed",
              background: mode === "USD" ? theme.primaryColor : "transparent",
              color: mode === "USD" ? theme.backgroundColor : theme.textColor,
              opacity: hasUsdPrice ? 1 : 0.5,
            }}
          >
            USD
          </button>
          <button
            onClick={() => setMode("TOKEN")}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: mode === "TOKEN" ? theme.primaryColor : "transparent",
              color: mode === "TOKEN" ? theme.backgroundColor : theme.textColor,
            }}
          >
            {tokenSymbol}
          </button>
          <button
            onClick={() => setMode("WEI")}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: mode === "WEI" ? theme.primaryColor : "transparent",
              color: mode === "WEI" ? theme.backgroundColor : theme.textColor,
            }}
          >
            wei
          </button>
        </div>

        {/* Amount input */}
        {/* Amount input */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
          {mode === "USD" && (
            <span
              style={{
                fontSize: dynamicFontSize,
                color: muted(),
                lineHeight: 1,
              }}
            >
              $
            </span>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputMode={mode === "WEI" ? "numeric" : "decimal"}
            placeholder={mode === "WEI" ? "0" : "0.00"}
            style={{
              textAlign: "center",
              fontSize: dynamicFontSize,
              fontWeight: 700,
              border: "none",
              outline: "none",
              background: "transparent",
              color: theme.textColor,
              width: 260,
              lineHeight: 1.1,
            }}
          />
        </div>

        {/* Quick amounts */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={() => setPct(0.25)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${theme.borderColor}`,
              background: hexToRgba(theme.borderColor, 0.08),
              color: theme.textColor,
              cursor: "pointer",
            }}
          >
            25%
          </button>
          <button
            onClick={() => setPct(0.5)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${theme.borderColor}`,
              background: hexToRgba(theme.borderColor, 0.08),
              color: theme.textColor,
              cursor: "pointer",
            }}
          >
            50%
          </button>
          <button
            onClick={() => setPct(0.75)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${theme.borderColor}`,
              background: hexToRgba(theme.borderColor, 0.08),
              color: theme.textColor,
              cursor: "pointer",
            }}
          >
            75%
          </button>
          <button
            onClick={() => setPct(1)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${theme.borderColor}`,
              background: hexToRgba(theme.borderColor, 0.08),
              color: theme.textColor,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            MAX
          </button>
        </div>

        {/* Summaries */}
        <div style={{ fontSize: 13, color: muted(), display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Available</span>
            <span>
              {isLoadingBal ? "Loading…" : `${balanceTokenStr} ${tokenSymbol}`}
              {hasUsdPrice && !isLoadingBal ? ` (~$${balanceUsdStr})` : ""}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Entered</span>
            <span>
              {amountTokenStr ? `${amountTokenStr} ${tokenSymbol}` : "—"}
              {hasUsdPrice && amountUsdStr ? ` (~$${amountUsdStr})` : ""}
              {mode !== "WEI" && amountWei != null ? ` • ${amountWei.toString()} wei` : ""}
            </span>
          </div>
          {errors.length > 0 && (
            <div style={{ color: "#ef4444" /* destructive */, fontSize: 12 }}>
              {errors[0]}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <button
        type="button"
        onClick={() => {
          if (!canProceed || amountWei == null) return;
          onNext(); // upstream already has the wei via onAmountChange
        }}
        disabled={!canProceed}
        style={{
          padding: "12px 16px",
          borderRadius: radius,
          border: "none",
          cursor: canProceed ? "pointer" : "not-allowed",
          background: canProceed ? theme.primaryColor : hexToRgba(theme.borderColor, 0.6),
          color: theme.backgroundColor,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Continue
      </button>
    </div>
  );
}

