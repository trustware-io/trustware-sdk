/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  TrustwareConfigOptions,
  ResolvedTrustwareConfig,
} from "../types/";
import {
  DEFAULT_AUTO_DETECT_PROVIDER,
  DEFAULT_SLIPPAGE,
  DEFAULT_MESSAGES,
} from "./defaults";
import { DEFAULT_FEATURE_FLAGS, DEFAULT_RETRY_CONFIG } from "../types/config";
import { validateAddressForChain } from "src";
import { TrustwareError } from "src/errors/TrustwareError";
import { TrustwareErrorCode } from "src/errors/errorCodes";
// import { getUniversalConnector } from "./walletconnect";

/**
 * Resolve WalletConnect config with built-in defaults.
 * WalletConnect is ENABLED by default - no user configuration required.
 */
// function resolveWalletConnectConfig(
//   input?: WalletConnectConfig
// ): ResolvedWalletConnectConfig | undefined {
//   // Allow users to explicitly disable WalletConnect
//   if (input?.disabled) return undefined;

//   // Use built-in project ID by default, allow override
//   const projectId = input?.projectId ?? WALLETCONNECT_PROJECT_ID;

//   return {
//     projectId,
//     chains: input?.chains ?? [1], // Default to Ethereum mainnet
//     optionalChains: input?.optionalChains ?? [
//       1, 10, 56, 137, 8453, 42161, 43114,
//     ], // ETH, OP, BSC, Polygon, Base, Arbitrum, Avalanche
//     metadata: {
//       name: input?.metadata?.name ?? "Trustware",
//       description:
//         input?.metadata?.description ?? "Cross-chain bridge & top-up",
//       url: input?.metadata?.url ?? "https://trustware.io",
//       icons: input?.metadata?.icons ?? ["https://app.trustware.io/icon.png"],
//     },
//     relayUrl: input?.relayUrl,
//     showQrModal: input?.showQrModal ?? true,
//   };
// }

// tiny deep merge for plain objects
function deepMerge<T extends Record<string, any>>(
  base: T,
  patch?: Partial<T>
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

let hasWarnedDeprecatedSwapModeFlag = false;
function warnDeprecatedSwapModeFlag() {
  if (hasWarnedDeprecatedSwapModeFlag) return;
  hasWarnedDeprecatedSwapModeFlag = true;
  console.warn(
    '[Trustware SDK] `features.swapMode` is deprecated — use `mode: "swap"` on the top-level config instead.'
  );
}

function resolveMode(input: TrustwareConfigOptions): "deposit" | "swap" {
  if (input.mode === "swap") return "swap";
  if (input.mode === "deposit") return "deposit";
  if (input.features?.swapMode) {
    warnDeprecatedSwapModeFlag();
    return "swap";
  }
  return "deposit";
}

export function resolveConfig(
  input: TrustwareConfigOptions
): ResolvedTrustwareConfig {
  if (!input?.apiKey) {
    throw new TrustwareError({
      code: TrustwareErrorCode.INVALID_CONFIG,
      message: "TrustwareConfig: 'apiKey' is required.",
      userMessage: "Missing required API key configuration.",
    });
  }

  const mode = resolveMode(input);

  if (
    mode === "deposit" &&
    (!input.routes?.toChain || !input.routes?.toToken)
  ) {
    throw new TrustwareError({
      code: TrustwareErrorCode.INVALID_CONFIG,
      message:
        "TrustwareConfig: 'routes.toChain' and 'routes.toToken' are required in deposit mode.",
      userMessage: "Missing required destination chain/token configuration.",
    });
  }

  // ── Address validation (only meaningful when both an address and a chain to
  // validate it against are present — in swap mode with no `routes` at all,
  // there's nothing to validate here).
  const toChain = input.routes?.toChain;

  if (input.routes?.toAddress && toChain) {
    const result = validateAddressForChain(input.routes.toAddress, toChain);
    if (!result.isValid) {
      console.error(`[Trustware SDK] Invalid toAddress: ${result.error}`);
      throw new TrustwareError({
        code: TrustwareErrorCode.INVALID_CONFIG,
        message: `Invalid toAddress: ${result.error}`,
        userMessage: "The configured destination address is invalid.",
      });
    }
  }

  if (input.routes?.fromAddress) {
    const fromChain = input.routes.fromChain ?? toChain;
    if (fromChain) {
      const result = validateAddressForChain(
        input.routes.fromAddress,
        fromChain
      );
      if (!result.isValid) {
        console.error(`[Trustware SDK] Invalid fromAddress: ${result.error}`);
        throw new TrustwareError({
          code: TrustwareErrorCode.INVALID_CONFIG,
          message: `Invalid fromAddress: ${result.error}`,
          userMessage: "The configured source address is invalid.",
        });
      }
    }
  }

  const autoDetectProvider =
    typeof input.autoDetectProvider === "boolean"
      ? input.autoDetectProvider
      : DEFAULT_AUTO_DETECT_PROVIDER;

  const routes = {
    toChain: input.routes?.toChain ?? "",
    toToken: input.routes?.toToken ?? "",
    fromToken: input.routes?.fromToken,
    fromAddress: input.routes?.fromAddress,
    fromChain: input.routes?.fromChain,
    toAddress: input.routes?.toAddress,
    defaultSlippage: normalizeSlippage(
      input.routes?.defaultSlippage ?? DEFAULT_SLIPPAGE
    ),
    options: {
      ...input.routes?.options,
    },
  };

  const theme = input.theme ?? "system";
  const messages = deepMerge(DEFAULT_MESSAGES, input.messages);

  // Rate limit callbacks only — the retry schedule itself is fixed in
  // RETRY_POLICY because the backend, not the client, decides the limit.
  const retry = {
    approachingThreshold:
      input.retry?.approachingThreshold ??
      DEFAULT_RETRY_CONFIG.approachingThreshold,
    onRateLimitInfo: input.retry?.onRateLimitInfo,
    onRateLimited: input.retry?.onRateLimited,
    onRateLimitApproaching: input.retry?.onRateLimitApproaching,
  };

  // Resolve WalletConnect config (optional)
  // const walletConnect = resolveWalletConnectConfig(input.walletConnect);
  const walletConnect = input.walletConnect;
  const features = {
    tokensPagination:
      input.features?.tokensPagination ??
      DEFAULT_FEATURE_FLAGS.tokensPagination,
    balanceStreaming:
      input.features?.balanceStreaming ??
      DEFAULT_FEATURE_FLAGS.balanceStreaming,
    shouldAllowGA4:
      input.features?.shouldAllowGA4 ?? DEFAULT_FEATURE_FLAGS.shouldAllowGA4,
    // Always mirrors the canonical `mode`, however the caller set it (new `mode` field
    // or the deprecated `features.swapMode` flag).
    swapMode: mode === "swap",
    swapDefaultDestToken:
      input.features?.swapDefaultDestToken ??
      DEFAULT_FEATURE_FLAGS.swapDefaultDestToken,
    swapLockDestToken:
      input.features?.swapLockDestToken ??
      DEFAULT_FEATURE_FLAGS.swapLockDestToken,
    swapAllowedDestTokens:
      input.features?.swapAllowedDestTokens ??
      DEFAULT_FEATURE_FLAGS.swapAllowedDestTokens,
  };

  return {
    apiKey: input.apiKey,
    mode,
    routes,
    autoDetectProvider,
    theme,
    messages,
    retry,
    walletConnect,
    features,
    onError: input.onError,
    onSuccess: input.onSuccess,
    onEvent: input.onEvent,
  };
}
