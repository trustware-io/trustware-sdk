"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trustware } from "../../core";
import { TrustwareConfigStore } from "../../config/store";
import { useDeposit } from "../context/DepositContext";
import type { BuildRouteResult } from "../../types";

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
  /** The built route intent ID (needed for transaction submission) */
  intentId: string | null;
  /** The full route result (for transaction execution) */
  routeResult: BuildRouteResult | null;
};

/**
 * Options for useRouteBuilder
 */
export interface UseRouteBuilderOptions {
  /** Debounce time in milliseconds (default: 300) */
  debounceMs?: number;
  /** Whether to automatically build routes (default: true) */
  enabled?: boolean;
}

/**
 * Hook for building routes with fee calculation.
 * Automatically calls Trustware.buildRoute() when amount, token, and chain are selected.
 * Debounces calls to avoid excessive API requests.
 *
 * @param options - Configuration options
 * @returns Route building state including fees and estimated receive amount
 */
export function useRouteBuilder(
  options: UseRouteBuilderOptions = {}
): RouteBuilderState {
  const { debounceMs = 300, enabled = true } = options;

  const { selectedToken, selectedChain, amount, walletAddress } = useDeposit();

  const [state, setState] = useState<RouteBuilderState>({
    isLoadingRoute: false,
    networkFees: null,
    estimatedReceive: null,
    error: null,
    intentId: null,
    routeResult: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  // Build a cache key from the route parameters
  const routeKey = useMemo(() => {
    if (!enabled || !selectedToken || !selectedChain || !amount || !walletAddress) {
      return null;
    }

    // Parse amount - need to convert to smallest unit based on token decimals
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return null;
    }

    // Convert amount to smallest unit (e.g., wei for ETH)
    // Use BigInt math to avoid floating point precision issues
    const decimals = selectedToken.decimals || 18;
    const [whole, fraction = ""] = amount.split(".");
    const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
    const amountInSmallestUnit = whole + paddedFraction;
    // Remove leading zeros but keep at least one digit
    const fromAmountWei = amountInSmallestUnit.replace(/^0+/, "") || "0";

    return JSON.stringify({
      fromChain: selectedChain.chainId,
      fromToken: selectedToken.address,
      fromAmount: fromAmountWei,
      fromAddress: walletAddress,
    });
  }, [enabled, selectedToken, selectedChain, amount, walletAddress]);

  useEffect(() => {
    console.log("[useRouteBuilder] Effect triggered, routeKey:", routeKey ? "exists" : "null");

    // Abort any pending request
    abortRef.current?.abort();

    // Clear state if we don't have all required params
    if (!routeKey) {
      console.log("[useRouteBuilder] No routeKey - missing params:", {
        enabled,
        hasToken: !!selectedToken,
        hasChain: !!selectedChain,
        amount,
        hasWallet: !!walletAddress,
      });
      setState({
        isLoadingRoute: false,
        networkFees: null,
        estimatedReceive: null,
        error: null,
        intentId: null,
        routeResult: null,
      });
      return;
    }

    // Parse the route key to get params
    const params = JSON.parse(routeKey);
    console.log("[useRouteBuilder] Building route with params:", params);

    // Create new abort controller
    const ac = new AbortController();
    abortRef.current = ac;

    // Debounce the route building
    const timeout = setTimeout(async () => {
      console.log("[useRouteBuilder] Debounce complete, calling API...");
      try {
        setState((prev) => ({
          ...prev,
          isLoadingRoute: true,
          error: null,
        }));

        // Get destination config from SDK config
        const config = TrustwareConfigStore.get();
        console.log("[useRouteBuilder] Config routes:", config.routes);
        const { toChain, toToken, toAddress, defaultSlippage } = config.routes;

        // Ensure we have a destination address
        const destinationAddress = toAddress || walletAddress;
        if (!destinationAddress) {
          throw new Error("Destination address not configured");
        }

        // Build the route
        const result = await Trustware.buildRoute({
          fromChain: String(params.fromChain),
          toChain,
          fromToken: params.fromToken,
          toToken,
          fromAmount: params.fromAmount,
          fromAddress: params.fromAddress,
          toAddress: destinationAddress,
          slippage: defaultSlippage,
        });

        // Check if aborted
        if (ac.signal.aborted) return;

        // Extract fee and estimate info from the route result
        const estimate = result?.route?.estimate;
        const fees = estimate?.fees;

        // Debug: log the full estimate object
        console.log("[useRouteBuilder] Route result:", result);
        console.log("[useRouteBuilder] Estimate:", estimate);
        console.log("[useRouteBuilder] Fees:", fees);

        // Calculate network fees (gas + bridge fees in USD)
        let networkFeesUSD: string | null = null;
        if (estimate?.fromAmountUSD && estimate?.toAmountMinUSD) {
          const fromUSD = parseFloat(estimate.fromAmountUSD);
          const toMinUSD = parseFloat(estimate.toAmountMinUSD);
          if (!isNaN(fromUSD) && !isNaN(toMinUSD)) {
            const feesDiff = fromUSD - toMinUSD;
            networkFeesUSD = feesDiff > 0 ? feesDiff.toFixed(2) : "0.00";
          }
        }

        // Try to get gas cost from fees object
        if (!networkFeesUSD && fees) {
          const gasCost = (fees as any).gasCostUSD || (fees as any).totalGasCostUSD;
          if (gasCost) {
            networkFeesUSD = parseFloat(gasCost).toFixed(2);
          }
        }

        // Get estimated receive amount
        // Priority: USD value > formatted token amount > raw amount converted
        let estimatedReceive: string | null = null;

        if (estimate?.toAmountUSD) {
          estimatedReceive = estimate.toAmountUSD;
        } else if (estimate?.toAmountMinUSD) {
          estimatedReceive = estimate.toAmountMinUSD;
        } else if (estimate?.toAmount) {
          // Convert from smallest unit - assume 6 decimals for stablecoins, 18 for others
          const toToken = config.routes.toToken?.toLowerCase() || "";
          const isStablecoin = toToken.includes("usdc") || toToken.includes("usdt") || toToken.includes("dai");
          const decimals = isStablecoin ? 6 : 18;
          const raw = BigInt(estimate.toAmount);
          const divisor = BigInt(10 ** decimals);
          const whole = raw / divisor;
          const fraction = raw % divisor;
          const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
          estimatedReceive = `${whole}.${fractionStr}`;
        }

        setState({
          isLoadingRoute: false,
          networkFees: networkFeesUSD,
          estimatedReceive,
          error: null,
          intentId: result.intentId,
          routeResult: result,
        });
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
          intentId: null,
          routeResult: null,
        });
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      ac.abort();
    };
  }, [routeKey, debounceMs, walletAddress]);

  return state;
}

/**
 * Maps API errors to user-friendly messages
 */
function mapErrorToMessage(err: unknown): string {
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
