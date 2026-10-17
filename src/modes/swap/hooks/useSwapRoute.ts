"use client";
import { useCallback, useRef, useState } from "react";
import { buildRouteForReview, type BuiltRoute } from "src/core/signTimeRoute";
import { parseDecimalToWei } from "src/widget/helpers/chainHelpers";
import type { ChainDef } from "src/types";
import type { Token, YourTokenData } from "src/widget/state/deposit/types";
import { TrustwareConfigStore } from "src/config/store";
import { mapError } from "src/widget/lib/mapError";
import { RequestGeneration } from "src/widget/lib/requestGeneration";

export type SwapRouteState = {
  built: BuiltRoute | null;
  loading: boolean;
  error: string | null;
};

export function useSwapRoute() {
  const [state, setState] = useState<SwapRouteState>({
    built: null,
    loading: false,
    error: null,
  });

  // A fetch's result lands only if nothing newer happened since it began:
  // another fetch, a clear, a confirm, or an adopted rebuild.
  const generationRef = useRef(new RequestGeneration());

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
      /** Deposit into this vault instead of a plain transfer (BVT-398) — set by SwapMode's vault picker, cleared whenever the destination token is changed manually. */
      vault?: { vaultId: string; network: string };
    }): Promise<BuiltRoute | null> => {
      const { fromToken, fromChain, toToken, toChain, amount, walletAddress } =
        params;

      const decimals = fromToken.decimals ?? 18;
      const amountWei = parseDecimalToWei(amount, decimals);
      if (!amountWei || amountWei === 0n) {
        setState({
          built: null,
          loading: false,
          error: "Enter a valid amount",
        });
        return null;
      }

      const generation = generationRef.current.begin();
      setState({ built: null, loading: true, error: null });

      let slippage = params.slippage ?? 1;
      if (!params.slippage) {
        try {
          slippage = TrustwareConfigStore.get().routes.defaultSlippage;
        } catch {
          /* noop */
        }
      }

      try {
        const built = await buildRouteForReview({
          fromChain: String(fromChain.chainId),
          toChain: String(toChain.chainId),
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount: amountWei.toString(),
          fromAddress: walletAddress,
          toAddress: params.toAddress ?? walletAddress,
          slippage,
          vault: params.vault,
        });

        if (!generationRef.current.isCurrent(generation)) return null;
        setState({ built, loading: false, error: null });
        return built;
      } catch (err) {
        if (!generationRef.current.isCurrent(generation)) return null;
        // Classify here, while the RouteError still has its provider
        // outcomes. State holds a string, and the API's "error" sentence is
        // only the summary — the verdict is in `providers`, which a message
        // does not carry. mapError recognizes its own output, so the render
        // pass (SwapMode maps route.error again) reproduces this result.
        const msg = err ? mapError(err).message : "Failed to get quote";
        setState({ built: null, loading: false, error: msg });
        return null;
      }
    },
    []
  );

  const clear = useCallback(() => {
    generationRef.current.invalidate();
    setState({ built: null, loading: false, error: null });
  }, []);

  /** The user confirmed: a quote refresh still in flight must not land on
   *  top of the route being sent. The route on screen stays as it is. */
  const discardPendingFetch = useCallback(() => {
    generationRef.current.invalidate();
  }, []);

  /** Put a route rebuilt at sign time up for review in place of the one the
   *  user confirmed. A fetch still in flight is discarded, so it can't
   *  replace the rebuilt route before the user has seen it. */
  const adoptRebuiltRoute = useCallback((built: BuiltRoute) => {
    generationRef.current.invalidate();
    setState({ built, loading: false, error: null });
  }, []);

  return {
    ...state,
    data: state.built?.result ?? null,
    fetch,
    clear,
    discardPendingFetch,
    adoptRebuiltRoute,
  };
}
