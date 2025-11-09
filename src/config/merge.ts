/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TrustwareConfigOptions, ResolvedTrustwareConfig } from "../types/";
import {
  DEFAULT_AUTO_DETECT_PROVIDER,
  DEFAULT_SLIPPAGE,
  DEFAULT_THEME,
  DEFAULT_MESSAGES,
} from "./defaults";

// tiny deep merge for plain objects
function deepMerge<T extends Record<string, any>>(
  base: T,
  patch?: Partial<T>,
): T {
  if (!patch) return { ...base };
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      (out as any)[k] = deepMerge((base as any)[k] ?? {}, v as any);
    } else {
      (out as any)[k] = v;
    }
  }
  return out;
}

function normalizeSlippage(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_SLIPPAGE;
  // clamp sane range 0.01%..5% (0.0001..0.05)
  if (n <= 0) return DEFAULT_SLIPPAGE;
  if (n > 5) return 5;
  return n;
}

export function resolveConfig(
  input: TrustwareConfigOptions,
): ResolvedTrustwareConfig {
  if (!input?.apiKey) {
    throw new Error("TrustwareConfig: 'apiKey' is required.");
  }
  if (!input.routes?.toChain || !input.routes?.toToken) {
    throw new Error(
      "TrustwareConfig: 'routes.toChain' and 'routes.toToken' are required.",
    );
  }

  const autoDetectProvider =
    typeof input.autoDetectProvider === "boolean"
      ? input.autoDetectProvider
      : DEFAULT_AUTO_DETECT_PROVIDER;

  const routes = {
    toChain: input.routes.toChain,
    toToken: input.routes.toToken,
    fromToken: input.routes.fromToken,
    fromAddress: input.routes.fromAddress,
    toAddress: input.routes.toAddress,
    defaultSlippage: normalizeSlippage(
      input.routes.defaultSlippage ?? DEFAULT_SLIPPAGE,
    ),
    options: {
      ...input.routes.options,
    },
  };

  const theme = deepMerge(DEFAULT_THEME, input.theme);
  const messages = deepMerge(DEFAULT_MESSAGES, input.messages);

  return {
    apiKey: input.apiKey,
    routes,
    autoDetectProvider,
    theme,
    messages,
  };
}
