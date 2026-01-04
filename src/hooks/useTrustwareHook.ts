"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrustwareCore } from "../core";
import { Trustware } from "../core";
import type { BuildRouteResult } from "../types";

type ExchangeRate = {
  fromAmount?: string;
  toAmount?: string;
  minimumReceived?: string;
  fromAmountUSD?: string;
  toAmountMinUSD?: string;
};

export type TrustwareRouteState =
  | {
      status: "idle";
      intentId?: undefined;
      txReq?: undefined;
      actions?: undefined;
      finalExchangeRate?: undefined;
      raw?: undefined;
      error?: undefined;
    }
  | {
      status: "building";
      intentId?: undefined;
      txReq?: undefined;
      actions?: undefined;
      finalExchangeRate?: undefined;
      raw?: undefined;
      error?: undefined;
    }
  | {
      status: "ready";
      intentId: string;
      txReq: BuildRouteResult["route"]["transactionRequest"];
      actions: unknown[];
      finalExchangeRate: ExchangeRate;
      raw: BuildRouteResult;
      error?: undefined;
    }
  | {
      status: "error";
      intentId?: undefined;
      txReq?: undefined;
      actions?: undefined;
      finalExchangeRate?: undefined;
      raw?: undefined;
      error: string;
    };

type UseTrustwareRouteArgs = {
  core?: TrustwareCore;
  fromChainId?: string | number | null;
  toChainId?: string | number | null;
  fromToken?: string | null;
  toToken?: string | null;
  fromAmount?: string | number | null;
  fromAddress?: `0x${string}` | string | null;
  toAddress?: `0x${string}` | string | null;
  slippage?: number;
  debounceMs?: number;
};

function toRouteParam(
  value: string | number | null | undefined
): string | undefined {
  if (value == null) return undefined;
  const str = typeof value === "number" ? String(value) : value;
  return str && str.length > 0 ? str : undefined;
}

export function useTrustwareRoute({
  core = Trustware,
  fromChainId,
  toChainId,
  fromToken,
  toToken,
  fromAmount,
  fromAddress,
  toAddress,
  slippage,
  debounceMs = 250,
}: UseTrustwareRouteArgs): TrustwareRouteState {
  const [state, setState] = useState<TrustwareRouteState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const key = useMemo(
    () =>
      JSON.stringify({
        fromChainId,
        toChainId,
        fromToken,
        toToken,
        fromAmount,
        fromAddress,
        toAddress,
        slippage,
      }),
    [
      fromChainId,
      toChainId,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      toAddress,
      slippage,
    ]
  );

  useEffect(() => {
    const fromChain = toRouteParam(fromChainId);
    const toChain = toRouteParam(toChainId);
    const amount =
      fromAmount === null || fromAmount === undefined
        ? undefined
        : typeof fromAmount === "number"
          ? String(fromAmount)
          : fromAmount;

    if (
      !core ||
      !fromChain ||
      !toChain ||
      !fromToken ||
      !toToken ||
      !amount ||
      !fromAddress ||
      !toAddress
    ) {
      abortRef.current?.abort();
      setState({ status: "idle" });
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const timeout = setTimeout(async () => {
      try {
        setState({ status: "building" });
        const build = await core.buildRoute({
          fromChain,
          toChain,
          fromToken,
          toToken,
          fromAmount: amount,
          fromAddress,
          toAddress,
          slippage,
        });

        if (ac.signal.aborted) return;

        const txReq = build?.route?.transactionRequest;
        const hasTarget = Boolean((txReq as any)?.to ?? (txReq as any)?.target);
        if (!txReq || !txReq.data || !hasTarget) {
          throw new Error("Invalid route response");
        }

        const actionsRaw =
          (build as any)?.route?.estimate?.route?.actions ??
          (build as any)?.route?.estimate?.actions ??
          (build as any)?.route?.actions ??
          [];
        const actions = Array.isArray(actionsRaw) ? actionsRaw : [];

        const estimate = build?.route?.estimate ?? {};
        const fees = (estimate as any)?.fees ?? {};
        const finalExchangeRate: ExchangeRate = {
          fromAmount: estimate?.fromAmount,
          toAmount: estimate?.toAmount,
          minimumReceived:
            fees?.minimumReceived ??
            fees?.minimumReceivedAmount ??
            fees?.minReceived ??
            estimate?.toAmount,
          fromAmountUSD: fees?.fromAmountUSD ?? estimate?.fromAmountUSD,
          toAmountMinUSD: fees?.toAmountMinUSD ?? estimate?.toAmountUSD,
        };
        setState({
          status: "ready",
          intentId: build.intentId,
          txReq,
          actions,
          finalExchangeRate,
          raw: build,
        });
      } catch (err) {
        if (ac.signal.aborted) return;
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Route failed";
        setState({ status: "error", error: message });
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      ac.abort();
    };
  }, [key, core, debounceMs]);

  return state;
}
