/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DetectedWallet,
  WalletInterFaceAPI,
  SimpleWalletInterface,
} from "../types";
import type { WagmiBridge } from "./bridges";
import { connectDetectedWallet } from "./connect";
import { useWalletDetection } from "./detect"; // you can also inline detect() if you want non-react

type Status = "idle" | "detecting" | "connecting" | "connected" | "error";
type Listener = (s: Status) => void;

class WalletManager {
  private _status: Status = "idle";
  private _wallet: WalletInterFaceAPI | null = null;
  private _detected: DetectedWallet[] = [];
  private _listeners = new Set<Listener>();
  private _error: unknown;

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
    const { getAddress, getChainId, switchChain } = this._wallet;
    return { getAddress, getChainId, switchChain };
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
    opts?: { wagmi?: WagmiBridge },
  ) {
    this._status = "connecting";
    this.emit();
    try {
      const { via, api } = await connectDetectedWallet(target, {
        wagmi: opts?.wagmi,
      });
      if (via === "eip1193") this._wallet = api!;
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
    this._wallet = null;
    this._status = "idle";
    this.emit();
  }

  /** Directly attach a pre-provided wallet interface (from old provider prop). */
  attachWallet(api: WalletInterFaceAPI) {
    this._wallet = api;
    this._status = "connected";
    this.emit();
  }

  /** Optional helper to set explicit status (e.g., "initializing" UX). */
  setStatus(s: Status) {
    this._status = s;
    this.emit();
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
