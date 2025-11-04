/* core/index.ts */
import type {
  TrustwareConfigOptions,
  ResolvedTrustwareConfig,
  WalletInterFaceAPI,
} from "../types";
import { TrustwareConfigStore } from "../config/store";
import { walletManager } from "../wallets/manager";
import { buildRoute, submitReceipt, getStatus, pollStatus } from "./routes";
import { getBalances } from "./balances";
import { sendRouteTransaction, runTopUp } from "./tx";

export const Trustware = {
  /** Initialize config */
  init(cfg: TrustwareConfigOptions) {
    TrustwareConfigStore.init(cfg);
    return Trustware;
  },

  /** Attach a wallet interface directly (skips detection) */
  useWallet(w: WalletInterFaceAPI) {
    walletManager.attachWallet(w);
    return Trustware;
  },

  /** Best-effort background attach to detected wallet(s) (detection hook should be running in the app) */
  async autoDetect(_timeoutMs = 400) {
    await walletManager.autoAttach();
    return walletManager.wallet != null;
  },

  /** Read resolved config */
  getConfig(): ResolvedTrustwareConfig {
    return TrustwareConfigStore.get();
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

  // ---- Tx helpers ----
  sendRouteTransaction,
  runTopUp,
};

export type TrustwareCore = typeof Trustware;
