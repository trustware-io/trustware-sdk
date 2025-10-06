// src/widget.tsx
'use client';
import { useEffect, useMemo, useState } from "react";
import { useTrustware } from "./provider";
import { API_PREFIX, API_ROOT } from "./constants";
import { NATIVE } from "./registry";

/* ---------- small helpers ---------- */

// robust wei conversion for user-entered amounts
function toWei(amount: string, decimals: number): string {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error("Invalid amount");
  const [ints, fracs = ""] = amount.split(".");
  const fracPadded = (fracs + "0".repeat(decimals)).slice(0, decimals);
  const raw = (ints || "0") + fracPadded;
  return raw.replace(/^0+/, "") || "0";
}

function formatHuman(raw: string, decimals: number, maxFrac = 6) {
  // simple, safe formatter for display (no BigInt divide errors)
  if (!raw) return "0";
  const s = raw.replace(/^0+/, "") || "0";
  if (decimals === 0) return s;
  const pad = decimals - (s.length - Math.max(0, s.length - decimals));
  const whole = s.length > decimals ? s.slice(0, -decimals) : "0";
  const frac = s.length > decimals ? s.slice(-decimals) : s.padStart(decimals, "0");
  const trimmed = frac.replace(/0+$/, "");
  const out = trimmed ? `${whole}.${trimmed.slice(0, maxFrac)}` : whole;
  return out;
}

/* ---------- live chains + tokens from your backend ---------- */

type ChainRow = {
  id: string;                // "43114"
  networkName?: string;      // "Avalanche"
  chainName?: string;        // fallback like "Chain 43114"
  nativeCurrency?: { symbol?: string; decimals?: number; name?: string };
};
type TokenRow = {
  chainId: string;           // "43114"
  address: `0x${string}`;
  symbol: string;            // "USDC.e"
  decimals: number;
  visible?: boolean;
  active?: boolean;
};


// UI-friendly types
type Chain = { id: number; label: string; nativeSymbol: string; nativeDecimals: number };
type Token = { label: string; value: string; decimals: number; isNative: boolean }; // value = address | NATIVE
type BalanceMap = Record<string, { raw: string; decimals: number }>; // key = NATIVE | 0x...

const API_BASE = API_ROOT + (API_PREFIX ? `${API_PREFIX}` : "");

/* ---------- widget (destination chain fixed by partner config) ---------- */

export function TrustwareWidget({ title = "Add funds" }: { title?: string }) {
  const { core, status, errors } = useTrustware();

  // ---- styles / theme
  const theme = core.cfg?.ui?.theme ?? {};
  const m = core.messages;
  const styles = useMemo(() => ({
    card: { border: `1px solid #e5e7eb`, borderRadius: (theme.radius ?? 16), padding: 16, maxWidth: 480 },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "8px 0" },
    select: { width: "100%", height: 40, borderRadius: (theme.radius ?? 8), border: "1px solid #d1d5db", padding: "0 12px", background: "#fff", color: "#111", appearance: "none" as const },
    input: { width: "100%", height: 40, borderRadius: (theme.radius ?? 8), border: "1px solid #d1d5db", padding: "0 12px", color: "#111" },
    btn: { width: "100%", height: 44, borderRadius: (theme.radius ?? 12), border: 0, background: (theme.primary ?? "#111"), color: "#fff", fontWeight: 600, marginTop: 8 },
    tag: { display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#0b1020", border: "1px solid #1f2a44", color: "#93c5fd", marginLeft: 8 },
  }), [theme]);

  // ---- destination chain is fixed by partner config
  const destChainId = Number(core?.cfg?.defaults?.toChain ?? 8453);

  // ---- live discovery
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [tokensByChain, setTokensByChain] = useState<Record<number, Token[]>>({});

  // selection
  const [fromChain, setFromChain] = useState<number | null>(null);
  const [fromTokenValue, setFromTokenValue] = useState<string>(""); // address or NATIVE
  const [amountHuman, setAmountHuman] = useState<string>("0.1");

  // balances state (per selected fromChain)
  const [balances, setBalances] = useState<BalanceMap>({});
  const [balErr, setBalErr] = useState<string | null>(null);
  const [balLoading, setBalLoading] = useState(false);

  // fetch balances when fromChain changes AND wallet is ready
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (status !== "ready") return;
      if (fromChain == null) return;
      try {
        setBalLoading(true);
        setBalErr(null);
        const addr = await core.getAddress();
        const rows = await core.getBalances(fromChain, addr);

        const byKey: BalanceMap = {};
        // native
        for (const r of rows) {
          if (r.category === "native") {
            byKey[NATIVE] = { raw: r.balance, decimals: r.decimals };
            break;
          }
        }
        // erc20
        for (const r of rows) {
          if (r.category === "erc20" && r.contract) {
            byKey[r.contract.toLowerCase()] = { raw: r.balance, decimals: r.decimals };
          }
        }

        if (!cancelled) setBalances(byKey);
      } catch (e: any) {
        if (!cancelled) setBalErr(e?.message || String(e));
      } finally {
        if (!cancelled) setBalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, fromChain, core]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadErr(null);

        // fetch chains + tokens from your backend
        const [cRes, tRes] = await Promise.all([
          fetch(`${API_BASE}/squid/chains`, { credentials: "omit" }),
          fetch(`${API_BASE}/squid/tokens`, { credentials: "omit" }),
        ]);
        if (!cRes.ok) throw new Error(`chains: HTTP ${cRes.status}`);
        if (!tRes.ok) throw new Error(`tokens: HTTP ${tRes.status}`);

        const chainsJson = await cRes.json();
        const tokensJson = await tRes.json();
        const chainRows: ChainRow[] = Array.isArray(chainsJson) ? chainsJson : (chainsJson.data ?? []);
        const tokenRows: TokenRow[] = Array.isArray(tokensJson) ? tokensJson : (tokensJson.data ?? []);

        // normalize chains
        const chainList: Chain[] = chainRows
          .filter(r => !!r?.id)
          .map(r => ({
            id: Number(r.id),
            label: r.networkName || r.chainName || `Chain ${r.id}`,
            nativeSymbol: r.nativeCurrency?.symbol || "",
            nativeDecimals: r.nativeCurrency?.decimals ?? 18,
          }))
          // keep only EVM-like numeric ids
          .filter(c => Number.isFinite(c.id));

        // group tokens per chain + add synthetic native token at top
        const grouped: Record<number, Token[]> = {};
        for (const c of chainList) {
          grouped[c.id] = [
            {
              label: `Native (${c.nativeSymbol || "ETH"})`,
              value: NATIVE,
              decimals: c.nativeDecimals,
              isNative: true,
            },
          ];
        }
        for (const t of tokenRows) {
          const id = Number(t.chainId);
          if (!Number.isFinite(id)) continue;
          if (!grouped[id]) continue; // ignore tokens for chains we didn't include
          // only show visible/active tokens (if flags are present)
          if (t.visible === false || t.active === false) continue;
          grouped[id].push({
            label: t.symbol || t.address,
            value: t.address,
            decimals: t.decimals ?? 18,
            isNative: false,
          });
        }

        if (cancelled) return;
        setChains(chainList);
        setTokensByChain(grouped);

        // pick sane defaults:
        const defaultFrom = chainList.find(c => c.id !== destChainId)?.id ?? chainList[0]?.id ?? null;
        setFromChain(defaultFrom);
        const firstTok = defaultFrom != null ? grouped[defaultFrom]?.[0] : null;
        setFromTokenValue(firstTok ? firstTok.value : "");
      } catch (e: any) {
        if (!cancelled) setLoadErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [destChainId]);

  const currentTokens: Token[] = useMemo(
    () => (fromChain != null ? (tokensByChain[fromChain] ?? []) : []),
    [fromChain, tokensByChain]
  );

  const currentToken = currentTokens.find(t => t.value === fromTokenValue) || currentTokens[0];

  // lookup current token balance
  const balanceForCurrent = useMemo(() => {
    if (!currentToken) return null;
    const key = currentToken.isNative ? NATIVE : currentToken.value.toLowerCase();
    return balances[key] || null;
  }, [currentToken, balances]);

  // ---- action
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onTopUp() {
    try {
      setBusy(true); setErr(null); setMsg(null);
      if (fromChain == null) throw new Error("Select a source chain");
      if (!currentToken) throw new Error("Select a token");

      const wei = toWei(amountHuman, currentToken.decimals);

      const tx = await core.runTopUp({
        fromChain: String(fromChain),
        // pass address or NATIVE as chosen; core/backend will handle it correctly
        fromToken: currentToken.value,
        // destination token: if partner configured one, keep it; else default to native on dest
        toToken: core.cfg?.defaults?.toToken ?? NATIVE,
        fromAmount: wei,
      });

      setMsg(`Success: ${tx.status}`);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // ---- UI
  const destChainLabel = useMemo(() => {
    const c = chains.find(x => x.id === destChainId);
    return c ? c.label : `Chain ${destChainId}`;
  }, [chains, destChainId]);

  return (
    <div style={styles.card as any}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        {title}
        <span style={styles.tag as any}>to {destChainLabel}</span>
      </div>

      {(status !== "ready") && <div style={{ color: "#6b7280" }}>
        {status === "initializing" ? "Initializing…" : errors}
      </div>}

      {status === "ready" && (
        <>
          {loading && <div style={{ color: "#6b7280" }}>Loading chains & tokens…</div>}
          {loadErr && <div style={{ color: "#b91c1c" }}>Failed to load: {loadErr}</div>}

          {!loading && !loadErr && (
            <>
              <div style={styles.row as any}>
                <select
                  style={styles.select as any}
                  value={fromChain ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setFromChain(id);
                    const first = (tokensByChain[id] ?? [])[0];
                    setFromTokenValue(first ? first.value : "");
                  }}
                >
                  {chains
                    .filter(c => c.id !== destChainId || true) // allow same-chain top-up too if supported
                    .map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>

                <select
                  style={styles.select as any}
                  value={fromTokenValue}
                  onChange={(e) => setFromTokenValue(e.target.value)}
                  disabled={!currentTokens.length}
                >
                  {currentTokens.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount + balance row */}
              <div>
                <input
                  style={styles.input as any}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Amount"
                  value={amountHuman}
                  onChange={(e) => setAmountHuman(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {balLoading
                      ? "Fetching balance…"
                      : balErr
                        ? "Balance: —"
                        : balanceForCurrent
                          ? `Balance: ${formatHuman(balanceForCurrent.raw, balanceForCurrent.decimals)}`
                          : "Balance: —"}
                  </div>
                  {balanceForCurrent && (
                    <button
                      type="button"
                      onClick={() => {
                        const human = formatHuman(balanceForCurrent.raw, balanceForCurrent.decimals, 18);
                        // Leave a tiny buffer for gas when using native coin
                        const v = currentToken?.isNative
                          ? String(Math.max(0, Number(human) - 0.0002))
                          : human;
                        setAmountHuman(v);
                      }}
                      style={{ fontSize: 12, border: "1px solid #d1d5db", borderRadius: 999, padding: "0 8px" }}
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>


              <button
                style={styles.btn as any}
                onClick={onTopUp}
                disabled={busy || !fromChain || !currentToken}
              >
                {busy ? m.ctaBusy : m.ctaIdle}
              </button>
            </>
          )}

          {msg && <div style={{ marginTop: 8 }}>{m.statusLabel}: {msg}</div>}
          {err && <div style={{ marginTop: 8, color: "#b91c1c" }}>{m.errorPrefix}: {err}</div>}
        </>
      )}
    </div>
  );
}

