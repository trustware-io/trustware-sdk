/* core/index.ts */
import type {
  TrustwareConfigOptions,
  ResolvedTrustwareConfig,
  WalletInterFaceAPI,
  TrustwareTheme,
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

  /**
   * Read the SDK's currently configured theme mode.
   *
   * Returns the raw setting — `"light" | "dark" | "system"` — i.e. whatever
   * was last passed to `init()` or `setTheme()`. When the mode is `"system"`,
   * the widget resolves the actual light/dark appearance itself (from the OS
   * `prefers-color-scheme`, or a saved preference if the user has used the
   * widget's built-in theme toggle), so this getter still reports `"system"`
   * rather than the resolved value.
   */
  getTheme(): TrustwareTheme {
    return TrustwareConfigStore.get().theme;
  },

  /**
   * Set the widget's theme at runtime.
   *
   * Call this from your own app's theme toggle to keep an embedded
   * `TrustwareWidget` in sync with your UI — no remount required, any
   * mounted widget picks up the change immediately.
   *
   * Passing `"light"` or `"dark"` pins the widget to that mode. Passing
   * `"system"` makes it follow the OS preference again — unless the user
   * previously used the widget's own in-widget theme toggle, in which case
   * their saved choice takes precedence until they toggle it again.
   *
   * @example
   * // In your app's own dark-mode toggle handler:
   * Trustware.setTheme(isDark ? "dark" : "light");
   */
  setTheme(theme: TrustwareTheme) {
    TrustwareConfigStore.update({ theme });
    return Trustware;
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
