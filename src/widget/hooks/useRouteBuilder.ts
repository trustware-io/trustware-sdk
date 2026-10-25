"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrustwareConfigStore } from "../../config/store";
import {
  useDepositForm,
  useDepositTransaction,
  useDepositWallet,
} from "../context/DepositContext";
import type { ChainDef } from "../../types";
import { isEvmTxRequest, isSerializedSolanaTxRequest } from "../../core/routes";
import { buildRouteForReview, type BuiltRoute } from "../../core/signTimeRoute";
import { parseRouteError } from "../../core";
import { mapError } from "../lib/mapError";
import { quoteRefreshIntervalMs } from "../lib/quoteCountdown";

/**
 * Route building state
 */
export type RouteBuilderState = {
  /** Whether a route is currently being fetched */
  isLoadingRoute: boolean;
  /** Network/gas fees for the transaction (in USD) */
  networkFees: string | null;
  /** Estimated amount to receive after fees (in destination token) */
  estimatedReceive: string | null;
  /** Error message if route building failed */
  error: string | null;
  /** The route on review, with the request that built it */
  builtRoute: BuiltRoute | null;
};

const EMPTY_ROUTE_STATE: RouteBuilderState = {
  isLoadingRoute: false,
  networkFees: null,
  estimatedReceive: null,
  error: null,
  builtRoute: null,
};

/**
 * Options for useRouteBuilder
 */
export interface UseRouteBuilderOptions {
  /** Debounce time in milliseconds (default: 300) */
  debounceMs?: number;
  /** Whether to automatically build routes (default: true) */
  enabled?: boolean;
  /** Quote refresh interval in ms: the resolved
   *  `routes.options.routeRefreshMs`. */
  refreshMs: number;

  fromChain: ChainDef | undefined | string | number;
  fromChainId: string | number | undefined;
  toChain: ChainDef | string | number | null;
  toChainId: string;
  toToken: string;
  toAddress: string | undefined;
  fromToken: string;
  fromAmountWei: bigint | string;
  fromAmountUsd?: string;
  fromAddress: string | undefined;
  refundAddress: string | undefined;
  slippage: number;
}

/**
 * Hook for building routes with fee calculation.
 * Automatically calls Trustware.buildRoute() when amount, token, and chain are selected.
 * Debounces calls to avoid excessive API requests.
 *
 * @param options - Configuration options
 * @returns Route building state including fees and estimated receive amount
 */
export function useRouteBuilder({
  enabled = true,
  debounceMs = 300,
  refreshMs,
  fromChain,
  fromChainId,
  toChain,
  toChainId,
  toToken,
  toAddress,
  fromToken,
  fromAmountWei,
  fromAmountUsd,
  fromAddress,
  refundAddress,
  slippage,
}: UseRouteBuilderOptions): RouteBuilderState & {
  adoptRebuiltRoute: (built: BuiltRoute) => void;
  refreshRoute: () => void;
} {
  const { selectedToken, selectedChain, amount } = useDepositForm();
  const { walletAddress } = useDepositWallet();
  const { errorMessage, transactionStatus } = useDepositTransaction();
  // The wallet is being asked to confirm the route on screen: a refresh
  // now would swap it for one the user isn't signing.
  const confirmInFlight = transactionStatus === "confirming";

  const [state, setState] = useState<RouteBuilderState>(EMPTY_ROUTE_STATE);

  const abortRef = useRef<AbortController | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Build a cache key from the route parameters

  const routeKey = useMemo(() => {
    // unique key for memoization/invalidation
    if (
      !enabled ||
      !selectedToken ||
      !selectedChain ||
      !amount ||
      !walletAddress
    ) {
      return null;
    }

    return JSON.stringify({
      fromChainId,
      toChainId,
      fromToken,
      toToken,
      fromAmountWei: fromAmountWei.toString(), //toString() fixed the Error: <- Do not know how to serialize a BigInt->
      fromAmountUsd,
      fromAddress,
      toAddress,
      fromChain,
      toChain,
      refundAddress,
      slippage,
    } as UseRouteBuilderOptions);
  }, [
    amount,
    enabled,
    fromAddress,
    fromAmountUsd,
    fromAmountWei,
    fromChain,
    fromChainId,
    fromToken,
    refundAddress,
    selectedChain,
    selectedToken,
    slippage,
    toAddress,
    toChain,
    toChainId,
    toToken,
    walletAddress,
  ]);

  const hasFromChainId =
    fromChainId !== undefined &&
    fromChainId !== null &&
    String(fromChainId).trim() !== "";
  const hasToChainId =
    toChainId !== undefined &&
    toChainId !== null &&
    String(toChainId).trim() !== "";

  useEffect(() => {
    if (
      !fromChain ||
      !hasFromChainId ||
      !hasToChainId ||
      !fromToken ||
      !toToken ||
      !fromAmountWei ||
      !fromAddress ||
      !toAddress
    )
      return;

    // console.log(
    //   "[useRouteBuilder] Effect triggered, routeKey:",
    //   routeKey ? "exists" : "null"
    // );

    // Abort any pending request
    abortRef.current?.abort();

    // Clear state if we don't have all required params
    if (!routeKey) {
      setState(EMPTY_ROUTE_STATE);
      return;
    }

    // Parse the route key to get params
    const params = JSON.parse(routeKey);
    // console.log("[useRouteBuilder] Building route with params:", params);

    // Create new abort controller
    const ac = new AbortController();
    abortRef.current = ac;

    // Debounce the route building
    const timeout = setTimeout(async () => {
      // Aborted while debouncing (a confirm started): build nothing, and
      // leave the route on screen as it is.
      if (ac.signal.aborted) return;
      try {
        setState((prev) => ({
          ...prev,
          isLoadingRoute: true,
          error: null,
        }));

        // Get destination config from SDK config
        const config = TrustwareConfigStore.get();
        // console.log("[useRouteBuilder] Config routes:", config.routes);
        const { toChain, toToken, toAddress, defaultSlippage } = config.routes;

        // Ensure we have a destination address
        const destinationAddress = toAddress || walletAddress;
        if (!destinationAddress) {
          throw new Error("Destination address not configured");
        }

        // Build the route
        const shouldBuildRoute = errorMessage === null || errorMessage === "";

        if (!shouldBuildRoute) return;

        const built = await buildRouteForReview({
          fromChain: String(params.fromChain),
          toChain,
          fromToken: params.fromToken,
          toToken,
          fromAmount: params.fromAmountWei,
          fromAmountUsd: params.fromAmountUsd,
          fromAddress: params.fromAddress,
          toAddress: destinationAddress,
          slippage: defaultSlippage,
        });

        // Check if aborted
        if (ac.signal.aborted) return;

        setState(routeStateFor(built));
      } catch (err) {
        // Check if aborted
        if (ac.signal.aborted) return;

        // Map error to user-friendly message
        const errorMessage = mapErrorToMessage(err);

        setState({
          isLoadingRoute: false,
          networkFees: null,
          estimatedReceive: null,
          error: errorMessage,
          builtRoute: null,
        });
      } finally {
        if (!ac.signal.aborted) {
          setState((prev) => ({
            ...prev,
            isLoadingRoute: false,
          }));
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      ac.abort();
    };
  }, [
    routeKey,
    refreshTick,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    fromAmountWei,
    fromAmountUsd,
    fromAddress,
    toAddress,
    fromChain,
    toChain,
    refundAddress,
    slippage,
    hasFromChainId,
    hasToChainId,
    selectedChain,
    selectedToken,
    amount,
    walletAddress,
    errorMessage,
  ]);

  useEffect(() => {
    if (confirmInFlight) abortRef.current?.abort();
  }, [confirmInFlight]);

  // A route on screen is refreshed once, `refreshMs` after it arrived or by
  // its expiry, whichever is first; its replacement schedules the next. With
  // no route (a build failed), builds are retried every `refreshMs`.
  const shownRoute = state.builtRoute;
  useEffect(() => {
    if (!enabled || !routeKey || confirmInFlight) return;
    const refresh = () => setRefreshTick((tick) => tick + 1);
    if (shownRoute === null) {
      const id = setInterval(refresh, refreshMs);
      return () => clearInterval(id);
    }
    const id = setTimeout(
      refresh,
      quoteRefreshIntervalMs(refreshMs, Date.now(), shownRoute.result.expiresAt)
    );
    return () => clearTimeout(id);
  }, [enabled, refreshMs, routeKey, confirmInFlight, shownRoute]);

  /** Put a route rebuilt at sign time up for review in place of the one the
   *  user confirmed. Cancels any build in flight, which would otherwise
   *  replace it with a route the user hasn't seen either. */
  const adoptRebuiltRoute = useCallback((built: BuiltRoute) => {
    abortRef.current?.abort();
    setState(routeStateFor(built));
  }, []);

  /** Fetch a new quote now: the one on screen expired before it was sent. */
  const refreshRoute = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  return { ...state, adoptRebuiltRoute, refreshRoute };
}

/** What the review screen shows for a built route. */
function routeStateFor(built: BuiltRoute): RouteBuilderState {
  const result = built.result;
  // Extract fee and estimate info from the route result
  const estimate = result?.route?.estimate;
  if (
    !result?.txReq?.data ||
    (!isEvmTxRequest(result.txReq) &&
      !isSerializedSolanaTxRequest(result.txReq))
  ) {
    throw new Error("Invalid route response");
  }
  const fees = estimate?.fees;

  // Calculate network fees (gas + bridge fees in USD)
  let networkFeesUSD: string | null = null;
  if (estimate?.fromAmountUsd && estimate?.toAmountMinUsd) {
    const fromUSD = parseFloat(estimate.fromAmountUsd);
    const toMinUSD = parseFloat(estimate.toAmountMinUsd);
    if (!isNaN(fromUSD) && !isNaN(toMinUSD)) {
      const feesDiff = fromUSD - toMinUSD;
      networkFeesUSD = feesDiff > 0 ? feesDiff.toFixed(2) : "0.00";
    }
  }

  // Try to get gas cost from fees object
  if (!networkFeesUSD && fees) {
    const gasCost =
      (fees as unknown as Record<string, string>).gasCostUSD ||
      (fees as unknown as Record<string, string>).totalGasCostUSD;
    if (gasCost) {
      networkFeesUSD = parseFloat(gasCost).toFixed(2);
    }
  }

  // Get estimated receive amount
  // Priority: USD value > formatted token amount > raw amount converted
  let estimatedReceive: string | null = null;

  if (estimate?.toAmountUsd) {
    estimatedReceive = estimate.toAmountUsd;
  } else if (estimate?.toAmountMinUsd) {
    estimatedReceive = estimate.toAmountMinUsd;
  } else if (estimate?.toAmount) {
    // Convert from smallest unit - assume 6 decimals for stablecoins, 18 for others
    const toToken =
      TrustwareConfigStore.get().routes.toToken?.toLowerCase() || "";
    const isStablecoin =
      toToken.includes("usdc") ||
      toToken.includes("usdt") ||
      toToken.includes("dai");
    const decimals = isStablecoin ? 6 : 18;
    const raw = BigInt(estimate.toAmount);
    const divisor = BigInt(10 ** decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
    estimatedReceive = `${whole}.${fractionStr}`;
  }

  return {
    isLoadingRoute: false,
    networkFees: networkFeesUSD,
    estimatedReceive,
    error: null,
    builtRoute: built,
  };
}

/**
 * Maps API errors to user-friendly messages
 */
function mapErrorToMessage(err: unknown): string {
  // A routing verdict is already classified — by the backend, which ran the
  // providers. Re-deriving it from the sentence is what produced "This token or
  // chain combination is not supported" for an amount below a provider's
  // minimum: the summary contains "pair_unsupported" for one provider, and the
  // substring rules below stopped there.
  if (parseRouteError(err)) {
    return mapError(err).message;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    if (msg.includes("insufficient") || msg.includes("balance")) {
      return "Insufficient balance for this transaction";
    }
    if (msg.includes("rate limit") || msg.includes("429")) {
      return "Too many requests. Please wait a moment and try again.";
    }
    if (msg.includes("network") || msg.includes("fetch")) {
      return "Network error. Please check your connection.";
    }
    if (msg.includes("slippage") || msg.includes("price impact")) {
      return "Price impact too high. Try a smaller amount.";
    }
    if (msg.includes("liquidity")) {
      return "Insufficient liquidity for this route.";
    }
    if (msg.includes("not supported") || msg.includes("unsupported")) {
      return "This token or chain combination is not supported.";
    }
    if (msg.includes("api key") || msg.includes("unauthorized")) {
      return "Configuration error. Please contact support.";
    }
    if (msg.includes("destination address")) {
      return "Destination address not configured.";
    }

    // Return original message if no mapping found
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return "Unable to calculate route. Please try again.";
}

export default useRouteBuilder;
