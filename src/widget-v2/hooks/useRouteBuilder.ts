"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trustware } from "../../core";
import { TrustwareConfigStore } from "../../config/store";
import { useDeposit } from "../context/DepositContext";
import type { BuildRouteResult, ChainDef } from "../../types";
import { calculateGasFeeDisplay } from "../helpers/feesHelpers";
import { divRoundDown, weiToDecimalString } from "src/utils";

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

  fromChain: ChainDef | undefined | string | number;
  fromChainId: string | number | undefined;
  toChain: ChainDef | null;
  toChainId: string;
  toToken: string;
  toAddress: string | undefined;
  fromToken: string;
  fromAmountWei: bigint;
  fromAmountUsd?: string;
  fromAddress: string | undefined;
  refundAddress: string | undefined;
  slippage: number;
  direction?: string;
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
  direction,
}: UseRouteBuilderOptions): RouteBuilderState {
  // const { debounceMs = 300, enabled = true } = options;

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
  // const routeKey = useMemo(() => {
  //   if (
  //     !enabled ||
  //     !selectedToken ||
  //     !selectedChain ||
  //     !amount ||
  //     !walletAddress
  //   ) {
  //     return null;
  //   }

  //   // Parse amount - need to convert to smallest unit based on token decimals
  //   const parsedAmount = parseFloat(amount);
  //   if (isNaN(parsedAmount) || parsedAmount <= 0) {
  //     return null;
  //   }

  //   // Convert amount to smallest unit (e.g., wei for ETH)
  //   // Use BigInt math to avoid floating point precision issues
  //   const decimals = selectedToken.decimals || 18;
  //   const [whole, fraction = ""] = amount.split(".");
  //   const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  //   const amountInSmallestUnit = whole + paddedFraction;
  //   // Remove leading zeros but keep at least one digit
  //   const fromAmountWei = amountInSmallestUnit.replace(/^0+/, "") || "0";

  //   return JSON.stringify({
  //     fromChain: selectedChain.chainId,
  //     fromToken: selectedToken.address,
  //     fromAmount: fromAmountWei,
  //     fromAddress: walletAddress,
  //   });
  // }, [enabled, selectedToken, selectedChain, amount, walletAddress]);

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
      fromAmountWei: fromAmountWei.toString(),
      fromAmountUsd,
      fromAddress,
      toAddress,
      fromChain,
      toChain,
      refundAddress,
      direction,
      slippage,
    } as UseRouteBuilderOptions);
  }, [
    amount,
    direction,
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
      !toChain ||
      !hasFromChainId ||
      !hasToChainId ||
      !fromToken ||
      !toToken ||
      !fromAmountWei ||
      !fromAddress ||
      !toAddress
    )
      return;

    console.log(
      "[useRouteBuilder] Effect triggered, routeKey:",
      routeKey ? "exists" : "null"
    );

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
    // console.log("[useRouteBuilder] Building route with params:", params);

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
        // console.log("[useRouteBuilder] Config routes:", config.routes);
        const { toChain, toToken, toAddress, defaultSlippage } = config.routes;

        // Ensure we have a destination address
        const destinationAddress = toAddress || walletAddress;
        if (!destinationAddress) {
          throw new Error("Destination address not configured");
        }

        // Build the route
        console.log("buildRoute Called", {
          params,
          toChain,
          toToken,
          toAddress,
          defaultSlippage,
        });

        const result = await Trustware.buildRoute({
          fromChain: String(params.fromChain),
          toChain,
          fromToken: params.fromToken,
          toToken,
          fromAmount: params.fromAmountWei,
          fromAmountUsd: params.fromAmountUsd,
          // fromAmountUSD:params.fromAmountUsd,
          fromAddress: params.fromAddress,
          toAddress: destinationAddress,
          slippage: defaultSlippage,
          // slippageBps: params.slippageBps || 100,
        });

        {
          // "fromChain": "43114",
          // "toChain": "43114",
          // "fromToken": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          // "toToken": "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
          // "fromAmount": "10800150691113940",
          // "fromAddress": "0xA3345d8139e61c93c5D154D9F6E311eB4C6F1154",
          // "toAddress": "0x40695edf6e3c6be65122162b7d7b7f6c5418037b",
          // "fromAmountUsd": "0.10",
          // "slippage": 1,
          // "linkId": "48a1411c-8efc-4660-97fa-9214ca7280f7",
          // "slippageBps": 100,
          // "fromAmountUSD": "0.10"
        }

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
            (fees as any).gasCostUSD || (fees as any).totalGasCostUSD;
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
          const toToken = config.routes.toToken?.toLowerCase() || "";
          const isStablecoin =
            toToken.includes("usdc") ||
            toToken.includes("usdt") ||
            toToken.includes("dai");
          const decimals = isStablecoin ? 6 : 18;
          const raw = BigInt(estimate.toAmount);
          const divisor = BigInt(10 ** decimals);
          const whole = raw / divisor;
          const fraction = raw % divisor;
          const fractionStr = fraction
            .toString()
            .padStart(decimals, "0")
            .slice(0, 2);
          estimatedReceive = `${whole}.${fractionStr}`;
        }

        // calculateGasFeeDisplay(
        //   {
        //     gasLimit: result?.txReq.gasLimit ?? "0",
        //     gasPrice: result?.txReq.gasPrice ?? "0",
        //     maxFeePerGas: result?.txReq.maxFeePerGas,
        //   },
        //   selectedToken?.usdPrice ?? 0,
        //   selectedToken?.decimals ?? 18
        // ); // TODO: pass actual native token price

        const gasLimit = result?.txReq?.gasLimit
          ? BigInt(result.txReq.gasLimit)
          : undefined;

        const effectiveGasPrice = result?.txReq?.maxFeePerGas
          ? BigInt(result.txReq.maxFeePerGas)
          : undefined;

        if (gasLimit === undefined || effectiveGasPrice === undefined)
          return undefined;

        // const gasFeeWei = divRoundDown(gasLimit * effectiveGasPrice * 12n, 10n);
        const gasFeeWei = divRoundDown(gasLimit * effectiveGasPrice * 12n, 10n);
        const gasFeeDecimal = weiToDecimalString(
          gasFeeWei,
          selectedToken?.decimals ?? 18,
          6
        );
        const gasFeeUsd =
          gasFeeWei && selectedToken?.usdPrice
            ? (Number(gasFeeWei) / 10 ** (selectedToken?.decimals ?? 18)) *
              selectedToken?.usdPrice
            : undefined;
        // console.log({
        //   gasLimit,
        //   effectiveGasPrice,
        //   gasFeeWei,
        //   gasFeeDecimal,
        //   gasFeeUsd,
        // });
        // return { gasFeeDecimal, gasFeeUsd };

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
    direction,
    slippage,
    hasFromChainId,
    hasToChainId,
    selectedChain,
    selectedToken,
    amount,
    walletAddress,
  ]);

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
