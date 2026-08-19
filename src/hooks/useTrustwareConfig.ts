"use client";
import { useEffect, useState } from "react";
import type { ResolvedTrustwareConfig } from "../types";
import { DEFAULT_FEATURE_FLAGS, DEFAULT_RETRY_CONFIG } from "../types/config";
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
        mode: "deposit",
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
        // Shared with the resolver rather than restated, so this placeholder
        // can't drift from the real defaults.
        retry: { ...DEFAULT_RETRY_CONFIG },
        features: { ...DEFAULT_FEATURE_FLAGS },
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
