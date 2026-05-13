/* core/index.ts */
import type {
  TrustwareConfigOptions,
  ResolvedTrustwareConfig,
  WalletInterFaceAPI,
} from "../types";
import { TrustwareConfigStore } from "../config/store";
import { walletManager } from "../wallets";
import {
  buildRoute,
  buildDepositAddress,
  submitReceipt,
  getStatus,
  pollStatus,
} from "./routes";
import {
  getBalances,
  getBalancesByAddress,
  getBalancesByAddressStream,
} from "./balances";
import { sendRouteTransaction, runTopUp } from "./tx";
import { validateSdkAccess } from "./http";
import { useChains } from "./useChains";
import { useTokens } from "./useTokens";
import { TrustwareError } from "../errors/TrustwareError";
import { TrustwareErrorCode } from "../errors/errorCodes";
import {
  validateAddressForChain,
  validateRouteAddresses,
} from "../validation/address";

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

  setDestinationChain(chain: string) {
    const prev = TrustwareConfigStore.get();
    TrustwareConfigStore.update({
      routes: {
        ...prev.routes,
        toChain: chain,
      },
    });
    return Trustware;
  },

  setDestinationToken(token: string) {
    const prev = TrustwareConfigStore.get();
    TrustwareConfigStore.update({
      routes: {
        ...prev.routes,
        toToken: token,
      },
    });
    return Trustware;
  },

  /** Read active wallet */
  getWallet(): WalletInterFaceAPI | null {
    return walletManager.wallet;
  },

  getIdentity() {
    return walletManager.identity;
  },

  resolveAddressForChain(
    chain: Parameters<typeof walletManager.resolveAddressForChain>[0]
  ) {
    return walletManager.resolveAddressForChain(chain);
  },

  addIdentityAddress(
    address: Parameters<typeof walletManager.addIdentityAddress>[0]
  ) {
    walletManager.addIdentityAddress(address);
    return Trustware;
  },

  /** Simple helpers */
  async getAddress(): Promise<string> {
    const w = walletManager.wallet;
    if (!w) throw new Error("Trustware.wallet not configured");
    return w.getAddress();
  },

  // ---- REST methods (re-export) ----
  buildRoute,
  buildDepositAddress,
  submitReceipt,
  getStatus,
  pollStatus,
  getBalances,
  getBalancesByAddress,
  getBalancesByAddressStream,
  useChains,
  useTokens,
  validateAddressForChain,
  validateRouteAddresses,

  // ---- Tx helpers ----
  sendRouteTransaction,
  runTopUp,
};

export type TrustwareCore = typeof Trustware;
