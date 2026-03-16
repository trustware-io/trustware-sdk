/* core/index.ts */
import type {
  TrustwareConfigOptions,
  ResolvedTrustwareConfig,
  WalletInterFaceAPI,
} from "../types";
import { TrustwareConfigStore } from "../config/store";
import { walletManager } from "../wallets/manager";
import { buildRoute, submitReceipt, getStatus, pollStatus } from "./routes";
import { getBalances, getBalancesByAddress } from "./balances";
import { sendRouteTransaction, runTopUp } from "./tx";
import { validateSdkAccess } from "./http";
import { useChains } from "./useChains";
import { useTokens } from "./useTokens";
import { TrustwareError } from "../errors/TrustwareError";
import { TrustwareErrorCode } from "../errors/errorCodes";

// simple memo to avoid re-validating same key repeatedly
let _lastValidatedKey: string | null = null;

export const Trustware = {
  /** Initialize config */
  async init(cfg: TrustwareConfigOptions) {
    TrustwareConfigStore.init(cfg);
    const key = TrustwareConfigStore.get().apiKey;

    if (_lastValidatedKey !== key) {
      try {
        await validateSdkAccess();
        _lastValidatedKey = key;
      } catch (err: unknown) {
        const reason =
          err instanceof Error && err.message ? `: ${err.message}` : "";
        const error = new TrustwareError({
          code: TrustwareErrorCode.INVALID_API_KEY,
          message: `Trustware.init: API key validation failed${reason}`,
          userMessage:
            "API key validation failed. Please verify your Trustware API key.",
          cause: err,
        });
        const config = TrustwareConfigStore.get();
        config.onError?.(error);
        config.onEvent?.({ type: "error", error });
        throw error;
      }
    }
    return Trustware;
  },

  /** Attach a wallet interface directly (skips detection) */
  useWallet(w: WalletInterFaceAPI) {
    walletManager.attachWallet(w);
    return Trustware;
  },

  /** Best-effort background attach to detected wallet(s) (detection hook should be running in the app) */
  async autoDetect(_timeoutMs?: number) {
    await walletManager.autoAttach();
    return walletManager.wallet != null;
  },

  /** Read resolved config */
  getConfig(): ResolvedTrustwareConfig {
    return TrustwareConfigStore.get();
  },

  setDestinationAddress(address?: string | null) {
    const prev = TrustwareConfigStore.get();
    TrustwareConfigStore.update({
      routes: {
        ...prev.routes,
        toAddress: address ?? undefined,
      },
    });
    return Trustware;
  },

  /** Read active wallet */
  getWallet(): WalletInterFaceAPI | null {
    return walletManager.wallet;
  },

  /** Simple helpers */
  async getAddress(): Promise<string> {
    const w = walletManager.wallet;
    if (!w) throw new Error("Trustware.wallet not configured");
    return w.getAddress();
  },

  // ---- REST methods (re-export) ----
  buildRoute,
  submitReceipt,
  getStatus,
  pollStatus,
  getBalances,
  getBalancesByAddress,
  useChains,
  useTokens,

  // ---- Tx helpers ----
  sendRouteTransaction,
  runTopUp,
};

export type TrustwareCore = typeof Trustware;
