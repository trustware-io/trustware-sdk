import { useEffect, useMemo, useRef, useState } from "react";
import type { ChainDef, TokenDef, Transaction } from "src/types";
import type { TrustwareCore } from "src/core";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import type { TrustwareRouteState } from "src/hooks";
import { hexToRgba } from "src/utils";


/* ─────────────────────────────────────────────────────────────
   Types / helpers to mirror FE behavior
   ──────────────────────────────────────────────────────────── */

type Stage = "idle" | "sending" | "submitted" | "waiting" | "success" | "error";
type LegStatus = "pending" | "ok" | "fail";
type LegKind = "swap" | "bridge" | "transfer";

type RouteLeg = {
  kind: LegKind;
  chainId?: number;
  srcChainId?: number;
  dstChainId?: number;
  tokenIn?: string;
  tokenOut?: string;
  tokenInLogo?: string;
  tokenOutLogo?: string;
  providerName?: string;
  providerLogo?: string;
  estimatedMs?: number;
  amountIn?: string;
  amountOut?: string;
  status?: LegStatus;
};

const RING_DASH = 339.292;

const DEFAULT_LEG_MS: Record<LegKind, number> = {
  swap: 15_000,
  bridge: 180_000,
  transfer: 45_000,
};

const numOrUndef = (n: any): number | undefined => {
  const v = Number(n);
  return Number.isFinite(v) ? v : undefined;
};
const strOrUndef = (s: any): string | undefined => (s == null ? undefined : String(s));
const shortHash = (h?: string | null, n = 6) => (!h ? "—" : h.length <= 2 * n ? h : `${h.slice(0, n)}…${h.slice(-n)}`);
const formatClock = (ms: number) => {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const parseISO = (d?: string | null) => {
  const t = d ? Date.parse(d) : NaN;
  return Number.isFinite(t) ? t : Date.now();
};
const tokenLabel = (t: any): string | undefined => {
  if (!t) return undefined;
  if (typeof t === "string") return t;
  if (typeof t === "object") {
    if (t.symbol) return String(t.symbol);
    if (t.name) return String(t.name);
    if (t.address) return shortHash(String(t.address), 4);
  }
  try {
    return JSON.stringify(t);
  } catch {
    return undefined;
  }
};
const pickLogo = (obj?: any): string | undefined =>
  obj && typeof obj === "object" && typeof obj.logoURI === "string" ? obj.logoURI : undefined;
const pickProviderName = (r: any): string | undefined => {
  const cands = [r?.provider, r?.bridge, r?.protocol, r?.platform, r?.name, r?.title, r?.action];
  for (const v of cands) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return undefined;
};
const toLegStatus = (raw?: any): LegStatus => {
  const s =
    (typeof raw === "string" ? raw : raw?.status)?.toString().toLowerCase?.() ?? "";
  if (s.includes("success") || s === "done" || s === "ok") return "ok";
  if (s.includes("fail") || s.includes("error")) return "fail";
  return "pending";
};
const normalizeTxStatus = (raw?: any) => {
  const base =
    typeof raw === "string"
      ? raw
      : typeof raw === "object" && raw
        ? raw.status ?? raw.state ?? ""
        : raw ?? "";
  const str = String(base).toLowerCase().trim();
  if (!str) return "submitted";
  if (str.includes("fail") || str.includes("error")) return "failed";
  if (str.includes("success") || str.includes("complete") || str === "done") return "success";
  if (str.includes("submit")) return "submitted";
  if (
    str.includes("bridge") ||
    str.includes("route") ||
    str.includes("pend") ||
    str.includes("wait") ||
    str.includes("process") ||
    str.includes("confirm") ||
    str.includes("progress") ||
    str.includes("send")
  ) {
    return "bridging";
  }
  if (str === "success") return "success";
  if (str === "failed") return "failed";
  if (str === "bridging") return "bridging";
  if (str === "submitted" || str === "created") return "submitted";
  return "bridging";
};
const pickKind = (raw: string): LegKind => {
  const t = raw.trim().toLowerCase();
  if (!t) return "transfer";
  if (t === "swap" || t === "rfq" || t === "exchange") return "swap";
  if (t === "bridge" || t === "axelar" || t === "cctp" || t === "send") return "bridge";
  if (t === "call" || t === "execute" || t === "execution" || t === "wrap" || t === "transfer") return "transfer";
  return "transfer";
};
const estimateRouteMs = (legs: RouteLeg[]) =>
  legs.length ? legs.reduce((sum, l) => sum + (l.estimatedMs ?? DEFAULT_LEG_MS[l.kind] ?? 30_000), 0) : 90_000;
const computeProgress = (legs: RouteLeg[]) => {
  if (!legs.length) return 10;
  const done = legs.filter((l) => l.status === "ok").length;
  const failed = legs.some((l) => l.status === "fail");
  const pending = legs.length - done - (failed ? 1 : 0);
  const frac = failed ? done / legs.length : (done + (pending ? 0.35 : 0)) / legs.length;
  return Math.max(6, Math.min(100, Math.round(frac * 100)));
};

// legs from either actions/route_path or route_status; falls back to coarse legs
function normalizeRoute(tx: Transaction): RouteLeg[] {
  if (Array.isArray((tx as any).route_path) && (tx as any).route_path.length) {
    return (tx as any).route_path.map((l: any) => {
      const rawType = (l.kind ?? l.type ?? "").toString().toLowerCase();
      const kind = rawType === "swap" || rawType === "rfq" ? "swap" : rawType === "bridge" || rawType === "send" ? "bridge" : "transfer";
      const tokenInObj = l.fromToken ?? l.tokenIn;
      const tokenOutObj = l.toToken ?? l.tokenOut;
      const estFillSec = Number(l?.data?.estimatedFillDuration);
      const estimatedMs = Number.isFinite(estFillSec) && estFillSec > 0 ? estFillSec * 1000 : undefined;
      return {
        kind,
        chainId: numOrUndef(l.chainId ?? l.toChain ?? l.fromChain),
        srcChainId: numOrUndef(l.srcChainId ?? l.fromChainId ?? l.fromChain),
        dstChainId: numOrUndef(l.dstChainId ?? l.toChainId ?? l.toChain),
        tokenIn: tokenLabel(tokenInObj) ?? tokenLabel(l.fromTokenSymbol),
        tokenOut: tokenLabel(tokenOutObj) ?? tokenLabel(l.toTokenSymbol),
        tokenInLogo: pickLogo(tokenInObj),
        tokenOutLogo: pickLogo(tokenOutObj),
        providerName: l.provider ?? l.data?.provider ?? l.data?.dex,
        providerLogo: l.logoURI ?? l.data?.logoURI,
        estimatedMs,
        amountIn: strOrUndef(l.amountIn ?? l.fromAmount),
        amountOut: strOrUndef(l.amountOut ?? l.toAmount),
        status: toLegStatus(l.status),
      } as RouteLeg;
    });
  }

  if (Array.isArray((tx as any).route_status) && (tx as any).route_status.length) {
    const fallbackSrc = numOrUndef((tx as any).from_chain_id);
    const fallbackDst = numOrUndef((tx as any).to_chain_id);
    return (tx as any).route_status.map((r: any) => {
      const rawType =
        [r.type, r.kind, r.action, r.stage, r.category, r.stepType]
          .map((v) => (v == null ? "" : String(v).toLowerCase()))
          .find((v) => v.length) ?? "";
      const kind = pickKind(rawType);
      const tokenInObj = r.tokenIn ?? r.fromToken ?? r.token ?? r.assetIn ?? r.asset;
      const tokenOutObj = r.tokenOut ?? r.toToken ?? r.token ?? r.assetOut ?? r.asset;

      const srcChainId =
        numOrUndef(
          r.srcChainId ?? r.sourceChainId ?? r.fromChainId ?? r.fromChain ?? r.src_chain_id ?? r.source_chain_id ?? r.chain?.srcChainId ?? r.chain?.fromChainId,
        ) ?? (kind === "bridge" ? fallbackSrc : undefined);

      const dstChainId =
        numOrUndef(
          r.dstChainId ?? r.destinationChainId ?? r.toChainId ?? r.toChain ?? r.dst_chain_id ?? r.destination_chain_id ?? r.chain?.dstChainId ?? r.chain?.toChainId,
        ) ?? (kind === "bridge" ? fallbackDst : undefined);

      const chainId =
        numOrUndef(
          r.chainId ?? r.chainID ?? r.chain_id ?? r.chain ?? r.chain?.id ?? r.chain?.chainId ?? r.chain?.chainID,
        ) ?? (kind === "transfer" ? dstChainId ?? srcChainId ?? fallbackDst ?? fallbackSrc : undefined);

      return {
        kind,
        chainId,
        srcChainId,
        dstChainId,
        tokenIn: tokenLabel(r.tokenInSymbol ?? r.fromTokenSymbol ?? tokenInObj),
        tokenOut: tokenLabel(r.tokenOutSymbol ?? r.toTokenSymbol ?? tokenOutObj),
        tokenInLogo: pickLogo(tokenInObj),
        tokenOutLogo: pickLogo(tokenOutObj),
        providerName: pickProviderName(r),
        providerLogo: typeof r === "object" ? r.logoURI ?? r.providerLogo ?? r.logo ?? undefined : undefined,
        amountIn: strOrUndef(r.amountIn ?? r.fromAmount ?? r.amount ?? r.value),
        amountOut: strOrUndef(r.amountOut ?? r.toAmount ?? r.estimatedAmount ?? r.minAmountOut),
        status: toLegStatus(r.status ?? r.state),
      } as RouteLeg;
    });
  }

  // fallback legs
  const src = (tx as any).from_chain_id ? Number((tx as any).from_chain_id) : undefined;
  const dst = (tx as any).to_chain_id ? Number((tx as any).to_chain_id) : undefined;
  const overall: LegStatus = (tx as any).status === "failed" ? "fail" : (tx as any).status === "success" ? "ok" : "pending";
  const legs: RouteLeg[] = [];
  legs.push({ kind: "transfer", chainId: src, status: overall });
  if (src != null && dst != null && src !== dst) legs.push({ kind: "bridge", srcChainId: src, dstChainId: dst, status: overall });
  legs.push({ kind: "transfer", chainId: dst, status: overall });
  return legs;
}

/* ─────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────── */

export type PaymentStatusProps = {
  amount: string;                       // display only (already sent)
  selectedChain: ChainDef | null;
  selectedToken: TokenDef | null;
  routeState: TrustwareRouteState;
  core: TrustwareCore;
  onClose: () => void;
  onSuccess: (tx?: Transaction) => void;
  onFailure: (error?: string) => void;
};

export function PaymentStatus({
  amount,
  selectedChain,
  selectedToken,
  routeState,
  core,
  onClose,
  onSuccess,
  onFailure,
}: PaymentStatusProps) {
  const { theme } = useTrustwareConfig();

  // UI state
  const [stage, setStage] = useState<Stage>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [progress, setProgress] = useState(6);
  const doneRef = useRef(false);
  const hasStartedRef = useRef(false);
  const flowIdRef = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const tokenLabelUI = useMemo(
    () => (selectedToken?.symbol || selectedToken?.name || selectedToken?.address || "token"),
    [selectedToken]
  );

  // kick off: send → submit receipt → poll status
  useEffect(() => {
    if (routeState.status !== "ready") {
      flowIdRef.current += 1;
      setStage("idle");
      setError(null);
      setTxHash(null);
      setTx(null);
      hasStartedRef.current = false;
      return;
    }

    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    const flowId = ++flowIdRef.current;

    let cancelled = false;
    doneRef.current = false;
    setError(null);
    setTxHash(null);
    setTx(null);

    (async () => {
      try {
        if (flowId !== flowIdRef.current || !mountedRef.current) {
          return;
        }
        setStage("sending");
        const fallbackChainId = Number(
          selectedChain?.chainId ??
          routeState.txReq?.chainId ??
          0
        );
        const hash = await core.sendRouteTransaction(
          routeState.raw,
          Number.isFinite(fallbackChainId) ? fallbackChainId : undefined
        );
        if (cancelled) return;
        setTxHash(hash);
        setStage("submitted");

        // record receipt in backend
        await core.submitReceipt(routeState.raw.intentId, hash);
        if (flowId !== flowIdRef.current || !mountedRef.current) return;
        setStage("waiting");

        // poll for Transaction (your core should return our Transaction type)
        const polled = await core.pollStatus(routeState.raw.intentId, {
          intervalMs: 2000,
          timeoutMs: 5 * 60_000,
        });
        if (flowId !== flowIdRef.current || !mountedRef.current) return;

        // normalize + store
        const fromChainIdRaw =
          (polled as any).from_chain_id ??
          (polled as any).fromChainId ??
          routeState.raw?.route?.transactionRequest?.chainId ??
          routeState.txReq?.chainId ??
          selectedChain?.chainId;
        const toChainIdRaw =
          (polled as any).to_chain_id ??
          (polled as any).toChainId ??
          selectedChain?.chainId ??
          routeState.raw?.route?.transactionRequest?.chainId;
        const toAmountWeiRaw =
          (polled as any).to_amount_wei ?? (polled as any).toAmountWei;
        const requestIdRaw = (polled as any).request_id ?? (polled as any).requestId;
        const fromChainBlockRaw =
          (polled as any).from_chain_block ?? (polled as any).fromChainBlock;
        const toChainBlockRaw =
          (polled as any).to_chain_block ?? (polled as any).toChainBlock;
        const isGmpRaw =
          (polled as any).is_gmp_transaction ?? (polled as any).isGmpTransaction;

        const norm: Transaction = {
          id: strOrUndef((polled as any).id) ?? "",
          intentId:
            strOrUndef((polled as any).intent_id ?? (polled as any).intentId ?? routeState.raw?.intentId) ??
            "",
          fromAddress:
            strOrUndef(
              (polled as any).from_address ??
              (polled as any).fromAddress ??
              (routeState.raw as any)?.fromAddress ??
              (routeState.raw as any)?.route?.fromAddress ??
              (routeState.raw as any)?.route?.transactionRequest?.from ??
              (routeState.raw as any)?.route?.transactionRequest?.fromAddress,
            ) ?? "",
          toAddress:
            strOrUndef((polled as any).to_address ?? (polled as any).toAddress ?? routeState.txReq?.to) ??
            "",
          fromChainId:
            numOrUndef(fromChainIdRaw) ?? strOrUndef(fromChainIdRaw) ?? "",
          toChainId: numOrUndef(toChainIdRaw) ?? strOrUndef(toChainIdRaw) ?? "",
          sourceTxHash:
            strOrUndef(
              (polled as any).source_tx_hash ??
              (polled as any).from_hash ??
              (polled as any).sourceHash,
            ) ?? "",
          destTxHash:
            strOrUndef(
              (polled as any).dest_tx_hash ??
              (polled as any).to_hash ??
              (polled as any).destHash,
            ) ?? "",
          requestId: strOrUndef(requestIdRaw) ?? "",
          transactionRequest:
            (polled as any).transaction_request ??
            (polled as any).transactionRequest ??
            routeState.txReq ??
            null,
          status: normalizeTxStatus(
            (polled as any).status ?? (polled as any).status_raw ?? (polled as any).tx_status,
          ) as any,
          statusRaw: (polled as any).status_raw ?? (polled as any).statusRaw ?? undefined,
          routePath: (polled as any).route_path ?? routeState.actions ?? null,
          routeStatus: (polled as any).route_status ?? routeState.actions ?? null,
          toAmountWei: numOrUndef(toAmountWeiRaw) ?? strOrUndef(toAmountWeiRaw),
          fromChainBlock: numOrUndef(fromChainBlockRaw) ?? 0,
          toChainBlock: numOrUndef(toChainBlockRaw) ?? 0,
          fromChainTxUrl: strOrUndef((polled as any).from_chain_tx_url ?? (polled as any).fromChainTxUrl),
          toChainTxUrl: strOrUndef((polled as any).to_chain_tx_url ?? (polled as any).toChainTxUrl),
          gasStatus: strOrUndef((polled as any).gas_status ?? (polled as any).gasStatus),
          isGMPTransaction:
            typeof isGmpRaw === "boolean"
              ? isGmpRaw
              : isGmpRaw == null
                ? undefined
                : Boolean(isGmpRaw),
          axelarTransactionUrl: strOrUndef(
            (polled as any).axelar_transaction_url ?? (polled as any).axelarTransactionUrl,
          ),
          createdDate:
            (polled as any).create_date ??
            (polled as any).createDate ??
            new Date().toISOString(),
          updatedDate:
            (polled as any).update_date ??
            (polled as any).updateDate ??
            new Date().toISOString(),
          timeSpentMs: numOrUndef((polled as any).time_spent_ms ?? (polled as any).timeSpentMs),
        };
        setTx(norm);


        if (norm.status === "success") {
          if (flowId !== flowIdRef.current || !mountedRef.current) return;
          setStage("success");
          if (!doneRef.current) {
            doneRef.current = true;
            onSuccess(norm);
          }
        } else if (norm.status === "failed") {
          const msg = "Transaction failed";
          if (flowId !== flowIdRef.current || !mountedRef.current) return;
          setError(msg);
          setStage("error");
          if (!doneRef.current) {
            doneRef.current = true;
            onFailure(msg);
          }
        } else {
          // still in-flight (bridging etc.) — leave UI in "waiting" and let progress visuals drive
          setStage("waiting");
        }
      } catch (err: unknown) {
        if (flowId !== flowIdRef.current || !mountedRef.current) return;
        const message =
          err instanceof Error ? err.message : typeof err === "string" ? err : "Transaction failed";
        setError(message);
        setStage("error");
        if (!doneRef.current) {
          doneRef.current = true;
          onFailure(message);
        }
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, routeState, selectedChain, onSuccess, onFailure, attempt]);

  // legs + progress + ETA
  const legs = useMemo(() => (tx ? normalizeRoute(tx) : []), [tx]);
  const targetMs = useMemo(() => estimateRouteMs(legs), [legs]);
  const startedAtMs = useMemo(() => parseISO((tx as any)?.create_date), [tx]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const routeProgress = useMemo(() => computeProgress(legs), [legs]);
  useEffect(() => {
    if ((tx as any)?.status === "success") setProgress(100);
    else if ((tx as any)?.status === "failed") setProgress((p) => Math.max(p, routeProgress));
    else setProgress(routeProgress);
  }, [routeProgress, tx]);
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const timerLabel = (tx as any)?.status === "success" ? "00:00" : formatClock(remainingMs);

  // logos
  const mainTokenLogo = legs[0]?.tokenInLogo ?? legs[0]?.tokenOutLogo ?? selectedToken?.logoURI;
  const cornerLogo =
    legs[legs.length - 1]?.tokenOutLogo ??
    legs[legs.length - 1]?.tokenInLogo ??
    selectedChain?.chainIconURI;
  const providerLogo = legs[0]?.providerLogo;
  const providerName = legs[0]?.providerName;

  // text
  const statusTitle =
    (tx as any)?.status === "success"
      ? "Confirmed"
      : (tx as any)?.status === "failed"
        ? "Failed"
        : stage === "error"
          ? "Failed"
          : "Confirming…";

  const statusSub =
    (tx as any)?.status === "success"
      ? "Your payment has been confirmed."
      : (tx as any)?.status === "failed" || stage === "error"
        ? (error ?? "Your payment failed. You can close this window.")
        : stage === "submitted"
          ? "Transaction submitted. Waiting for confirmation…"
          : stage === "sending"
            ? "Sending transaction to your wallet…"
            : "Processing secure transaction. Don’t close this window.";

  // unified image style (no cropping; center; anti-clip padding)
  const imgContain: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    padding: 2, // tiny inner pad so rounded masks don't clip sharp-corner svgs
    boxSizing: "border-box",
  };

  // hero metrics (kept numeric so alignment is exact)
  const CONTAINER_PAD = 16;
  const SECTION_GAP = 16;
  const HERO_BOX = 136;         // full frame (fits 320px embeds)
  const HERO_INNER = 96;        // token disc diameter
  const HERO_INSET = (HERO_BOX - HERO_INNER) / 2; // 20px
  const BADGE = 24;             // badge circle
  const BADGE_INSET = 12;       // distance from frame edges

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: SECTION_GAP,
        padding: `0 ${CONTAINER_PAD}px ${CONTAINER_PAD}px`,
        color: theme.textColor,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "relative",
          paddingBottom: 8,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700 }}>Payment Confirmation</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            border: "none",
            background: "transparent",
            color: theme.textColor,
            cursor: "pointer",
            padding: 8,
            borderRadius: 999,
          }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ display: "flex", flexDirection: "column", gap: SECTION_GAP }}>
        {/* Token icon + chain/provider badges + animated ring */}
        <div style={{ alignSelf: "center", position: "relative", width: HERO_BOX, height: HERO_BOX }}>
          <svg style={{ position: "absolute", inset: 0, width: HERO_BOX, height: HERO_BOX }} viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={hexToRgba(theme.textColor, 0.15)}
              strokeWidth="4"
            />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={theme.primaryColor} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={RING_DASH}
              strokeDashoffset={RING_DASH * (1 - Math.min(progress, 100) / 100)}
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>

          {/* Main token disc — perfectly centered */}
          <div
            style={{
              position: "absolute",
              left: HERO_INSET,
              top: HERO_INSET,
              width: HERO_INNER,
              height: HERO_INNER,
              borderRadius: HERO_INNER / 2,
              overflow: "hidden",
              background: hexToRgba(theme.borderColor, 0.22),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            {mainTokenLogo ? (
              <img src={mainTokenLogo} alt={selectedToken?.symbol ?? "token"} style={imgContain} />
            ) : (
              <span>{selectedToken?.symbol?.slice(0, 1) ?? "?"}</span>
            )}
          </div>

          {/* Chain badge — aligned with consistent inset */}
          {cornerLogo && (
            <div
              style={{
                position: "absolute",
                right: BADGE_INSET,
                bottom: BADGE_INSET,
                width: BADGE,
                height: BADGE,
                borderRadius: BADGE / 2,
                overflow: "hidden",
                border: `2px solid ${theme.backgroundColor}`,
                background: theme.backgroundColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img src={cornerLogo} alt={selectedChain?.networkName ?? "chain"} style={imgContain} />
            </div>
          )}

          {/* Provider badge — symmetric to chain badge */}
          {providerLogo && (
            <div
              style={{
                position: "absolute",
                left: BADGE_INSET,
                top: BADGE_INSET,
                width: BADGE,
                height: BADGE,
                borderRadius: BADGE / 2,
                overflow: "hidden",
                border: `2px solid ${theme.backgroundColor}`,
                background: theme.backgroundColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img src={providerLogo} alt={providerName ?? "provider"} style={imgContain} />
            </div>
          )}
        </div>

        {/* Title + timer */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{statusTitle}</div>
          <div style={{ fontSize: 13, color: hexToRgba(theme.textColor, 0.7), marginTop: 4 }}>{statusSub}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
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
                  animation: (tx as any)?.status === "success" || stage === "error" ? "none" : "pulse 1.5s infinite",
                } as any}
              />
            </div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{timerLabel}</span>
          </div>
        </div>

        {/* Progress + legs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {(tx as any)?.status === "success" ? "Funds delivered" : "Bridging funds…"}
            </div>
            <div style={{ fontSize: 12, color: hexToRgba(theme.textColor, 0.7) }}>
              {Math.floor(Math.min(progress, 100))}% complete
            </div>
          </div>

          <div style={{ position: "relative", paddingLeft: 28 }}>
            {/* grey spine */}
            <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: theme.borderColor }} />
            {/* progress spine (coarse visual—height proportional to % complete) */}
            <div
              style={{
                position: "absolute",
                left: 8,
                top: 0,
                width: 2,
                background: theme.primaryColor,
                height: `${Math.min(progress, 100)}%`,
                transition: "height 0.3s linear",
              }}
            />
            {legs.length === 0 && (
              <div style={{ fontSize: 13, color: hexToRgba(theme.textColor, 0.7) }}>Waiting for route details…</div>
            )}
            {legs.map((leg, i) => {
              const done = (leg.status ?? "pending") === "ok";
              const fail = (leg.status ?? "pending") === "fail";
              const pending = !done && !fail;
              const title =
                leg.kind === "swap"
                  ? leg.providerName ?? "Swap"
                  : leg.kind === "bridge"
                    ? `Bridge ${leg.srcChainId ?? ""} → ${leg.dstChainId ?? ""}`
                    : "Transfer";
              const nodeImg = leg.tokenOutLogo ?? leg.tokenInLogo ?? leg.providerLogo;

              return (
                <div key={i} style={{ position: "relative", marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: 22, // slightly tighter node
                      height: 22,
                      borderRadius: 11,
                      overflow: "hidden",
                      border: `1px solid ${done
                        ? hexToRgba("#10b981", 0.4)
                        : fail
                          ? hexToRgba("#ef4444", 0.4)
                          : theme.borderColor
                        }`,
                      background: done
                        ? hexToRgba("#10b981", 0.18)
                        : fail
                          ? hexToRgba("#ef4444", 0.18)
                          : hexToRgba(theme.borderColor, 0.28),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                    }}
                  >
                    {nodeImg ? (
                      <img src={nodeImg} alt="step" style={imgContain} />
                    ) : (
                      <span>{leg.kind === "swap" ? "🪙" : leg.kind === "bridge" ? "🌉" : "📦"}</span>
                    )}
                    {(done || fail) && (
                      <div
                        style={{
                          position: "absolute",
                          right: -3,
                          bottom: -3,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          background: done ? "#10b981" : "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 8,
                          fontWeight: 700,
                        }}
                      >
                        {done ? "✓" : "×"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{title}</div>
                    <div style={{ fontSize: 12, color: hexToRgba(theme.textColor, 0.7) }}>
                      {pending ? "Pending…" : done ? "Completed" : "Failed"}
                    </div>
                    {(leg.tokenIn || leg.tokenOut) && (
                      <div style={{ fontSize: 11, color: hexToRgba(theme.textColor, 0.6), marginTop: 4 }}>
                        {leg.tokenIn && <span style={{ marginRight: 8 }}>In: {leg.tokenIn}</span>}
                        {leg.tokenOut && <span>Out: {leg.tokenOut}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tx links */}
          {tx && (
            <div style={{ paddingTop: 6, fontSize: 13, color: hexToRgba(theme.textColor, 0.7) }}>
              {(tx as any).source_tx_hash && (
                <div style={{ marginBottom: 4 }}>
                  Source tx:{" "}
                  {(tx as any).from_chain_tx_url ? (
                    <a
                      href={(tx as any).from_chain_tx_url as string}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: theme.textColor, textDecoration: "underline" }}
                    >
                      {shortHash((tx as any).source_tx_hash as string)}
                    </a>
                  ) : (
                    <code>{shortHash((tx as any).source_tx_hash as string)}</code>
                  )}
                </div>
              )}
              {(tx as any).dest_tx_hash && (
                <div>
                  Dest tx:{" "}
                  {(tx as any).to_chain_tx_url ? (
                    <a
                      href={(tx as any).to_chain_tx_url as string}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: theme.textColor, textDecoration: "underline" }}
                    >
                      {shortHash((tx as any).dest_tx_hash as string)}
                    </a>
                  ) : (
                    <code>{shortHash((tx as any).dest_tx_hash as string)}</code>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 10,
              borderRadius: 12,
              background:
                (tx as any)?.status === "failed"
                  ? hexToRgba("#ef4444", 0.15)
                  : (tx as any)?.status === "success"
                    ? hexToRgba("#10b981", 0.15)
                    : hexToRgba(theme.borderColor, 0.3),
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background:
                  (tx as any)?.status === "success"
                    ? "#10b981"
                    : (tx as any)?.status === "failed"
                      ? "#ef4444"
                      : theme.primaryColor,
                animation:
                  (tx as any)?.status === "success" || (tx as any)?.status === "failed" ? "none" : "pulse 1.3s infinite",
              } as any}
            />
            <span style={{ fontSize: 13 }}>
              {(tx as any)?.status === "success"
                ? "Transaction verified"
                : (tx as any)?.status === "failed"
                  ? "Transaction failed"
                  : "Verifying transaction…"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 10,
              borderRadius: 12,
              background: (tx as any)?.status === "success" ? hexToRgba("#10b981", 0.15) : hexToRgba(theme.borderColor, 0.2),
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: (tx as any)?.status === "success" ? "#10b981" : hexToRgba(theme.textColor, 0.4),
              }}
            />
            <span style={{ fontSize: 13, color: (tx as any)?.status === "success" ? theme.textColor : hexToRgba(theme.textColor, 0.7) }}>
              {(tx as any)?.status === "success" ? "Confirmation complete" : "Waiting for confirmation"}
            </span>
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              border: `1px solid ${theme.borderColor}`,
              background: theme.backgroundColor,
              color: theme.textColor,
              cursor: "pointer",
            }}
          >
            Close
          </button>
          {(stage === "error" || (tx as any)?.status === "failed") && (
            <button
              type="button"
              onClick={() => {
                if (routeState.status === "ready") {
                  doneRef.current = false;
                  hasStartedRef.current = false;
                  flowIdRef.current += 1;
                  setStage("idle");
                  setProgress(6);
                  setTx(null);
                  setAttempt((n) => n + 1);
                }
              }}
              style={{
                padding: "9px 14px",
                borderRadius: 999,
                border: "none",
                background: theme.primaryColor,
                color: theme.backgroundColor,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Try again
            </button>
          )}
        </div>

        {/* Tiny footer note */}
        <div style={{ textAlign: "center", fontSize: 12, color: hexToRgba(theme.textColor, 0.6), paddingBottom: 4 }}>
          Sending {amount || "0"} {tokenLabelUI}
          {txHash ? <> • Tx: <span style={{ fontFamily: "monospace" }}>{shortHash(txHash)}</span></> : null}
        </div>
      </div>
    </div>
  );
}

