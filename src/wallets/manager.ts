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
    this._status = "connecting";
    this.emit();
    try {
      const { api } = await connectDetectedWallet(target, {
        wagmi: opts?.wagmi,
      });
      if (api) {
        this.clearProviderCleanup();
        this._wallet = api;
        this.bindProviderEvents(target);
        await this.syncIdentityFromWallet(target.meta.id);
      }
      this._status = "connected";
    } catch (e) {
      this._error = e;
      this._status = "error";
    } finally {
      this.emit();
    }
  }

  async disconnect(wagmi?: WagmiBridge) {
    if (wagmi) await wagmi.disconnect().catch(() => {});
    if (this._wallet?.disconnect) {
      await this._wallet.disconnect().catch(() => {});
    }
    this.clearProviderCleanup();
    this._wallet = null;
    this._status = "idle";
    this.emit();
  }

  /** Directly attach a pre-provided wallet interface (from old provider prop). */
  attachWallet(api: WalletInterFaceAPI) {
    this.clearProviderCleanup();
    this._wallet = api;
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

  private bindProviderEvents(target: DetectedWallet) {
    if (target.via !== "solana-window" || !target.provider) return;
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
        this._wallet = null;
        this._status = "idle";
        this.emit();
      },
    });
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
