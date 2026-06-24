"use client";
import { useCallback, useRef, useState } from "react";
import { buildRoute } from "src/core/routes";
import { parseDecimalToWei } from "src/widget/helpers/chainHelpers";
import type { BuildRouteResult, ChainDef } from "src/types";
import type { Token, YourTokenData } from "src/widget/state/deposit/types";
import { TrustwareConfigStore } from "src/config/store";

export type SwapRouteState = {
  data: BuildRouteResult | null;
  loading: boolean;
  error: string | null;
};

export function useSwapRoute() {
  const [state, setState] = useState<SwapRouteState>({
    data: null,
    loading: false,
    error: null,
  });

  const abortRef = useRef(false);

  const fetch = useCallback(
    async (params: {
      fromToken: Token | YourTokenData;
      fromChain: ChainDef;
      toToken: Token | YourTokenData;
      toChain: ChainDef;
      amount: string;
      walletAddress: string;
      toAddress?: string;
      slippage?: number;
    }): Promise<BuildRouteResult | null> => {
      const { fromToken, fromChain, toToken, toChain, amount, walletAddress } =
        params;

      const decimals = fromToken.decimals ?? 18;
      const amountWei = parseDecimalToWei(amount, decimals);
      if (!amountWei || amountWei === 0n) {
        setState({ data: null, loading: false, error: "Enter a valid amount" });
        return null;
      }

      abortRef.current = false;
      setState({ data: null, loading: true, error: null });

      let slippage = params.slippage ?? 1;
      if (!params.slippage) {
        try {
          slippage = TrustwareConfigStore.get().routes.defaultSlippage;
        } catch {
          /* noop */
        }
      }

      try {
        const result = await buildRoute({
          fromChain: String(fromChain.chainId),
          toChain: String(toChain.chainId),
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount: amountWei.toString(),
          fromAddress: walletAddress,
          toAddress: params.toAddress ?? walletAddress,
          slippage,
        });

        if (abortRef.current) return null;
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        if (abortRef.current) return null;
        const msg = err instanceof Error ? err.message : "Failed to get quote";
        setState({ data: null, loading: false, error: msg });
        return null;
      }
    },
    []
  );

  const clear = useCallback(() => {
    abortRef.current = true;
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, fetch, clear };
}
