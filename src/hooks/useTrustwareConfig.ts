"use client";
import { useEffect, useState } from "react";
import type { ResolvedTrustwareConfig } from "../types";
import { TrustwareConfigStore } from "../config/store";

export function useTrustwareConfig(): ResolvedTrustwareConfig {
  const [cfg, setCfg] = useState<ResolvedTrustwareConfig>(() => {
    try {
      return TrustwareConfigStore.get();
    } catch {
      // not initialized yet; create a placeholder to avoid SSR crashes,
      // but this will be replaced on subscribe() fire
      return {
        apiKey: "",
        routes: {
          toChain: "",
          toToken: "",
          toAddress: undefined,
          defaultSlippage: 1,
          options: {},
        },
        autoDetectProvider: false,
        theme: "system",
        messages: {
          title: "Trustware SDK",
          description: "Seamlessly bridge assets across chains with Trustware.",
        },
        retry: {
          autoRetry: true,
          maxRetries: 3,
          baseDelayMs: 1000,
          approachingThreshold: 5,
        },
        features: {
          tokensPagination: true,
          balanceStreaming: false,
          shouldAllowGA4: true,
          swapMode: false,
          swapDefaultDestToken: null,
          swapLockDestToken: false,
          swapAllowedDestTokens: null,
        },
      };
    }
  });

  useEffect(() => {
    const unsubscribe = TrustwareConfigStore.subscribe(setCfg);
    return () => {
      unsubscribe();
    };
  }, []);

  return cfg;
}
