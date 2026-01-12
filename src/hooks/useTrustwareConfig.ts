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
        theme: {
          primaryColor: "#4F46E5",
          secondaryColor: "#6366F1",
          backgroundColor: "#FFFFFF",
          textColor: "#111827",
          borderColor: "#E5E7EB",
          radius: 8,
        },
        messages: {
          title: "Trustware SDK",
          description: "Seamlessly bridge assets across chains with Trustware.",
        },
        rateLimit: {
          enabled: true,
          maxRetries: 3,
          baseDelayMs: 1000,
          approachingThreshold: 5,
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
