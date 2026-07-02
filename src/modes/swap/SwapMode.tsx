import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "src/widget/styles";
import { mergeStyles } from "src/widget/lib/utils";
import { mapError } from "src/widget/lib/mapError";
import {
  WidgetContainer,
  WidgetSecurityFooter,
  ErrorPage,
} from "src/widget/components";
import { getSharedRegistry } from "src/core/registryClient";
import { isSerializedSolanaTxRequest } from "src/core/routes";
import { useThemePreference } from "src/widget/state/deposit/useThemePreference";
import { useWalletSessionState } from "src/widget/state/deposit/useWalletSessionState";
import { useWalletTokenState } from "src/widget/state/deposit/useWalletTokenState";
import { useChains } from "src/widget/hooks";
import { rawToDecimal } from "src/widget/helpers/tokenAmount";
import {
  normalizeChainType,
  isNativeTokenAddress,
  isZeroAddrLike,
} from "src/widget/helpers/chainHelpers";
import { useTrustwareConfig } from "src/hooks";
import { useTrustware } from "src/provider";
import { useSwapRoute } from "./hooks/useSwapRoute";
import { useSwapExecution } from "./hooks/useSwapExecution";
import { useForex } from "./hooks/useForex";
import { SwapTokenSelect } from "./components/SwapTokenSelect";
import { SwapWalletSelector } from "./components/SwapWalletSelector";
import { SUPPORTED_CURRENCIES, getCurrencyMeta, fmtCurrency } from "./currency";
import type { SwapStage, SwapTxStatus } from "./types";
import type { ChainDef } from "src/types";
import type { Token, YourTokenData } from "src/widget/state/deposit/types";
import type { Theme } from "src/widget/components";

const ConfettiEffect = lazy(
  () => import("src/widget/components/ConfettiEffect")
);

interface SwapModeProps {
  theme?: Theme;
  style?: React.CSSProperties;
}

const QUOTE_TTL = 60; // seconds before a quote auto-refreshes

const QUOTE_LOADING_MESSAGES = [
  "Finding your best route...",
  "Scanning liquidity pools...",
  "Calculating bridge fees...",
  "Checking exchange rates...",
  "Optimizing for lowest fees...",
  "Getting live pricing...",
  "Almost ready...",
];

const PERCENT_OPTIONS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "Max", value: 1 },
];

function fmtAmount(n: number, max = 6): string {
  if (!isFinite(n) || n === 0) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

// Build a block-explorer URL for a tx hash.
// Prefers the backend-supplied URL; falls back to chain's blockExplorerUrls list.
function buildExplorerUrl(
  hash: string,
  chain: ChainDef | null,
  backendUrl?: string | null
): string | null {
  if (backendUrl) return backendUrl;
  const base = chain?.blockExplorerUrls?.[0];
  if (!base || !hash) return null;
  return `${base.replace(/\/+$/, "")}/tx/${hash}`;
}

// Extract a 0x… hash from a full explorer URL (e.g. https://snowtrace.io/tx/0x123…)
// Falls back to the raw string if no match.
function hashFromExplorerUrl(url: string): string {
  const m = url.match(/\/tx\/(0x[0-9a-fA-F]+)/i);
  return m ? m[1] : url;
}

function validateDestAddress(address: string, chainType: string): boolean {
  const a = address.trim();
  if (!a) return false;
  const t = chainType.toLowerCase();
  if (t === "evm") return /^0x[0-9a-fA-F]{40}$/.test(a);
  if (t === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  if (t === "cosmos") return /^[a-z]+1[a-z0-9]{38,58}$/.test(a);
  if (t === "bitcoin") return /^(1|3|bc1)[a-zA-Z0-9]{24,90}$/.test(a);
  if (t === "sui") return /^0x[0-9a-fA-F]{64}$/.test(a);
  return a.length > 0;
}

// Always truncates (never rounds up) — safe for "Max" balance inputs
function truncateDecimal(n: number, dp: number): string {
  const factor = Math.pow(10, dp);
  const truncated = Math.floor(n * factor) / factor;
  const s = truncated.toFixed(dp);
  // Strip trailing zeros after decimal
  return s.includes(".") ? s.replace(/\.?0+$/, "") || "0" : s;
}

function scaleFontSize(str: string): string {
  const len = str.replace(/[^0-9.]/g, "").length;
  if (len <= 6) return "2.5rem";
  if (len <= 9) return "2rem";
  if (len <= 12) return "1.5rem";
  if (len <= 15) return "1.125rem";
  return "0.875rem";
}

function getProgressFromStatus(status: SwapTxStatus): number {
  switch (status) {
    case "approving":
      return 12;
    case "confirming":
      return 28;
    case "processing":
      return 55;
    case "bridging":
      return 78;
    case "success":
      return 100;
    default:
      return 0;
  }
}

// Returns which step index is currently the "active" one (0-based)
function getActiveStep(status: SwapTxStatus): number {
  switch (status) {
    case "approving":
    case "confirming":
      return 0;
    case "processing":
      return 1;
    case "bridging":
      return 2;
    case "success":
      return 3; // all done
    default:
      return 0;
  }
}

function RateRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ color: colors.mutedForeground }}>{label}</span>
      <span style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>
        {value}
      </span>
    </div>
  );
}

export function SwapMode({
  theme: themeProp,
  style,
}: SwapModeProps): React.ReactElement {
  const [stage, setStage] = useState<SwapStage>("home");

  const [fromToken, setFromToken] = useState<Token | YourTokenData | null>(
    null
  );
  const [fromChain, setFromChain] = useState<ChainDef | null>(null);
  const [toToken, setToToken] = useState<Token | YourTokenData | null>(null);
  const [toChain, setToChain] = useState<ChainDef | null>(null);
  const [amount, setAmount] = useState("");
  const [amountInputMode, setAmountInputMode] = useState<"usd" | "token">(
    "usd"
  );
  const [hoverSell, setHoverSell] = useState(false);
  const [showRateDetails, setShowRateDetails] = useState(false);
  const [showReviewDetails, setShowReviewDetails] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [maxApproval, setMaxApproval] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [slippageInput, setSlippageInput] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [rateUpdated, setRateUpdated] = useState(false);
  const prevToAmountRef = useRef<number | null>(null);
  const [destAddress, setDestAddress] = useState("");
  const [quoteAge, setQuoteAge] = useState(0);
  const quoteTimestampRef = useRef<number | null>(null);
  const [quoteLoadingMsgIdx, setQuoteLoadingMsgIdx] = useState(0);
  const [quoteLoadingMsgVisible, setQuoteLoadingMsgVisible] = useState(true);
  const latestFetchParamsRef = useRef<
    Parameters<ReturnType<typeof useSwapRoute>["fetch"]>[0] | null
  >(null);

  // Forex rates refreshed every 5 min — fallback to 1 (USD) on error
  const { rates: forexRates } = useForex();
  const currencyMeta = getCurrencyMeta(selectedCurrency);
  const currencyRate = forexRates[selectedCurrency] ?? 1;
  const currencySymbol = currencyMeta.symbol;
  const fmtLocal = useCallback(
    (usdAmount: number | null): string => {
      const sym = getCurrencyMeta(selectedCurrency).symbol;
      if (usdAmount === null || !isFinite(usdAmount) || usdAmount <= 0)
        return `${sym}0`;
      const local = usdAmount * currencyRate;
      if (local < 0.01) return `< ${sym}0.01`;
      return fmtCurrency(usdAmount, selectedCurrency, currencyRate);
    },
    [currencyRate, selectedCurrency]
  );
  const settingsRef = useRef<HTMLDivElement>(null);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  const { emitEvent } = useTrustware();

  // Read feature flags and theme from config
  const { features, theme: configTheme } = useTrustwareConfig();
  const effectiveThemeSetting = (themeProp ?? configTheme ?? "system") as
    | "light"
    | "dark"
    | "system";
  const { resolvedTheme, toggleTheme } = useThemePreference(
    effectiveThemeSetting
  );
  const defaultDestRef = features.swapDefaultDestToken;
  const lockDestToken = features.swapLockDestToken && !!defaultDestRef;
  const allowedDestTokens = features.swapAllowedDestTokens;

  // Chains loaded once here — passed down to token selectors, never re-fetched per stage
  const {
    popularChains,
    otherChains,
    isLoading: chainsLoading,
    error: chainsError,
  } = useChains();

  // When allowedDestTokens is set, restrict the "to" chain selector to only chains that
  // have at least one allowed destination token. Client-side filter only — no extra fetches,
  // no impact on deposit mode or the "from" selector.
  const allowedDestChainIds = useMemo(() => {
    if (!allowedDestTokens || allowedDestTokens.length === 0) return null;
    return new Set(allowedDestTokens.map((t) => t.chainId));
  }, [allowedDestTokens]);

  const toPopularChains = useMemo(
    () =>
      allowedDestChainIds
        ? popularChains.filter((c) =>
            allowedDestChainIds.has(Number(c.chainId))
          )
        : popularChains,
    [popularChains, allowedDestChainIds]
  );

  const toOtherChains = useMemo(
    () =>
      allowedDestChainIds
        ? otherChains.filter((c) => allowedDestChainIds.has(Number(c.chainId)))
        : otherChains,
    [otherChains, allowedDestChainIds]
  );

  // Resolve the default dest token by querying the registry directly for the exact address.
  // We use tokensPage(chainId, { q: address, limit: 1 }) so we never depend on pagination order.
  const allChains = useMemo(
    () => [...popularChains, ...otherChains],
    [popularChains, otherChains]
  );
  const destInitialized = useRef(false);
  useEffect(() => {
    if (!defaultDestRef || destInitialized.current || allChains.length === 0)
      return;
    const chain = allChains.find(
      (c) => Number(c.chainId) === defaultDestRef.chainId
    );
    if (!chain) return;

    const registry = getSharedRegistry();
    registry
      .tokensPage(chain.chainId, { q: defaultDestRef.address, limit: 5 })
      .then((page: import("src/types/blockchain").TokenPageResult) => {
        if (destInitialized.current) return;
        const normalizedAddr = defaultDestRef.address.toLowerCase();
        const match = page.data.find(
          (t) => t.address.toLowerCase() === normalizedAddr
        );
        if (!match) return;
        destInitialized.current = true;
        setToToken({
          address: match.address,
          chainId: match.chainId,
          symbol: match.symbol,
          name: match.name,
          decimals: match.decimals,
          iconUrl: match.logoURI,
          logoURI: match.logoURI,
          usdPrice: match.usdPrice,
        });
        setToChain(chain);
      })
      .catch(() => {
        /* non-fatal — user can still pick manually */
      });
  }, [defaultDestRef, allChains]);

  // Single wallet state instance — shared across all stages
  const { walletAddress, walletStatus, connectWallet, disconnectWallet } =
    useWalletSessionState();

  // Stable setters so useWalletTokenState's load effect deps don't change on every render
  const setFromTokenStable = useCallback(
    (t: Token | YourTokenData | null) => setFromToken(t),
    []
  );
  const setFromChainStable = useCallback(
    (c: ChainDef | null) => setFromChain(c),
    []
  );

  // Fetch wallet balances for the "sell" selector only
  const { yourWalletTokens, reloadWalletTokens } = useWalletTokenState({
    walletAddress,
    selectedChain: fromChain,
    setSelectedChain: setFromChainStable,
    selectedToken: fromToken,
    setSelectedToken: setFromTokenStable,
  });

  // Route state — only populated when user explicitly requests a quote
  const route = useSwapRoute();

  // Execution state — pass full fromChain so SA path can build the viemChain object
  const execution = useSwapExecution(fromChain);

  // ─── Price + amount — hoisted above handlers so callbacks can reference them ──

  const fromTokenPriceUSD = useMemo(() => {
    const p = fromToken?.usdPrice;
    return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : 0;
  }, [fromToken]);
  const hasFromUsdPrice = fromTokenPriceUSD > 0;

  const toTokenPriceUSD = useMemo(() => {
    const p = toToken?.usdPrice;
    return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : 0;
  }, [toToken]);
  const hasToUsdPrice = toTokenPriceUSD > 0;

  const rawSellNum = parseFloat(amount) || 0;

  // When in fiat mode, the user types in `selectedCurrency` — divide by rate to get USD
  const usdSellNum = useMemo(() => {
    if (amountInputMode === "usd") return rawSellNum / currencyRate;
    return hasFromUsdPrice ? rawSellNum * fromTokenPriceUSD : 0;
  }, [
    amountInputMode,
    rawSellNum,
    currencyRate,
    hasFromUsdPrice,
    fromTokenPriceUSD,
  ]);

  const tokenSellNum = useMemo(() => {
    if (amountInputMode === "usd") {
      return hasFromUsdPrice && fromTokenPriceUSD > 0
        ? usdSellNum / fromTokenPriceUSD
        : 0;
    }
    return rawSellNum;
  }, [
    amountInputMode,
    rawSellNum,
    usdSellNum,
    hasFromUsdPrice,
    fromTokenPriceUSD,
  ]);

  const tokenAmountStr = useMemo(() => {
    if (tokenSellNum <= 0) return "";
    const decimals = fromToken?.decimals ?? 18;
    return truncateDecimal(tokenSellNum, Math.min(decimals, 18));
  }, [tokenSellNum, fromToken?.decimals]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleCurrencyChange = useCallback(
    (newCode: string) => {
      if (amountInputMode === "usd" && amount) {
        const oldRate = currencyRate; // rate for current selectedCurrency
        const newRate = forexRates[newCode] ?? 1;
        const parsed = parseFloat(amount) || 0;
        if (parsed > 0 && oldRate > 0) {
          // Re-express the same USD value in the new currency
          setAmount(truncateDecimal((parsed / oldRate) * newRate, 2));
        }
      }
      setSelectedCurrency(newCode);
      route.clear();
    },
    [amountInputMode, amount, currencyRate, forexRates, route]
  );

  const handleSelectFromToken = useCallback(
    (token: Token | YourTokenData, chain: ChainDef) => {
      setFromToken(token);
      setFromChain(chain);
      route.clear();
      // If the new token has a USD price, prefer USD mode.
      // The fallback effect handles the no-price case in the next render.
      const p = (token as Token).usdPrice;
      if (typeof p === "number" && Number.isFinite(p) && p > 0) {
        setAmountInputMode("usd");
      }
      setStage("home");
      emitEvent?.({
        type: "swap_route_changed",
        fromChain: String(chain.chainId),
        fromToken: token.address,
        toChain: String(toChain?.chainId ?? ""),
        toToken: toToken?.address ?? "",
        ...(amount ? { amount } : {}),
      });
    },
    [route, emitEvent, toToken, toChain, amount]
  );

  const handleSelectToToken = useCallback(
    (token: Token | YourTokenData, chain: ChainDef) => {
      setToToken(token);
      setToChain(chain);
      route.clear();
      setStage("home");
      emitEvent?.({
        type: "swap_route_changed",
        fromChain: String(fromChain?.chainId ?? ""),
        fromToken: fromToken?.address ?? "",
        toChain: String(chain.chainId),
        toToken: token.address,
        ...(amount ? { amount } : {}),
      });
    },
    [route, emitEvent, fromToken, fromChain, amount]
  );

  const handleFlip = useCallback(() => {
    // When dest is locked, flipping would lose the locked token — disallow it
    if (lockDestToken) return;
    const newFrom = toToken ?? fromToken;
    const newFromChain = toChain ?? fromChain;
    setFromToken((prev) => toToken ?? prev);
    setFromChain((prev) => toChain ?? prev);
    setToToken(fromToken);
    setToChain(fromChain);
    setAmount("");
    route.clear();
    emitEvent?.({
      type: "swap_route_changed",
      fromChain: String(newFromChain?.chainId ?? ""),
      fromToken: newFrom?.address ?? "",
      toChain: String(fromChain?.chainId ?? ""),
      toToken: fromToken?.address ?? "",
    });
  }, [lockDestToken, fromToken, fromChain, toToken, toChain, route, emitEvent]);

  const fromChainType = normalizeChainType(fromChain);
  const toChainType = normalizeChainType(toChain);
  const needsDestAddress =
    !!fromChainType && !!toChainType && fromChainType !== toChainType;
  const isValidDestAddress =
    !needsDestAddress || validateDestAddress(destAddress, toChainType ?? "");

  const handleReview = useCallback(async () => {
    if (
      !fromToken ||
      !fromChain ||
      !toToken ||
      !toChain ||
      !tokenAmountStr ||
      !walletAddress
    ) {
      if (!walletAddress) setStage("connect-wallet");
      return;
    }

    // Route already fresh — navigate immediately
    if (route.data) {
      setStage("review");
      return;
    }

    // Still fetching — button should be disabled, but guard just in case
    if (route.loading) {
      return;
    }

    // No route yet (e.g. wallet just connected before auto-fetch fired) — fetch now
    const result = await route.fetch({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amount: tokenAmountStr,
      walletAddress,
      toAddress: needsDestAddress ? destAddress.trim() : walletAddress,
      slippage,
    });
    if (result) setStage("review");
  }, [
    fromToken,
    fromChain,
    toToken,
    toChain,
    tokenAmountStr,
    walletAddress,
    needsDestAddress,
    destAddress,
    route,
    slippage,
  ]);

  const handleConnectAndReview = useCallback(() => {
    setStage("connect-wallet");
  }, []);

  const handleWalletConnected = useCallback(() => {
    // Wallet just connected — go back to home so they can tap Review
    setStage("home");
  }, []);

  const handleExecute = useCallback(async () => {
    if (!route.data) return;
    setStage("processing");
    const fromTokenAddress =
      fromToken?.address ?? (fromToken as { address?: string })?.address;
    const fromTokenDecimals = fromToken?.decimals ?? undefined;

    // Solana blockhashes expire in ~60-90s and a quote can sit on the review
    // screen for nearly the full QUOTE_TTL window before the user confirms —
    // rebuild right before signing so the wallet gets a transaction with a
    // fresh blockhash instead of one that may already be expired.
    let routeToSend = route.data;
    if (
      isSerializedSolanaTxRequest(routeToSend.txReq) &&
      latestFetchParamsRef.current
    ) {
      const fresh = await route.fetch(latestFetchParamsRef.current);
      if (fresh) routeToSend = fresh;
    }

    await execution.execute(
      routeToSend,
      fromTokenAddress,
      fromTokenDecimals,
      walletAddress ?? undefined,
      maxApproval,
      () => {
        setCompletedAt(new Date());
        setStage("success");
      },
      () => setStage("error")
    );
  }, [route, execution, fromToken, walletAddress, maxApproval]);

  const handleReset = useCallback(() => {
    execution.reset();
    route.clear();
    setAmount("");
    setAmountInputMode("usd");
    setCompletedAt(null);
    setCopiedHash(null);
    setStage("home");
    reloadWalletTokens();
  }, [execution, route, reloadWalletTokens]);

  const handleSwapBack = useCallback(() => {
    const prevFrom = fromToken;
    const prevFromChain = fromChain;
    setFromToken(toToken);
    setFromChain(toChain);
    setToToken(prevFrom);
    setToChain(prevFromChain);
    setAmount("");
    setAmountInputMode("usd");
    execution.reset();
    route.clear();
    setCompletedAt(null);
    setCopiedHash(null);
    setStage("home");
    reloadWalletTokens();
  }, [
    fromToken,
    fromChain,
    toToken,
    toChain,
    execution,
    route,
    reloadWalletTokens,
  ]);

  const handleCopyHash = useCallback((hash: string) => {
    if (!navigator?.clipboard?.writeText) return;
    void navigator.clipboard.writeText(hash).then(() => {
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash((v) => (v === hash ? null : v)), 1500);
    });
  }, []);

  const handleToggleDenom = useCallback(() => {
    if (!hasFromUsdPrice) return;
    const parsed = parseFloat(amount) || 0;
    if (amountInputMode === "usd") {
      // fiat → token: fiat amount / rate = USD, then USD / tokenPrice = token qty
      const decimals = fromToken?.decimals ?? 18;
      const tokenVal =
        parsed > 0 && fromTokenPriceUSD > 0
          ? truncateDecimal(
              parsed / currencyRate / fromTokenPriceUSD,
              Math.min(decimals, 6)
            )
          : "";
      setAmount(tokenVal);
      setAmountInputMode("token");
    } else {
      // token → fiat: token qty * tokenPrice (USD) * rate = fiat amount
      const fiatVal =
        parsed > 0
          ? truncateDecimal(parsed * fromTokenPriceUSD * currencyRate, 2)
          : "";
      setAmount(fiatVal);
      setAmountInputMode("usd");
    }
    route.clear();
  }, [
    hasFromUsdPrice,
    amountInputMode,
    amount,
    fromTokenPriceUSD,
    currencyRate,
    fromToken?.decimals,
    route,
  ]);

  // ─── Derived values ───────────────────────────────────────────────────────────

  // rawToDecimal avoids the Number(BigInt) precision loss on tokens with 18 decimals
  const fromBalance = useMemo(() => {
    const walletToken = fromToken as YourTokenData;
    if (!walletToken || !("balance" in walletToken)) return null;
    const raw = walletToken.balance;
    if (!raw) return null;
    const decimals = fromToken?.decimals ?? 18;
    const n = Number(rawToDecimal(raw, decimals));
    return Number.isFinite(n) ? n : null;
  }, [fromToken]);

  // USD value of the balance — same formula as AmountBalanceRow: normalizedBalance * tokenPriceUSD
  const balanceUsd =
    fromBalance !== null && hasFromUsdPrice
      ? fromBalance * fromTokenPriceUSD
      : null;

  // Spot-price estimate shown immediately when both tokens selected — no route needed
  const estimatedToAmount = useMemo(() => {
    if (tokenSellNum <= 0 || !hasFromUsdPrice || !hasToUsdPrice) return null;
    return tokenSellNum * (fromTokenPriceUSD / toTokenPriceUSD);
  }, [
    tokenSellNum,
    fromTokenPriceUSD,
    toTokenPriceUSD,
    hasFromUsdPrice,
    hasToUsdPrice,
  ]);

  // Best USD reading from backend — check all known field paths
  const backendToUsdStr = useMemo(() => {
    return (
      route.data?.finalExchangeRate?.toAmountMinUSD ??
      route.data?.route?.estimate?.toAmountMinUsd ??
      route.data?.route?.estimate?.toAmountUsd ??
      null
    );
  }, [route.data]);

  const toAmount = useMemo(() => {
    // 1. Derive from backend's direct USD value (immune to decimal-count errors)
    if (backendToUsdStr && toTokenPriceUSD > 0) {
      const usd = parseFloat(backendToUsdStr);
      if (Number.isFinite(usd) && usd > 0) return usd / toTokenPriceUSD;
    }

    // 2. Parse raw smallest-unit or decimal string
    const raw = route.data?.route?.estimate?.toAmount;
    if (!raw) return null;
    let n: number;
    if (/^\d+$/.test(raw.trim())) {
      n = Number(rawToDecimal(raw, toToken?.decimals ?? 18));
    } else {
      n = parseFloat(raw);
    }
    if (!Number.isFinite(n) || n <= 0) return null;

    // Sanity check: if parsed value is < 0.01% of the spot estimate,
    // the decimal count is almost certainly wrong — discard so display falls back
    if (
      estimatedToAmount &&
      estimatedToAmount > 0 &&
      n / estimatedToAmount < 0.0001
    ) {
      return null;
    }

    return n;
  }, [
    route.data,
    toToken,
    toTokenPriceUSD,
    backendToUsdStr,
    estimatedToAmount,
  ]);

  const fromUsd = usdSellNum;

  const toUsd = useMemo(() => {
    // Prefer backend's direct USD value (no price-multiplication error)
    if (backendToUsdStr) {
      const n = parseFloat(backendToUsdStr);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return hasToUsdPrice ? (toAmount ?? 0) * toTokenPriceUSD : 0;
  }, [backendToUsdStr, toAmount, toTokenPriceUSD, hasToUsdPrice]);

  // Show exact route amount when available, fall back to spot-price estimate
  const displayToAmount = route.data ? toAmount : estimatedToAmount;
  const isEstimate = !route.data;

  // Anything below $0.001 is a parsing artifact — treat as zero so the estimate fallback fires
  const USD_EPSILON = 0.001;
  // USD shown in the buy card: prefer direct route value, fall back to spot-price estimate
  const displayToUsd =
    toUsd > USD_EPSILON
      ? toUsd
      : estimatedToAmount !== null && hasToUsdPrice
        ? estimatedToAmount * toTokenPriceUSD
        : 0;

  // Price impact: fraction of value lost — only meaningful on a real route with both USD values
  const priceImpact = useMemo(() => {
    if (!route.data || fromUsd < 0.01 || displayToUsd < 0.01) return null;
    const impact = 1 - displayToUsd / fromUsd;
    return impact > 0.001 ? impact : null;
  }, [route.data, fromUsd, displayToUsd]);

  // Human-readable hop path: "ETH → Squid → SOL" or multi-step "USDC → Uniswap → ETH → Axelar → SOL"
  const routePath = useMemo(() => {
    if (!route.data) return null;
    const provider = route.data.route?.provider;
    const steps = route.data.route?.steps;
    const fromSym = fromToken?.symbol;
    const toSym = toToken?.symbol;
    if (!fromSym || !toSym) return provider ?? null;
    if (Array.isArray(steps) && steps.length > 0) {
      const parts: string[] = [fromSym];
      let last = fromSym;
      for (const raw of steps) {
        const s = raw as Record<string, unknown>;
        const via = ((s.provider ?? s.tool ?? s.name ?? "") as string).trim();
        const mid = (
          (s.toToken as Record<string, unknown> | undefined)?.symbol as
            | string
            | undefined
        )?.trim();
        if (via) parts.push(via);
        if (mid && mid !== last && mid !== toSym) {
          parts.push(mid);
          last = mid;
        }
      }
      if (last !== toSym) parts.push(toSym);
      if (parts.length > 1) return parts.join(" → ");
    }
    if (provider) return `${fromSym} → ${provider} → ${toSym}`;
    return null;
  }, [route.data, fromToken?.symbol, toToken?.symbol]);

  // Whether the paymaster/sponsorship covers gas for this route
  const isGasSponsored = !!route.data?.sponsorship;

  // Gas fees only (network cost) — extracted from fees array by type keyword
  const networkCostUsd = useMemo((): number | null => {
    const fees = route.data?.route?.estimate?.fees as
      | { type?: string; amountUsd?: string | number }[]
      | undefined;
    if (!fees?.length) return null;
    const gasTotal = fees
      .filter((f) => f.type?.toLowerCase().includes("gas"))
      .reduce((sum, f) => sum + (Number(f.amountUsd) || 0), 0);
    return gasTotal > 0 ? gasTotal : null;
  }, [route.data]);

  // Protocol/service fees (everything that isn't gas)
  const protocolFeeUsd = useMemo((): number | null => {
    const fees = route.data?.route?.estimate?.fees as
      | { type?: string; amountUsd?: string | number }[]
      | undefined;
    if (!fees?.length) return null;
    const total = fees
      .filter((f) => !f.type?.toLowerCase().includes("gas"))
      .reduce((sum, f) => sum + (Number(f.amountUsd) || 0), 0);
    return total > 0 ? total : null;
  }, [route.data]);

  // Exchange rate: how much fromToken you need to buy 1 toToken
  // e.g. selling USDC to buy AVAX: 1 AVAX = 6.57 USDC → toPrice / fromPrice
  const exchangeRate = useMemo(() => {
    if (!hasFromUsdPrice || !hasToUsdPrice) return null;
    return toTokenPriceUSD / fromTokenPriceUSD;
  }, [fromTokenPriceUSD, toTokenPriceUSD, hasFromUsdPrice, hasToUsdPrice]);

  const insufficient = fromBalance !== null && tokenSellNum > fromBalance;
  const hasTokens = !!fromToken && !!toToken;
  // In USD mode require a valid price so we can compute the token amount
  const hasAmount =
    rawSellNum > 0 && (amountInputMode === "token" || hasFromUsdPrice);
  const isConnected = walletStatus === "connected" && !!walletAddress;
  const canGetQuote =
    hasTokens &&
    hasAmount &&
    !insufficient &&
    isConnected &&
    (!needsDestAddress || isValidDestAddress);

  // Fall back to token mode when the selected sell token has no USD price.
  // Guard: skip when no token is selected — fromToken=null means hasFromUsdPrice=false
  // even though the token hasn't loaded yet, which would prematurely kill USD mode.
  useEffect(() => {
    if (!fromToken) return;
    if (!hasFromUsdPrice && amountInputMode === "usd") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmountInputMode("token");
    }
  }, [fromToken, hasFromUsdPrice, amountInputMode]);

  // Flash the buy card briefly when auto-refresh brings back a new amount
  useEffect(() => {
    if (displayToAmount === null) {
      prevToAmountRef.current = null;
      return;
    }
    const prev = prevToAmountRef.current;
    prevToAmountRef.current = displayToAmount;
    if (prev === null) return; // first load — don't flash
    const delta = Math.abs(displayToAmount - prev) / Math.max(prev, 1e-9);
    if (delta < 0.0001) return; // < 0.01% change — ignore noise
    setRateUpdated(true);
    const t = setTimeout(() => setRateUpdated(false), 700);
    return () => clearTimeout(t);
  }, [displayToAmount]);

  // Reset dest address whenever the destination chain type changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time reset when the destination chain type switches
    setDestAddress("");
  }, [toChainType]);

  // Keep a stable ref to route.fetch so effects don't need it in deps
  const fetchRef = useRef(route.fetch);
  useEffect(() => {
    fetchRef.current = route.fetch;
  });

  // Auto-fetch: debounced 600ms after any input change, only on home stage
  useEffect(() => {
    if (!canGetQuote || stage !== "home") return;
    if (!fromToken || !fromChain || !toToken || !toChain || !walletAddress)
      return;
    const params = {
      fromToken,
      fromChain,
      toToken,
      toChain,
      amount: tokenAmountStr,
      walletAddress,
      toAddress: needsDestAddress ? destAddress.trim() : walletAddress,
      slippage,
    };
    const t = setTimeout(() => void fetchRef.current(params), 600);
    return () => clearTimeout(t);
  }, [
    canGetQuote,
    stage,
    fromToken,
    fromChain,
    toToken,
    toChain,
    tokenAmountStr,
    walletAddress,
    needsDestAddress,
    destAddress,
    slippage,
  ]);

  // Keep a ref with the latest fetch params so the timer can refetch without stale closures
  useEffect(() => {
    if (
      !canGetQuote ||
      !fromToken ||
      !fromChain ||
      !toToken ||
      !toChain ||
      !walletAddress
    ) {
      latestFetchParamsRef.current = null;
      return;
    }
    latestFetchParamsRef.current = {
      fromToken,
      fromChain,
      toToken,
      toChain,
      amount: tokenAmountStr,
      walletAddress,
      toAddress: needsDestAddress ? destAddress.trim() : walletAddress,
      slippage,
    };
  }, [
    canGetQuote,
    fromToken,
    fromChain,
    toToken,
    toChain,
    tokenAmountStr,
    walletAddress,
    needsDestAddress,
    destAddress,
    slippage,
  ]);

  // Reset countdown when a fresh quote arrives
  useEffect(() => {
    quoteTimestampRef.current = route.data ? Date.now() : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset countdown to 0 when a new quote arrives from the route query
    setQuoteAge(0);
  }, [route.data]);

  // Rotate loading messages while fetching a route
  const msgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!route.loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset message state when loading clears
      setQuoteLoadingMsgIdx(0);
      setQuoteLoadingMsgVisible(true);
      return;
    }
    const id = setInterval(() => {
      setQuoteLoadingMsgVisible(false);
      msgTimeoutRef.current = setTimeout(() => {
        setQuoteLoadingMsgIdx((i) => (i + 1) % QUOTE_LOADING_MESSAGES.length);
        setQuoteLoadingMsgVisible(true);
      }, 280);
    }, 2200);
    return () => {
      clearInterval(id);
      if (msgTimeoutRef.current !== null) clearTimeout(msgTimeoutRef.current);
    };
  }, [route.loading]);

  // Tick down and auto-refetch at QUOTE_TTL — replaces the old 60s interval
  useEffect(() => {
    if (!route.data) return;
    const id = setInterval(() => {
      const ts = quoteTimestampRef.current;
      if (ts === null) return;
      const elapsed = Math.floor((Date.now() - ts) / 1000);
      const age = Math.min(elapsed, QUOTE_TTL);
      setQuoteAge(age);
      if (age >= QUOTE_TTL && latestFetchParamsRef.current) {
        void fetchRef.current(latestFetchParamsRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [route.data]);

  // Check allowance upfront when entering review so button shows correct label immediately
  useEffect(() => {
    if (stage !== "review") return;
    if (!route.data || !walletAddress) return;
    const fromTokenAddress = fromToken?.address;
    if (!fromTokenAddress) return;
    void execution.checkAllowance({
      fromTokenAddress,
      walletAddress,
      routeResult: route.data,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, route.data, walletAddress, fromToken]);

  // Close settings on outside click
  useEffect(() => {
    if (!showSettings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCurrencyDropdown(false);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSettings]);

  // Close currency dropdown on outside click
  useEffect(() => {
    if (!showCurrencyDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCurrencyDropdown]);

  // ─── Render stages ────────────────────────────────────────────────────────────

  if (stage === "select-from") {
    return (
      <WidgetContainer theme={resolvedTheme} style={style}>
        <SwapTokenSelect
          side="from"
          selectedChain={fromChain}
          walletAddress={walletAddress}
          yourWalletTokens={yourWalletTokens}
          onSelect={handleSelectFromToken}
          onBack={() => setStage("home")}
          popularChains={popularChains}
          otherChains={otherChains}
          chainsLoading={chainsLoading}
          chainsError={chainsError}
          excludeToken={toToken ?? null}
        />
      </WidgetContainer>
    );
  }

  if (stage === "select-to" && !lockDestToken) {
    return (
      <WidgetContainer theme={resolvedTheme} style={style}>
        <SwapTokenSelect
          side="to"
          selectedChain={toChain}
          walletAddress={null}
          yourWalletTokens={[]}
          onSelect={handleSelectToToken}
          onBack={() => setStage("home")}
          popularChains={toPopularChains}
          otherChains={toOtherChains}
          chainsLoading={chainsLoading}
          chainsError={chainsError}
          allowedTokens={allowedDestTokens ?? undefined}
          excludeToken={fromToken ?? null}
        />
      </WidgetContainer>
    );
  }

  if (stage === "connect-wallet") {
    return (
      <WidgetContainer theme={resolvedTheme} style={style}>
        <SwapWalletSelector
          walletStatus={walletStatus}
          walletAddress={walletAddress}
          connectWallet={connectWallet}
          onBack={handleWalletConnected}
        />
        {/* Show "Done" once connected */}
        {isConnected && (
          <div style={{ padding: `0 ${spacing[4]} ${spacing[4]}` }}>
            <button
              onClick={() => setStage("home")}
              style={{
                width: "100%",
                padding: `${spacing[3]} 0`,
                borderRadius: borderRadius["2xl"],
                backgroundColor: colors.primary,
                color: colors.primaryForeground,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                border: 0,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          </div>
        )}
      </WidgetContainer>
    );
  }

  if (stage === "processing") {
    const txStatus = execution.txStatus;
    const progress = getProgressFromStatus(txStatus);
    const activeStep = getActiveStep(txStatus);
    const fromChainTxUrl = execution.pollingTx?.fromChainTxUrl ?? null;
    const txHash = execution.txHash;

    // SVG ring math
    const ringSize = 196;
    const ringStroke = 10;
    const r = (ringSize - ringStroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (progress / 100) * circ;

    const isApproving = txStatus === "approving";
    const title = isApproving ? "Approving..." : "Order Submitted";

    return (
      <WidgetContainer theme={resolvedTheme} style={style}>
        <div style={{ padding: `${spacing[5]} ${spacing[6]} ${spacing[6]}` }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing[5],
            }}
          >
            <button
              onClick={handleReset}
              style={{
                width: "2.25rem",
                height: "2.25rem",
                borderRadius: "9999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5m7-7-7 7 7 7" />
              </svg>
            </button>
            <button
              onClick={handleReset}
              style={{
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
                backgroundColor: "transparent",
                border: 0,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>

          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: fontWeight.bold,
              color: colors.foreground,
              marginBottom: spacing[5],
            }}
          >
            {title}
          </h1>

          {/* Progress card */}
          <div
            style={{
              backgroundColor: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius["2xl"],
              padding: spacing[6],
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: spacing[5],
            }}
          >
            {/* SVG ring */}
            <div
              style={{
                position: "relative",
                width: ringSize,
                height: ringSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width={ringSize}
                height={ringSize}
                style={{ position: "absolute", inset: 0 }}
              >
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={r}
                  fill="none"
                  stroke="hsl(var(--tw-muted))"
                  strokeWidth={ringStroke}
                />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={r}
                  fill="none"
                  stroke={`hsl(var(--tw-primary))`}
                  strokeWidth={ringStroke}
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  style={{ transition: "stroke-dashoffset 200ms linear" }}
                />
              </svg>
              {/* Center content */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.375rem",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.625rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: colors.mutedForeground,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {isApproving ? "Approving" : "Swapping"}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing[1.5],
                  }}
                >
                  {fromToken?.iconUrl ? (
                    <img
                      src={fromToken.iconUrl}
                      style={{
                        width: "1.75rem",
                        height: "1.75rem",
                        borderRadius: "9999px",
                      }}
                      alt=""
                    />
                  ) : (
                    <div
                      style={{
                        width: "1.75rem",
                        height: "1.75rem",
                        borderRadius: "9999px",
                        backgroundColor: colors.muted,
                      }}
                    />
                  )}
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
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14m-7-7 7 7-7 7" />
                  </svg>
                  {toToken?.iconUrl ? (
                    <img
                      src={toToken.iconUrl}
                      style={{
                        width: "1.75rem",
                        height: "1.75rem",
                        borderRadius: "9999px",
                      }}
                      alt=""
                    />
                  ) : (
                    <div
                      style={{
                        width: "1.75rem",
                        height: "1.75rem",
                        borderRadius: "9999px",
                        backgroundColor: colors.muted,
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: colors.foreground,
                    lineHeight: 1.3,
                  }}
                >
                  {fromToken?.symbol}{" "}
                  <span
                    style={{
                      color: colors.mutedForeground,
                      fontWeight: fontWeight.normal,
                    }}
                  >
                    to
                  </span>{" "}
                  {toToken?.symbol}
                </span>
                <span
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.bold,
                    color: colors.foreground,
                  }}
                >
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            {/* Step tracker */}
            <div
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <ProcessingStepNode
                active={activeStep >= 0}
                done={activeStep > 0}
                icon="send"
                label={`Sending ${fromToken?.symbol ?? ""}`}
              />
              <ProcessingStepLine done={activeStep > 0} />
              <ProcessingStepNode
                active={activeStep >= 1}
                done={activeStep > 1}
                icon="plus"
                label="Create Order"
              />
              <ProcessingStepLine done={activeStep > 1} />
              <ProcessingStepNode
                active={activeStep >= 2}
                done={activeStep >= 3}
                icon="flag"
                label={`Receive ${toToken?.symbol ?? ""}`}
              />
            </div>

            {/* View transaction link */}
            {txHash &&
              (() => {
                const explorerUrl = buildExplorerUrl(
                  txHash,
                  fromChain,
                  fromChainTxUrl
                );
                const isCopied = copiedHash === txHash;
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[3],
                    }}
                  >
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: colors.foreground,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          textDecorationLine: "underline",
                          textDecorationStyle: "dotted",
                          textUnderlineOffset: "4px",
                        }}
                      >
                        View transaction
                        <svg
                          style={{ width: "0.875rem", height: "0.875rem" }}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => handleCopyHash(txHash)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: fontSize.sm,
                        color: isCopied
                          ? colors.green[500]
                          : colors.mutedForeground,
                        backgroundColor: "transparent",
                        border: 0,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        padding: 0,
                        transition: "color 0.15s",
                      }}
                    >
                      {isCopied ? (
                        "Copied!"
                      ) : (
                        <>
                          {txHash.slice(0, 6)}…{txHash.slice(-4)}
                          <svg
                            style={{ width: "0.875rem", height: "0.875rem" }}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="13"
                              height="13"
                              rx="2"
                              ry="2"
                            />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
          </div>
        </div>
      </WidgetContainer>
    );
  }

  if (stage === "success") {
    const fromChainTxUrl = execution.pollingTx?.fromChainTxUrl ?? null;
    const toChainTxUrl = execution.pollingTx?.toChainTxUrl ?? null;
    // Prefer backend's confirmed source hash; fall back to URL extraction, then submitted hash
    const sourceTxHash =
      execution.pollingTx?.sourceTxHash ||
      (fromChainTxUrl ? hashFromExplorerUrl(fromChainTxUrl) : "") ||
      execution.txHash ||
      "";
    // Destination hash: direct field or extracted from URL (cross-chain bridges often only return URLs)
    const destTxHash =
      execution.pollingTx?.destTxHash ||
      (toChainTxUrl ? hashFromExplorerUrl(toChainTxUrl) : "") ||
      "";
    const txHash = sourceTxHash;
    const finalToAmount = toAmount ?? displayToAmount;
    const effectiveRate =
      finalToAmount !== null && tokenSellNum > 0
        ? `1 ${fromToken?.symbol} = ${fmtAmount(finalToAmount / tokenSellNum, 4)} ${toToken?.symbol}`
        : exchangeRate !== null
          ? `1 ${fromToken?.symbol} = ${fmtAmount(1 / exchangeRate, 4)} ${toToken?.symbol}`
          : null;
    const completedStr =
      completedAt?.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }) ?? null;

    return (
      <WidgetContainer theme={resolvedTheme} style={style}>
        <div style={{ position: "relative", overflow: "hidden" }}>
          <Suspense fallback={null}>
            <ConfettiEffect isActive pieceCount={60} clearDelay={4000} />
          </Suspense>

          <div style={{ padding: `${spacing[6]} ${spacing[6]} 0` }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[3],
                marginBottom: spacing[5],
              }}
            >
              <div
                style={{
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "9999px",
                  border: `3px solid ${colors.green[500]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  style={{
                    width: "1.25rem",
                    height: "1.25rem",
                    color: colors.green[500],
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2
                style={{
                  fontSize: fontSize["2xl"],
                  fontWeight: fontWeight.bold,
                  color: colors.foreground,
                }}
              >
                Transaction completed!
              </h2>
            </div>

            {/* Receipt card */}
            <div
              style={{
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius["2xl"],
                padding: spacing[5],
              }}
            >
              {/* Sold / received rows */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: fontSize.sm,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing[2],
                  }}
                >
                  {fromToken?.iconUrl && (
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img
                        src={fromToken.iconUrl}
                        alt=""
                        style={{
                          width: "1.375rem",
                          height: "1.375rem",
                          borderRadius: "9999px",
                        }}
                      />
                      {fromChain?.chainIconURI && (
                        <img
                          src={fromChain.chainIconURI}
                          alt=""
                          style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: "0.625rem",
                            height: "0.625rem",
                            borderRadius: "9999px",
                            border: `1.5px solid ${colors.background}`,
                            objectFit: "cover",
                          }}
                        />
                      )}
                    </div>
                  )}
                  <span style={{ color: colors.mutedForeground }}>
                    You sold
                  </span>
                </div>
                <span
                  style={{
                    fontWeight: fontWeight.semibold,
                    color: colors.foreground,
                  }}
                >
                  {fmtAmount(tokenSellNum, 4)} {fromToken?.symbol}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: fontSize.sm,
                  marginTop: spacing[3],
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing[2],
                  }}
                >
                  {toToken?.iconUrl && (
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img
                        src={toToken.iconUrl}
                        alt=""
                        style={{
                          width: "1.375rem",
                          height: "1.375rem",
                          borderRadius: "9999px",
                        }}
                      />
                      {toChain?.chainIconURI && (
                        <img
                          src={toChain.chainIconURI}
                          alt=""
                          style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: "0.625rem",
                            height: "0.625rem",
                            borderRadius: "9999px",
                            border: `1.5px solid ${colors.background}`,
                            objectFit: "cover",
                          }}
                        />
                      )}
                    </div>
                  )}
                  <span style={{ color: colors.mutedForeground }}>
                    Received
                  </span>
                </div>
                <span
                  style={{
                    fontWeight: fontWeight.semibold,
                    color: colors.foreground,
                  }}
                >
                  {finalToAmount !== null ? fmtAmount(finalToAmount, 4) : "—"}{" "}
                  {toToken?.symbol}
                </span>
              </div>

              <div
                style={{
                  height: "1px",
                  backgroundColor: colors.border,
                  margin: `${spacing[4]} 0`,
                }}
              />

              {/* Detail rows */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[2.5],
                  fontSize: fontSize.sm,
                }}
              >
                {fromUsd > 0 && (
                  <SuccessReceiptRow
                    label="Value sold"
                    value={fmtLocal(fromUsd)}
                  />
                )}
                {toUsd > 0 && (
                  <SuccessReceiptRow
                    label="Value received"
                    value={fmtLocal(toUsd)}
                  />
                )}
                {effectiveRate && (
                  <SuccessReceiptRow
                    label="Effective rate"
                    value={effectiveRate}
                  />
                )}

                {completedStr && (
                  <SuccessReceiptRow label="Completed" value={completedStr} />
                )}
                {/* Source chain tx */}
                {txHash &&
                  (() => {
                    const srcUrl = buildExplorerUrl(
                      txHash,
                      fromChain,
                      fromChainTxUrl
                    );
                    const isCopied = copiedHash === txHash;
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: colors.mutedForeground }}>
                          {destTxHash ? "Source tx" : "Transaction"}
                        </span>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: spacing[2],
                          }}
                        >
                          {srcUrl && (
                            <a
                              href={srcUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                color: colors.foreground,
                                fontWeight: fontWeight.medium,
                                textDecorationLine: "underline",
                                textDecorationStyle: "dotted",
                                textUnderlineOffset: "4px",
                              }}
                            >
                              {txHash.slice(0, 6)}…{txHash.slice(-4)}
                              <svg
                                style={{ width: "0.75rem", height: "0.75rem" }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => handleCopyHash(txHash)}
                            title="Copy full hash"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.2rem",
                              fontSize: fontSize.xs,
                              color: isCopied
                                ? colors.green[500]
                                : colors.mutedForeground,
                              backgroundColor: "transparent",
                              border: 0,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              padding: 0,
                              transition: "color 0.15s",
                            }}
                          >
                            {isCopied ? (
                              "Copied!"
                            ) : (
                              <svg
                                style={{
                                  width: "0.875rem",
                                  height: "0.875rem",
                                }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                {/* Destination chain tx (cross-chain bridges) */}
                {destTxHash &&
                  (() => {
                    const destUrl = buildExplorerUrl(
                      destTxHash,
                      toChain,
                      toChainTxUrl
                    );
                    const isCopied = copiedHash === destTxHash;
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: colors.mutedForeground }}>
                          Destination tx
                        </span>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: spacing[2],
                          }}
                        >
                          {destUrl && (
                            <a
                              href={destUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                color: colors.foreground,
                                fontWeight: fontWeight.medium,
                                textDecorationLine: "underline",
                                textDecorationStyle: "dotted",
                                textUnderlineOffset: "4px",
                              }}
                            >
                              {destTxHash.slice(0, 6)}…{destTxHash.slice(-4)}
                              <svg
                                style={{ width: "0.75rem", height: "0.75rem" }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => handleCopyHash(destTxHash)}
                            title="Copy full hash"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              fontSize: fontSize.xs,
                              color: isCopied
                                ? colors.green[500]
                                : colors.mutedForeground,
                              backgroundColor: "transparent",
                              border: 0,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              padding: 0,
                              transition: "color 0.15s",
                            }}
                          >
                            {isCopied ? (
                              "Copied!"
                            ) : (
                              <svg
                                style={{
                                  width: "0.875rem",
                                  height: "0.875rem",
                                }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: `${spacing[5]} ${spacing[6]} ${spacing[6]}`,
              display: "flex",
              flexDirection: "column",
              gap: spacing[2],
            }}
          >
            <button
              onClick={handleReset}
              style={{
                width: "100%",
                height: "3.5rem",
                borderRadius: borderRadius["2xl"],
                backgroundColor: colors.primary,
                color: colors.primaryForeground,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                border: 0,
                cursor: "pointer",
              }}
            >
              Done
            </button>
            {fromToken && toToken && (
              <button
                onClick={handleSwapBack}
                style={{
                  width: "100%",
                  height: "2.5rem",
                  borderRadius: borderRadius["2xl"],
                  backgroundColor: "transparent",
                  color: colors.mutedForeground,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  border: `1px solid hsl(var(--tw-border))`,
                  cursor: "pointer",
                }}
              >
                ↩ Swap {toToken.symbol} → {fromToken.symbol}
              </button>
            )}
          </div>
        </div>
      </WidgetContainer>
    );
  }

  if (stage === "error") {
    return (
      <WidgetContainer theme={resolvedTheme} style={style}>
        <ErrorPage
          error={mapError(execution.errorMessage)}
          onTryAgain={() => setStage("review")}
          onStartOver={handleReset}
        />
      </WidgetContainer>
    );
  }

  if (stage === "review") {
    const reviewToAmount = toAmount ?? displayToAmount;
    const reviewToUsd = toUsd > 0 ? toUsd : displayToUsd;

    return (
      <WidgetContainer theme={resolvedTheme} style={style}>
        <div
          style={{
            padding: `${spacing[5]} ${spacing[6]} ${spacing[6]}`,
            maxHeight: "85vh",
            overflowY: "auto",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing[5],
            }}
          >
            <span
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.mutedForeground,
              }}
            >
              You&apos;re swapping
            </span>
            <button
              onClick={() => setStage("home")}
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "9999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sell asset row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "1.75rem",
                  fontWeight: fontWeight.semibold,
                  color: colors.foreground,
                  lineHeight: 1.2,
                }}
              >
                {fmtAmount(tokenSellNum, 5)} {fromToken?.symbol}
              </p>
              <p
                style={{
                  fontSize: fontSize.sm,
                  color: colors.mutedForeground,
                  marginTop: "0.125rem",
                }}
              >
                {fmtLocal(fromUsd)}
              </p>
            </div>
            {fromToken?.iconUrl && (
              <TokenIcon
                icon={fromToken.iconUrl}
                chainIcon={fromChain?.chainIconURI}
                size="lg"
              />
            )}
          </div>

          {/* Arrow */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              margin: `${spacing[3]} 0`,
            }}
          >
            <svg
              style={{
                width: "1rem",
                height: "1rem",
                color: colors.mutedForeground,
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14m-7-7l7 7 7-7" />
            </svg>
          </div>

          {/* Buy asset row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "1.75rem",
                  fontWeight: fontWeight.semibold,
                  color: colors.foreground,
                  lineHeight: 1.2,
                }}
              >
                {reviewToAmount !== null ? fmtAmount(reviewToAmount, 5) : "—"}{" "}
                {toToken?.symbol}
              </p>
              <p
                style={{
                  fontSize: fontSize.sm,
                  color: colors.mutedForeground,
                  marginTop: "0.125rem",
                }}
              >
                {fmtLocal(reviewToUsd)}
              </p>
            </div>
            {toToken?.iconUrl && (
              <TokenIcon
                icon={toToken.iconUrl}
                chainIcon={toChain?.chainIconURI}
                size="lg"
              />
            )}
          </div>

          {/* Collapsible details toggle */}
          <button
            onClick={() => setShowReviewDetails((v) => !v)}
            style={{
              margin: `${spacing[5]} 0`,
              display: "flex",
              alignItems: "center",
              gap: spacing[2],
              width: "100%",
              background: "none",
              border: 0,
              cursor: "pointer",
              color: colors.mutedForeground,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              padding: 0,
            }}
          >
            <div
              style={{ flex: 1, height: "1px", backgroundColor: colors.border }}
            />
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: `0 ${spacing[2]}`,
                whiteSpace: "nowrap",
              }}
            >
              {showReviewDetails ? "Hide details" : "View details"}
              <svg
                style={{
                  width: "0.875rem",
                  height: "0.875rem",
                  transform: showReviewDetails ? "rotate(180deg)" : undefined,
                  transition: "transform 0.2s",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              {route.data && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  style={{
                    transform: "rotate(-90deg)",
                    flexShrink: 0,
                    opacity: 0.75,
                    marginLeft: "0.125rem",
                  }}
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5"
                    fill="none"
                    stroke="hsl(var(--tw-border))"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="7"
                    cy="7"
                    r="5"
                    fill="none"
                    stroke={
                      quoteAge >= QUOTE_TTL - 10
                        ? colors.destructive
                        : colors.primary
                    }
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="31.416"
                    strokeDashoffset={31.416 * (quoteAge / QUOTE_TTL)}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
              )}
            </span>
            <div
              style={{ flex: 1, height: "1px", backgroundColor: colors.border }}
            />
          </button>

          {/* Detail rows — collapsible */}
          {showReviewDetails && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing[3],
                fontSize: fontSize.sm,
                marginBottom: spacing[2],
              }}
            >
              {exchangeRate !== null && (
                <ReviewDetailRow
                  label="Rate"
                  tooltip="Current exchange rate between the two tokens"
                  value={`1 ${fromToken?.symbol} = ${fmtAmount(1 / (exchangeRate ?? 1), 4)} ${toToken?.symbol} ($${fmtAmount(fromTokenPriceUSD, 2)})`}
                />
              )}
              <ReviewDetailRow
                label="Fee"
                tooltip="Protocol fee charged by the bridge or DEX"
                value={
                  protocolFeeUsd !== null ? fmtLocal(protocolFeeUsd) : "Free"
                }
              />
              <ReviewDetailRow
                label="Network cost"
                tooltip="Estimated gas fee paid to the blockchain network"
                value={
                  isGasSponsored ? (
                    <SponsoredBadge />
                  ) : networkCostUsd !== null ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <GasIcon size="0.875rem" />
                      {fmtLocal(networkCostUsd)}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <ReviewDetailRow
                label="Max slippage"
                tooltip="Max price movement allowed before the swap automatically reverts"
                value={`${slippage}%`}
              />
              {(routePath || route.data?.route?.provider) && (
                <ReviewDetailRow
                  label="Route"
                  tooltip="Protocol or bridge used to execute your swap"
                  value={
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "200px",
                        display: "inline-block",
                        verticalAlign: "bottom",
                      }}
                      title={routePath ?? route.data?.route?.provider}
                    >
                      {routePath ?? route.data?.route?.provider}
                    </span>
                  }
                />
              )}
            </div>
          )}

          {/* ── Action area — structured for future additions ── */}
          <SwapActionArea
            fromTokenSymbol={fromToken?.symbol ?? ""}
            allowanceStatus={execution.allowanceStatus}
            txStatus={execution.txStatus}
            isSubmitting={execution.isSubmitting}
            isGasSponsored={isGasSponsored}
            onExecute={() => void handleExecute()}
          />
        </div>
      </WidgetContainer>
    );
  }

  // ─── Home ─────────────────────────────────────────────────────────────────────
  const ctaLabel = !hasTokens
    ? "Get started"
    : !hasAmount
      ? "Enter an amount"
      : insufficient
        ? `Insufficient ${fromToken?.symbol} balance`
        : !isConnected
          ? "Connect Wallet"
          : needsDestAddress && !isValidDestAddress
            ? `Enter ${toChain?.networkName ?? "destination"} address`
            : route.loading
              ? "Getting quote..."
              : "Review";

  const ctaDisabled =
    !hasTokens ||
    !hasAmount ||
    insufficient ||
    (isConnected && needsDestAddress && !isValidDestAddress) ||
    route.loading;
  const ctaAction = !isConnected
    ? handleConnectAndReview
    : () => void handleReview();

  const showRateRow = hasTokens && exchangeRate !== null;

  return (
    <WidgetContainer theme={resolvedTheme} style={style}>
      <div
        style={{ display: "flex", flexDirection: "column", minHeight: "500px" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${spacing[4]} ${spacing[5]}`,
            marginBottom: spacing[1],
          }}
        >
          <span
            style={{
              padding: `${spacing[1.5]} ${spacing[3]}`,
              borderRadius: "9999px",
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              backgroundColor: "hsl(var(--tw-muted))",
              color: colors.foreground,
            }}
          >
            Swap
          </span>

          {/* Right side: wallet + settings gear */}
          <div
            ref={settingsRef}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[2],
              position: "relative",
            }}
          >
            {walletAddress ? (
              <button
                onClick={() => void disconnectWallet()}
                style={{
                  fontSize: fontSize.xs,
                  color: colors.mutedForeground,
                  backgroundColor: "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} ×
              </button>
            ) : (
              <button
                onClick={handleConnectAndReview}
                style={{
                  fontSize: fontSize.xs,
                  color: colors.primary,
                  backgroundColor: "transparent",
                  border: 0,
                  cursor: "pointer",
                  fontWeight: fontWeight.medium,
                }}
              >
                Connect wallet
              </button>
            )}

            {/* Settings gear */}
            <button
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Settings"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1.75rem",
                height: "1.75rem",
                borderRadius: "9999px",
                backgroundColor: showSettings
                  ? "hsl(var(--tw-muted))"
                  : "transparent",
                border: 0,
                cursor: "pointer",
                color: colors.mutedForeground,
                padding: 0,
              }}
            >
              <svg
                style={{ width: "1rem", height: "1rem" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {/* Settings popover */}
            {showSettings && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 0.5rem)",
                  right: 0,
                  width: "20rem",
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius["2xl"],
                  padding: spacing[4],
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  zIndex: 100,
                }}
              >
                {/* Appearance */}
                <p
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: colors.mutedForeground,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: spacing[3],
                  }}
                >
                  Appearance
                </p>
                <div style={{ marginBottom: spacing[4] }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: colors.foreground,
                        }}
                      >
                        Dark mode
                      </p>
                      <p
                        style={{
                          fontSize: "0.625rem",
                          color: colors.mutedForeground,
                          marginTop: "2px",
                        }}
                      >
                        {resolvedTheme === "dark"
                          ? "Dark theme active"
                          : "Light theme active"}
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={resolvedTheme === "dark"}
                      onClick={toggleTheme}
                      style={{
                        width: "2.5rem",
                        height: "1.375rem",
                        borderRadius: "9999px",
                        backgroundColor:
                          resolvedTheme === "dark"
                            ? colors.primary
                            : colors.muted,
                        border: 0,
                        cursor: "pointer",
                        position: "relative",
                        transition: "background-color 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "0.1875rem",
                          left:
                            resolvedTheme === "dark"
                              ? "calc(100% - 1rem - 0.1875rem)"
                              : "0.1875rem",
                          width: "1rem",
                          height: "1rem",
                          borderRadius: "9999px",
                          backgroundColor: colors.primaryForeground,
                          transition: "left 0.2s",
                          display: "block",
                        }}
                      />
                    </button>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: colors.mutedForeground,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: spacing[3],
                  }}
                >
                  Transaction Settings
                </p>

                {/* Slippage */}
                <div style={{ marginBottom: spacing[4] }}>
                  <p
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: colors.foreground,
                      marginBottom: spacing[2],
                    }}
                  >
                    Max slippage
                  </p>
                  <div style={{ display: "flex", gap: spacing[1.5] }}>
                    {[0.1, 0.5, 1.0].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setSlippage(v);
                          setSlippageInput("");
                        }}
                        style={{
                          flex: 1,
                          padding: `${spacing[1.5]} 0`,
                          borderRadius: borderRadius.lg,
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.semibold,
                          border: `1px solid ${slippage === v && !slippageInput ? colors.primary : colors.border}`,
                          backgroundColor:
                            slippage === v && !slippageInput
                              ? "rgba(59,130,246,0.08)"
                              : "transparent",
                          color:
                            slippage === v && !slippageInput
                              ? colors.primary
                              : colors.mutedForeground,
                          cursor: "pointer",
                        }}
                      >
                        {v}%
                      </button>
                    ))}
                    <div style={{ flex: 1.5, position: "relative" }}>
                      <input
                        type="number"
                        min="0.01"
                        max="50"
                        step="0.1"
                        placeholder="Custom"
                        value={slippageInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSlippageInput(v);
                          const n = parseFloat(v);
                          if (Number.isFinite(n) && n > 0 && n <= 50)
                            setSlippage(n);
                        }}
                        style={{
                          width: "100%",
                          padding: `${spacing[1.5]} ${spacing[2]}`,
                          borderRadius: borderRadius.lg,
                          fontSize: fontSize.xs,
                          border: `1px solid ${slippageInput ? colors.primary : colors.border}`,
                          backgroundColor: "transparent",
                          color: colors.foreground,
                          outline: "none",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                  </div>
                  {slippage > 5 && (
                    <p
                      style={{
                        fontSize: "0.625rem",
                        color: "hsl(45 100% 51%)",
                        marginTop: spacing[1],
                      }}
                    >
                      High slippage — may result in a bad trade
                    </p>
                  )}
                </div>

                {/* Max approval toggle */}
                <div style={{ marginBottom: spacing[4] }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: colors.foreground,
                        }}
                      >
                        Max approval
                      </p>
                      <p
                        style={{
                          fontSize: "0.625rem",
                          color: colors.mutedForeground,
                          marginTop: "2px",
                        }}
                      >
                        Approve unlimited spend (saves gas on repeat swaps)
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={maxApproval}
                      onClick={() => setMaxApproval((v) => !v)}
                      style={{
                        width: "2.5rem",
                        height: "1.375rem",
                        borderRadius: "9999px",
                        backgroundColor: maxApproval
                          ? colors.primary
                          : colors.muted,
                        border: 0,
                        cursor: "pointer",
                        position: "relative",
                        transition: "background-color 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "0.1875rem",
                          left: maxApproval
                            ? "calc(100% - 1rem - 0.1875rem)"
                            : "0.1875rem",
                          width: "1rem",
                          height: "1rem",
                          borderRadius: "9999px",
                          backgroundColor: colors.primaryForeground,
                          transition: "left 0.2s",
                          display: "block",
                        }}
                      />
                    </button>
                  </div>
                </div>

                {/* Display currency */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing[3],
                  }}
                >
                  <p
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: colors.foreground,
                      flexShrink: 0,
                    }}
                  >
                    Display currency
                  </p>
                  <div
                    ref={currencyDropdownRef}
                    style={{ position: "relative", flexShrink: 0 }}
                  >
                    {/* Trigger */}
                    <button
                      onClick={() => setShowCurrencyDropdown((v) => !v)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: spacing[1],
                        padding: `${spacing[1]} ${spacing[2]}`,
                        borderRadius: borderRadius.lg,
                        border: `1px solid ${showCurrencyDropdown ? colors.primary : colors.border}`,
                        backgroundColor: showCurrencyDropdown
                          ? "rgba(59,130,246,0.08)"
                          : colors.muted,
                        color: colors.foreground,
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.semibold,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{currencySymbol}</span>
                      <span>{selectedCurrency}</span>
                      <svg
                        style={{
                          width: "0.625rem",
                          height: "0.625rem",
                          color: colors.mutedForeground,
                          transform: showCurrencyDropdown
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.15s ease",
                        }}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {/* Dropdown panel */}
                    {showCurrencyDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 0.375rem)",
                          right: 0,
                          width: "12rem",
                          maxHeight: "11rem",
                          overflowY: "auto",
                          backgroundColor: colors.card,
                          border: `1px solid ${colors.border}`,
                          borderRadius: borderRadius.xl,
                          boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
                          zIndex: 200,
                          padding: `${spacing[1]} 0`,
                        }}
                      >
                        {SUPPORTED_CURRENCIES.map((c) => {
                          const isSelected = selectedCurrency === c.code;
                          return (
                            <button
                              key={c.code}
                              onClick={() => {
                                handleCurrencyChange(c.code);
                                setShowCurrencyDropdown(false);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: spacing[2],
                                width: "100%",
                                padding: `${spacing[1.5]} ${spacing[3]}`,
                                backgroundColor: isSelected
                                  ? "rgba(59,130,246,0.08)"
                                  : "transparent",
                                color: isSelected
                                  ? colors.primary
                                  : colors.foreground,
                                fontSize: fontSize.xs,
                                fontWeight: isSelected
                                  ? fontWeight.semibold
                                  : fontWeight.normal,
                                border: 0,
                                cursor: "pointer",
                                textAlign: "left",
                                fontFamily: "inherit",
                              }}
                            >
                              <span
                                style={{
                                  flexShrink: 0,
                                  width: "1.25rem",
                                  textAlign: "left",
                                }}
                              >
                                {c.symbol}
                              </span>
                              <span style={{ flexShrink: 0 }}>{c.code}</span>
                              <span
                                style={{
                                  color: colors.mutedForeground,
                                  fontSize: "0.625rem",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {c.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sell card */}
        <div style={{ padding: `0 ${spacing[3]}` }}>
          <div
            onMouseEnter={() => setHoverSell(true)}
            onMouseLeave={() => setHoverSell(false)}
            style={{
              borderRadius: "1.5rem",
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.card,
              padding: `${spacing[4]} ${spacing[5]} ${spacing[5]}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing[1],
              }}
            >
              <span
                style={{
                  fontSize: fontSize.sm,
                  color: colors.mutedForeground,
                  fontWeight: fontWeight.medium,
                }}
              >
                Sell
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[1.5],
                  opacity: hoverSell && fromBalance !== null ? 1 : 0,
                  transition: "opacity 0.2s",
                  pointerEvents:
                    hoverSell && fromBalance !== null ? "auto" : "none",
                }}
              >
                {PERCENT_OPTIONS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      if (fromBalance === null) return;
                      const decimals = fromToken?.decimals ?? 18;
                      const isNative =
                        !!fromToken &&
                        (isNativeTokenAddress(
                          fromToken.address,
                          fromChainType ?? ""
                        ) ||
                          isZeroAddrLike(fromToken.address, fromChainType));
                      // Compute spendable amount — leave a fee reserve for gas tokens
                      // SOL: fixed 0.01 SOL (fees + rent-exempt buffer; % is unsafe at low balances)
                      // EVM native: 0.5% (ETH fees are variable so % is appropriate)
                      const isSolana =
                        normalizeChainType(fromChain) === "solana";
                      const effectiveAmount = (() => {
                        if (!isNative || p.value !== 1)
                          return fromBalance * p.value;
                        if (isSolana) return Math.max(0, fromBalance - 0.01);
                        return fromBalance * 0.995;
                      })();
                      if (amountInputMode === "usd" && hasFromUsdPrice) {
                        const fiatVal =
                          effectiveAmount * fromTokenPriceUSD * currencyRate;
                        // Enough decimal places so the value is never rounded to 0
                        // and no balance is left stranded by floor-truncation.
                        const dp =
                          fiatVal > 0
                            ? Math.min(
                                8,
                                Math.max(
                                  currencyMeta.decimals,
                                  Math.ceil(-Math.log10(fiatVal)) + 2
                                )
                              )
                            : currencyMeta.decimals;
                        setAmount(truncateDecimal(fiatVal, dp));
                      } else {
                        setAmount(
                          truncateDecimal(
                            effectiveAmount,
                            Math.min(decimals, 6)
                          )
                        );
                      }
                      route.clear();
                    }}
                    style={{
                      padding: `${spacing[0.5]} ${spacing[2.5]}`,
                      borderRadius: "9999px",
                      backgroundColor: "rgba(59,130,246,0.1)",
                      color: colors.primary,
                      fontSize: "0.6875rem",
                      fontWeight: fontWeight.semibold,
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: spacing[3] }}
            >
              {amountInputMode === "usd" && (
                <span
                  style={{
                    fontSize: scaleFontSize(amount || "0"),
                    fontWeight: fontWeight.medium,
                    letterSpacing: "-0.02em",
                    color: amount
                      ? colors.foreground
                      : `${colors.mutedForeground}80`,
                    transition: "font-size 0.15s ease",
                    flexShrink: 0,
                    userSelect: "none",
                  }}
                >
                  {currencySymbol}
                </span>
              )}
              <input
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  setAmount(v);
                  route.clear();
                }}
                style={{
                  flex: 1,
                  background: "transparent",
                  outline: "none",
                  border: "none",
                  fontSize: scaleFontSize(amount || "0"),
                  fontWeight: fontWeight.medium,
                  letterSpacing: "-0.02em",
                  color: amount
                    ? colors.foreground
                    : `${colors.mutedForeground}80`,
                  minWidth: 0,
                  fontFamily: "inherit",
                  transition: "font-size 0.15s ease",
                }}
              />
              {amountInputMode === "token" && fromToken && (
                <span
                  style={{
                    fontSize: scaleFontSize(amount || "0"),
                    fontWeight: fontWeight.medium,
                    letterSpacing: "-0.02em",
                    color: amount
                      ? colors.foreground
                      : `${colors.mutedForeground}80`,
                    transition: "font-size 0.15s ease",
                    flexShrink: 0,
                    userSelect: "none",
                  }}
                >
                  {fromToken.symbol}
                </span>
              )}
              <TokenPillButton
                token={fromToken}
                chain={fromChain}
                placeholder="Select"
                onClick={() => setStage("select-from")}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: spacing[2],
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
              }}
            >
              {/* Denomination toggle: shows converted value and swap-arrows icon */}
              <button
                type="button"
                onClick={handleToggleDenom}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  backgroundColor: "transparent",
                  border: 0,
                  cursor: hasFromUsdPrice ? "pointer" : "default",
                  color: colors.mutedForeground,
                  fontSize: fontSize.sm,
                  padding: 0,
                  fontFamily: "inherit",
                }}
              >
                <span>
                  {amountInputMode === "usd"
                    ? fromToken
                      ? `${fmtAmount(tokenSellNum, 5)} ${fromToken.symbol}`
                      : "0"
                    : hasFromUsdPrice
                      ? fmtLocal(usdSellNum)
                      : "USD pricing unavailable"}
                </span>
                {hasFromUsdPrice && (
                  <svg
                    style={{ width: "0.75rem", height: "0.75rem" }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                )}
              </button>
              {fromBalance !== null && fromToken && (
                <span>
                  {fmtAmount(fromBalance, 6)} {fromToken.symbol}
                  {balanceUsd !== null && balanceUsd > 0 && (
                    <span> ≈ {fmtLocal(balanceUsd)}</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Flip — floats at the boundary between sell and buy cards */}
        <div style={{ position: "relative", height: 0, zIndex: 10 }}>
          <button
            onClick={handleFlip}
            disabled={lockDestToken}
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%) translateY(-50%)",
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: borderRadius.xl,
              backgroundColor: colors.background,
              border: `4px solid ${colors.background}`,
              boxShadow: `0 0 0 1px ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: lockDestToken ? "default" : "pointer",
              opacity: lockDestToken ? 0.4 : 1,
            }}
          >
            <svg
              style={{
                width: "1rem",
                height: "1rem",
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
                d="M12 5v14m-7-7l7 7 7-7"
              />
            </svg>
          </button>
        </div>

        {/* Buy card — no border, muted surface bg */}
        <div style={{ padding: `0 ${spacing[3]}`, marginTop: spacing[3] }}>
          <div
            style={{
              borderRadius: "1.5rem",
              backgroundColor: "hsl(var(--tw-muted))",
              padding: `${spacing[5]} ${spacing[5]} ${spacing[5]}`,
            }}
          >
            <span
              style={{
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
                fontWeight: fontWeight.medium,
              }}
            >
              Buy
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[3],
                marginTop: spacing[1],
              }}
            >
              <div
                key={rateUpdated ? "flash" : "stable"}
                style={{
                  flex: 1,
                  fontWeight: fontWeight.medium,
                  letterSpacing: "-0.02em",
                  color: colors.foreground,
                  minWidth: 0,
                  animation: rateUpdated
                    ? "tw-fade-in 0.5s ease-out"
                    : undefined,
                }}
              >
                {displayToAmount !== null ? (
                  (() => {
                    const s = `${isEstimate ? "~" : ""}${fmtAmount(displayToAmount, 5)}`;
                    return (
                      <span
                        style={{
                          fontSize: scaleFontSize(s),
                          transition: "font-size 0.15s ease",
                          opacity: route.loading ? 0.5 : 1,
                        }}
                      >
                        {s}
                      </span>
                    );
                  })()
                ) : route.loading ? (
                  <span
                    style={{
                      fontSize: "2.5rem",
                      color: `${colors.mutedForeground}50`,
                      animation: "tw-pulse 2s ease-in-out infinite",
                    }}
                  >
                    …
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "2.5rem",
                      color: `${colors.mutedForeground}50`,
                    }}
                  >
                    0
                  </span>
                )}
              </div>
              <TokenPillButton
                token={toToken}
                chain={toChain}
                placeholder="Select token"
                onClick={() => setStage("select-to")}
                isPrimary={!toToken}
                disabled={lockDestToken}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: spacing[2],
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
              }}
            >
              <span>
                {displayToUsd > 0
                  ? `${isEstimate ? "~" : ""}${fmtLocal(displayToUsd)}`
                  : ""}
              </span>
              {priceImpact !== null && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: fontWeight.medium,
                    padding: "0.1rem 0.35rem",
                    borderRadius: "9999px",
                    backgroundColor:
                      priceImpact > 0.05
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(234,179,8,0.15)",
                    color: priceImpact > 0.05 ? "#f87171" : "#ca8a04",
                  }}
                >
                  -{(priceImpact * 100).toFixed(1)}%
                </span>
              )}
            </div>
            {needsDestAddress && toChain && (
              <div
                style={{
                  marginTop: spacing[3],
                  paddingTop: spacing[3],
                  borderTop: "1px solid hsl(var(--tw-border))",
                }}
              >
                <p
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.mutedForeground,
                    marginBottom: spacing[1],
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {toChain.networkName || "Destination"} receive address
                </p>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={destAddress}
                    onChange={(e) => setDestAddress(e.target.value)}
                    placeholder={`Your ${toChain.networkName || "destination"} address`}
                    spellCheck={false}
                    autoComplete="off"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "transparent",
                      border: `1px solid ${
                        destAddress && !isValidDestAddress
                          ? colors.destructive
                          : "hsl(var(--tw-border))"
                      }`,
                      borderRadius: borderRadius.lg,
                      padding: `${spacing[2]} 3.25rem ${spacing[2]} ${spacing[2]}`,
                      fontSize: "0.7rem",
                      fontFamily: "monospace",
                      color: colors.foreground,
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard
                        .readText()
                        .then((text) => setDestAddress(text.trim()))
                        .catch(() => {
                          /* clipboard access denied */
                        });
                    }}
                    style={{
                      position: "absolute",
                      right: spacing[1],
                      top: "50%",
                      transform: "translateY(-50%)",
                      padding: `${spacing[0.5]} ${spacing[1.5]}`,
                      fontSize: "0.6rem",
                      fontWeight: fontWeight.semibold,
                      color: colors.primary,
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Paste
                  </button>
                </div>
                {destAddress && !isValidDestAddress && (
                  <p
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.destructive,
                      marginTop: spacing[1],
                    }}
                  >
                    Invalid {toChainType} address
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {route.error && !route.loading && (
          <p
            style={{
              fontSize: fontSize.xs,
              color: colors.destructive,
              textAlign: "center",
              marginTop: spacing[2],
              padding: `0 ${spacing[3]}`,
            }}
          >
            {mapError(route.error).message}
          </p>
        )}

        {/* Quote loading indicator */}
        {route.loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[2],
              marginTop: spacing[3],
              padding: `0 ${spacing[3]}`,
            }}
          >
            <svg
              className="tw-animate-spin"
              style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0 }}
              viewBox="0 0 88 88"
            >
              <circle
                cx="44"
                cy="44"
                r="40"
                fill="none"
                stroke="hsl(var(--tw-primary))"
                strokeWidth="10"
                strokeDasharray="80 172"
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
                transition: "opacity 0.25s ease",
                opacity: quoteLoadingMsgVisible ? 1 : 0,
              }}
            >
              {QUOTE_LOADING_MESSAGES[quoteLoadingMsgIdx]}
            </span>
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: `${spacing[2]} ${spacing[3]} 0` }}>
          <button
            disabled={ctaDisabled}
            onClick={ctaAction}
            style={mergeStyles(
              {
                width: "100%",
                height: "3.5rem",
                borderRadius: "1.5rem",
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                border: 0,
                transition: "all 0.2s",
                marginBottom: spacing[3],
              },
              !ctaDisabled
                ? {
                    backgroundColor: colors.primary,
                    color: colors.primaryForeground,
                    cursor: "pointer",
                  }
                : {
                    backgroundColor: "hsl(var(--tw-muted))",
                    color: colors.mutedForeground,
                    cursor: "default",
                  }
            )}
          >
            {ctaLabel}
          </button>
        </div>

        {/* Rate / gas footer — expandable, shown when both tokens selected */}
        {showRateRow && (
          <div
            style={{
              marginTop: spacing[3],
              padding: `0 ${spacing[4]}`,
              fontSize: fontSize.xs,
              color: colors.mutedForeground,
            }}
          >
            <button
              onClick={() => setShowRateDetails((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing[2],
                background: "none",
                border: 0,
                cursor: "pointer",
                color: colors.mutedForeground,
                fontSize: fontSize.xs,
                padding: `${spacing[1]} 0`,
              }}
            >
              {/* Left: rate text */}
              <span style={{ flex: 1, textAlign: "left" }}>
                1 {toToken?.symbol} = {fmtAmount(exchangeRate ?? 0, 4)}{" "}
                {fromToken?.symbol}
              </span>

              {/* Right: gas icon + cost + chevron */}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[1.5],
                  flexShrink: 0,
                }}
              >
                {!isGasSponsored && <GasIcon />}
                <span
                  style={
                    isGasSponsored ? { color: colors.green[500] } : undefined
                  }
                >
                  {isGasSponsored
                    ? "✦ Sponsored"
                    : networkCostUsd !== null
                      ? fmtLocal(networkCostUsd)
                      : "—"}
                </span>
                {/* Quote countdown ring */}
                {route.data && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    style={{
                      transform: "rotate(-90deg)",
                      flexShrink: 0,
                      opacity: 0.75,
                    }}
                  >
                    <circle
                      cx="7"
                      cy="7"
                      r="5"
                      fill="none"
                      stroke="hsl(var(--tw-border))"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="7"
                      cy="7"
                      r="5"
                      fill="none"
                      stroke={
                        quoteAge >= QUOTE_TTL - 10
                          ? colors.destructive
                          : colors.primary
                      }
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeDasharray="31.416"
                      strokeDashoffset={31.416 * (quoteAge / QUOTE_TTL)}
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                )}
                {/* Chevron */}
                <svg
                  style={{
                    width: "0.875rem",
                    height: "0.875rem",
                    transform: showRateDetails
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {showRateDetails && (
              <div
                style={{
                  marginTop: spacing[2],
                  paddingTop: spacing[2],
                  borderTop: `1px solid ${colors.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[2.5],
                }}
              >
                <RateRow
                  label="Fee"
                  value={
                    protocolFeeUsd !== null ? fmtLocal(protocolFeeUsd) : "Free"
                  }
                />
                <RateRow
                  label="Network cost"
                  value={
                    isGasSponsored ? (
                      <SponsoredBadge />
                    ) : networkCostUsd !== null ? (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <GasIcon size="0.75rem" />
                        {fmtLocal(networkCostUsd)}
                      </span>
                    ) : (
                      <span style={{ color: colors.mutedForeground }}>
                        Available after quote
                      </span>
                    )
                  }
                />
                <RateRow label="Max slippage" value={`${slippage}%`} />
                <RateRow
                  label="Route"
                  value={
                    routePath ? (
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "200px",
                          display: "inline-block",
                          verticalAlign: "bottom",
                        }}
                        title={routePath}
                      >
                        {routePath}
                      </span>
                    ) : (
                      (route.data?.route?.provider ?? (
                        <span style={{ color: colors.mutedForeground }}>
                          Available after quote
                        </span>
                      ))
                    )
                  }
                />
              </div>
            )}
          </div>
        )}

        <WidgetSecurityFooter />
      </div>
    </WidgetContainer>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

type SwapActionAreaProps = {
  fromTokenSymbol: string;
  allowanceStatus: import("./hooks/useSwapExecution").AllowanceStatus;
  txStatus: SwapTxStatus;
  isSubmitting: boolean;
  isGasSponsored: boolean;
  onExecute: () => void;
};

function SwapActionArea({
  fromTokenSymbol,
  allowanceStatus,
  txStatus,
  isSubmitting,
  isGasSponsored,
  onExecute,
}: SwapActionAreaProps): React.ReactElement {
  // SA path (sponsored) handles approval via Permit2 inside the UserOp batch —
  // no separate approve step, so we never show "Approve TOKEN" when sponsored.
  const needsApproval = allowanceStatus === "needed" && !isGasSponsored;
  const isChecking = allowanceStatus === "checking";

  let label: string;
  if (isChecking) {
    label = "Checking approval...";
  } else if (txStatus === "approving") {
    label = `Approving ${fromTokenSymbol}...`;
  } else if (isSubmitting) {
    label = "Confirm in wallet...";
  } else if (needsApproval) {
    label = `Approve ${fromTokenSymbol}`;
  } else {
    label = "Swap";
  }

  const isDisabled = isSubmitting || isChecking;

  return (
    <div style={{ marginTop: spacing[6] }}>
      {/*
        ── Future additions slot in here above the button ──
        e.g. Smart wallet info row, Permit2 path indicator, gas sponsorship badge
      */}
      {isGasSponsored && !isSubmitting && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[1.5],
            marginBottom: spacing[3],
          }}
        >
          <svg
            style={{
              width: "0.75rem",
              height: "0.75rem",
              color: colors.green[500],
            }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z" />
          </svg>
          <span
            style={{
              fontSize: fontSize.xs,
              color: colors.green[500],
              fontWeight: fontWeight.medium,
            }}
          >
            Gas sponsored — no network fee
          </span>
        </div>
      )}

      <button
        onClick={onExecute}
        disabled={isDisabled}
        style={mergeStyles(
          {
            width: "100%",
            height: "3.5rem",
            borderRadius: "1.5rem",
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            border: 0,
            cursor: "pointer",
            transition: "opacity 0.2s",
          },
          isDisabled && { opacity: 0.6, cursor: "not-allowed" }
        )}
      >
        {label}
      </button>

      {needsApproval && !isSubmitting && (
        <p
          style={{
            fontSize: fontSize.xs,
            color: colors.mutedForeground,
            textAlign: "center",
            marginTop: spacing[2],
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Approve {fromTokenSymbol} access, then confirm swap — 2 steps.
        </p>
      )}
    </div>
  );
}

function TokenPillButton({
  token,
  chain,
  placeholder,
  onClick,
  isPrimary = false,
  disabled = false,
}: {
  token: Token | YourTokenData | null;
  chain: ChainDef | null;
  placeholder: string;
  onClick: () => void;
  isPrimary?: boolean;
  disabled?: boolean;
}): React.ReactElement {
  const iconUrl = token?.iconUrl ?? (token as Token)?.logoURI;
  const chainIcon = chain?.chainIconURI;

  if (!token) {
    return (
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[1.5],
          padding: `${spacing[2]} ${spacing[4]}`,
          height: "2.5rem",
          borderRadius: "9999px",
          backgroundColor: isPrimary ? colors.primary : colors.card,
          color: isPrimary ? colors.primaryForeground : colors.foreground,
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.sm,
          border: isPrimary ? "none" : `1px solid ${colors.border}`,
          cursor: disabled ? "default" : "pointer",
          whiteSpace: "nowrap",
          opacity: disabled ? 0.7 : 1,
        }}
      >
        {placeholder}
        <svg
          style={{ width: "1rem", height: "1rem" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        paddingLeft: spacing[1],
        paddingRight: spacing[3],
        height: "2.5rem",
        borderRadius: "9999px",
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        opacity: disabled ? 0.85 : 1,
      }}
    >
      <div style={{ position: "relative" }}>
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={token.symbol}
            style={{
              width: "1.75rem",
              height: "1.75rem",
              borderRadius: "9999px",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "1.75rem",
              height: "1.75rem",
              borderRadius: "9999px",
              backgroundColor: colors.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.5rem",
                fontWeight: fontWeight.bold,
                color: colors.mutedForeground,
              }}
            >
              {token.symbol?.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {chainIcon && (
          <img
            src={chainIcon}
            alt=""
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: "0.875rem",
              height: "0.875rem",
              borderRadius: "9999px",
              border: `2px solid ${colors.card}`,
              objectFit: "cover",
            }}
          />
        )}
      </div>
      <span
        style={{
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.sm,
          color: colors.foreground,
        }}
      >
        {token.symbol}
      </span>
      {!disabled && (
        <svg
          style={{
            width: "1rem",
            height: "1rem",
            color: colors.mutedForeground,
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      )}
    </button>
  );
}

function TokenIcon({
  icon,
  chainIcon,
  size = "md",
}: {
  icon: string;
  chainIcon?: string;
  size?: "md" | "lg";
}): React.ReactElement {
  const imgSize = size === "lg" ? "2.75rem" : "2.5rem";
  const badgeSize = size === "lg" ? "1.125rem" : "1rem";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <img
        src={icon}
        alt=""
        style={{ width: imgSize, height: imgSize, borderRadius: "9999px" }}
      />
      {chainIcon && (
        <img
          src={chainIcon}
          alt=""
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: "9999px",
            border: `2px solid ${colors.background}`,
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}

function ReviewDetailRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
}): React.ReactElement {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseEnter = () => {
    if (!tooltip || !iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    setTipPos({ x: r.left + r.width / 2, y: r.top - 8 });
  };

  const handleMouseLeave = () => setTipPos(null);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          color: colors.mutedForeground,
        }}
      >
        {label}
        <span
          ref={iconRef}
          style={{ display: "inline-flex", alignItems: "center" }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            style={{
              width: "0.875rem",
              height: "0.875rem",
              opacity: 0.6,
              cursor: tooltip ? "help" : "default",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </span>
      </span>
      <span style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>
        {value}
      </span>

      {tooltip &&
        tipPos &&
        typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <span
            style={{
              position: "fixed",
              left: tipPos.x,
              top: tipPos.y,
              transform: "translate(-50%, -100%)",
              backgroundColor: "hsl(220 15% 15%)",
              color: "#fff",
              fontSize: "0.6875rem",
              lineHeight: 1.4,
              padding: "0.3rem 0.6rem",
              borderRadius: "0.375rem",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 99999,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            }}
          >
            {tooltip}
          </span>,
          document.body
        )}
    </div>
  );
}

function GasIcon({ size = "0.875rem" }: { size?: string }): React.ReactElement {
  return (
    <svg
      style={{ width: size, height: size, flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 22V7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15" />
      <path d="M3 11h11" />
      <path d="M17 5h1a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V7l-3-3" />
      <path d="M19 22V12" />
    </svg>
  );
}

function SponsoredBadge(): React.ReactElement {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        color: colors.green[500],
        fontWeight: fontWeight.medium,
      }}
    >
      <svg
        style={{ width: "0.75rem", height: "0.75rem" }}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z" />
      </svg>
      Sponsored
    </span>
  );
}

function SuccessReceiptRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ color: colors.mutedForeground }}>{label}</span>
      <span style={{ fontWeight: fontWeight.medium, color: colors.foreground }}>
        {value}
      </span>
    </div>
  );
}

function ProcessingStepNode({
  active,
  done,
  icon,
  label,
}: {
  active: boolean;
  done: boolean;
  icon: "send" | "plus" | "flag";
  label: string;
}): React.ReactElement {
  const nodeColor = done
    ? colors.green[500]
    : active
      ? `hsl(var(--tw-primary))`
      : colors.border;
  const iconColor = done
    ? "#fff"
    : active
      ? `hsl(var(--tw-primary))`
      : colors.mutedForeground;
  const nodeBg = done ? colors.green[500] : "transparent";

  const iconEl =
    icon === "send" ? (
      <svg
        style={{ width: "0.875rem", height: "0.875rem", color: iconColor }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    ) : icon === "plus" ? (
      <svg
        style={{ width: "0.875rem", height: "0.875rem", color: iconColor }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    ) : (
      <svg
        style={{ width: "0.875rem", height: "0.875rem", color: iconColor }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    );

  const doneIcon = (
    <svg
      style={{ width: "0.875rem", height: "0.875rem", color: "#fff" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.375rem",
        maxWidth: "5rem",
      }}
    >
      <div
        style={{
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: "9999px",
          border: `2px solid ${nodeColor}`,
          backgroundColor: nodeBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation:
            active && !done
              ? "tw-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite"
              : undefined,
          transition: "border-color 200ms, background-color 200ms",
        }}
      >
        {done ? doneIcon : iconEl}
      </div>
      <span
        style={{
          fontSize: "0.625rem",
          textAlign: "center",
          color: active ? colors.foreground : colors.mutedForeground,
          fontWeight: active ? fontWeight.medium : fontWeight.normal,
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ProcessingStepLine({ done }: { done: boolean }): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        height: "2px",
        backgroundColor: done ? colors.green[500] : colors.border,
        transition: "background-color 300ms",
        margin: "0 0.25rem",
        marginBottom: "1.25rem",
      }}
    />
  );
}
