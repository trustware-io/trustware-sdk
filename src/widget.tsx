// src/widget.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { Trustware } from "./core";

const Ctx = createContext(Trustware);

export const TrustwareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  <Ctx.Provider value={Trustware}>{children}</Ctx.Provider>;

export function useTrustware() { return useContext(Ctx); }

export function TrustwareWidget() {
  const t = useTrustware();
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const theme = t.cfg?.ui?.theme ?? {};
  const styles = useMemo(() => ({
    card: { border: `1px solid #e5e7eb`, borderRadius: (theme.radius ?? 16), padding: 16, maxWidth: 420 },
    btn: {
      width: "100%", height: 44, borderRadius: (theme.radius ?? 12), border: 0,
      background: (theme.primary ?? "#111"), color: "#fff", fontWeight: 600
    },
    input: {
      width: "100%", margin: "8px 0", height: 40, borderRadius: (theme.radius ?? 8),
      border: "1px solid #d1d5db", padding: "0 12px"
    }
  }), [theme]);

  const m = t.messages;

  const go = async () => {
    setBusy(true); setErr(null); setStatus(null);
    try {
      const tx = await t.runTopUp({
        fromChain: String(await (t as any)["wallet"]?.getChainId?.() ?? ""),
        toChain: t.cfg?.defaults?.toChain,
        fromToken: t.cfg?.defaults?.fromToken,
        toToken: t.cfg?.defaults?.toToken,
        fromAmount: amount,
      });
      setStatus(tx.status);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setBusy(false); }
  };

  return (
    <div style={styles.card as any}>
      <div style={{ fontWeight: 600 }}>{m.title}</div>
      <input value={amount} onChange={e => setAmount(e.target.value)}
        placeholder={m.amountPlaceholder} style={styles.input as any} />
      <button disabled={busy} onClick={go} style={styles.btn as any}>
        {busy ? m.ctaBusy : m.ctaIdle}
      </button>
      {status && <div style={{ marginTop: 8 }}>{m.statusLabel}: {status}</div>}
      {err && <div style={{ marginTop: 8, color: "#b91c1c" }}>{m.errorPrefix}: {err}</div>}
    </div>
  );
}

