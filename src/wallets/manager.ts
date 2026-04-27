import type {
  DetectedWallet,
  WalletInterFaceAPI,
  SimpleWalletInterface,
  WalletIdentityAddress,
} from "../types";
import type { WagmiBridge } from "./bridges";
import { connectDetectedWallet } from "./connect";
import { useWalletDetection } from "./detect"; // you can also inline detect() if you want non-react
import { IdentityStore, buildWalletIdentityAddress } from "../identity";
import { bindSolanaProviderEvents } from "./solana";

type Status = "idle" | "detecting" | "connecting" | "connected" | "error";
type Listener = (s: Status) => void;

class WalletManager {
  private _status: Status = "idle";
  private _wallet: WalletInterFaceAPI | null = null;
  private _detected: DetectedWallet[] = [];
  private _listeners = new Set<Listener>();
  private _error: unknown;
  private _identity = new IdentityStore();
  private _providerCleanup: (() => void) | null = null;
  private _connectedWalletId: string | null = null;

  get status() {
    return this._status;
  }
  get error() {
    return this._error;
  }
  get detected(): DetectedWallet[] {
    return this._detected;
  }
  get wallet(): WalletInterFaceAPI | null {
    return this._wallet;
  }
  get simple(): SimpleWalletInterface | null {
    if (!this._wallet) return null;
    const { getAddress, disconnect } = this._wallet;
    return { getAddress, disconnect };
  }
  get identity() {
    return this._identity.snapshot;
  }
  get connectedWalletId() {
    return this._connectedWalletId;
  }

  onChange(fn: Listener) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
  private emit() {
    for (const fn of this._listeners) fn(this._status);
  }

  /** Provide detection results (from your hook or custom function). */
  setDetected(list: DetectedWallet[]) {
    this._detected = list;
  }

  /** Optional: auto attach to the first/best detected wallet. */
  async autoAttach(opts?: {
    wagmi?: WagmiBridge;
    pick?: (list: DetectedWallet[]) => DetectedWallet | undefined;
  }) {
    if (!this._detected.length) return;
    const target = (opts?.pick ?? ((l) => l[0]))(this._detected);
    if (!target) return;
    await this.connectDetected(target, opts);
  }

  async connectDetected(
    target: DetectedWallet,
    opts?: { wagmi?: WagmiBridge }
  ) {
    if (
      this._status === "connected" &&
      this._connectedWalletId === target.meta.id &&
      this._wallet
    ) {
      this.emit();
      return;
    }

    this._status = "connecting";
    this.clearConnectedWalletState();
    this.emit();
    try {
      const { api, error } = await connectDetectedWallet(target, {
        wagmi: opts?.wagmi,
      });
      if (api && !error) {
        this._wallet = api;
        this._connectedWalletId = target.meta.id;
        this.bindProviderEvents(target);
        await this.syncIdentityFromWallet(target.meta.id);
      }

      if (error) this._error = error;
      this._status = "connected";
      return { error: error, api };
    } catch (e) {
      // console.log("AN error occuresd", e);
      this._error = e;
      this._status = "error";
      this.clearConnectedWalletState();
    } finally {
      this.emit();
    }
  }

  async disconnect(wagmi?: WagmiBridge) {
    if (wagmi) await wagmi.disconnect().catch(() => {});
    if (this._wallet?.disconnect) {
      await this._wallet.disconnect().catch(() => {});
    }
    this.clearConnectedWalletState();
    this._status = "idle";
    this.emit();
  }

  /** Directly attach a pre-provided wallet interface (from old provider prop). */
  attachWallet(api: WalletInterFaceAPI) {
    this.clearConnectedWalletState();
    this._wallet = api;
    this._connectedWalletId = null;
    this._status = "connected";
    void this.syncIdentityFromWallet();
    this.emit();
  }

  /** Optional helper to set explicit status (e.g., "initializing" UX). */
  setStatus(s: Status) {
    this._status = s;
    this.emit();
  }

  addIdentityAddress(address: WalletIdentityAddress) {
    this._identity.upsert(address);
  }

  resolveAddressForChain(chain: Parameters<IdentityStore["resolve"]>[0]) {
    return this._identity.resolve(chain);
  }

  private clearProviderCleanup() {
    this._providerCleanup?.();
    this._providerCleanup = null;
  }

  private clearConnectedWalletState() {
    this.clearProviderCleanup();
    this._wallet = null;
    this._connectedWalletId = null;
  }

  private bindProviderEvents(target: DetectedWallet) {
    if (!target.provider) return;

    if (target.via === "solana-window") {
      this._providerCleanup = bindSolanaProviderEvents(target.provider, {
        onConnect: () => {
          this._status = "connected";
          void this.syncIdentityFromWallet(target.meta.id);
          this.emit();
        },
        onAccountChanged: () => {
          void this.syncIdentityFromWallet(target.meta.id);
          this.emit();
        },
        onDisconnect: () => {
          this.clearConnectedWalletState();
          this._status = "idle";
          this.emit();
        },
      });
      return;
    }

    const provider = target.provider as {
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      off?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        listener: (...args: unknown[]) => void
      ) => void;
    };
    const onAccountsChanged = (accounts?: unknown) => {
      const nextAccounts = Array.isArray(accounts) ? accounts : [];
      if (nextAccounts.length === 0) {
        this.clearConnectedWalletState();
        this._status = "idle";
        this.emit();
        return;
      }
      this._status = "connected";
      void this.syncIdentityFromWallet(target.meta.id);
      this.emit();
    };
    const onDisconnect = () => {
      this.clearConnectedWalletState();
      this._status = "idle";
      this.emit();
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("disconnect", onDisconnect);
    this._providerCleanup = () => {
      provider.off?.("accountsChanged", onAccountsChanged);
      provider.off?.("disconnect", onDisconnect);
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("disconnect", onDisconnect);
    };
  }

  private async syncIdentityFromWallet(providerId?: string) {
    if (!this._wallet) return;
    try {
      const address = await this._wallet.getAddress();
      const chain =
        this._wallet.ecosystem === "evm"
          ? { chainId: String(await this._wallet.getChainId()), type: "evm" }
          : {
              chainId: "solana-mainnet-beta",
              networkIdentifier: "solana-mainnet-beta",
              type: "solana",
            };
      const identityAddress = buildWalletIdentityAddress({
        address,
        chain,
        source: "provider",
        providerId,
      });
      if (identityAddress) {
        this._identity.upsert(identityAddress);
      }
    } catch {
      // identity sync is best-effort
    }
  }
}

export const walletManager = new WalletManager();

/* ---------- Optional tiny React hook to feed detection into the manager ---------- */
import { useEffect } from "react";

/** If you’re in React, call this once near your widget to push detection results into the manager. */
export function useWireDetectionIntoManager() {
  const { detected } = useWalletDetection(); // your existing hook
  useEffect(() => {
    walletManager.setDetected(detected);
  }, [detected]);
}
