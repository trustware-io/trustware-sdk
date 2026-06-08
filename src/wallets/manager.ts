import type {
  DetectedWallet,
  WalletInterFaceAPI,
  SimpleWalletInterface,
  WalletIdentityAddress,
  WalletConnectConfig,
} from "../types";
import type { WagmiBridge } from "./bridges";
import { connectDetectedWallet } from "./connect";
import { useWalletDetection } from "./detect";
import { IdentityStore, buildWalletIdentityAddress } from "../identity";
import { bindSolanaProviderEvents } from "./solana";
import {
  evmChains,
  getUniversalConnector,
  resetUniversalConnector,
} from "src/config/walletconnect";
import { useCallback, useEffect, useSyncExternalStore } from "react";

type Status = "idle" | "detecting" | "connecting" | "connected" | "error";
type ConnectedVia = "extension" | "walletconnect" | "direct" | null;
type Listener = (s: Status) => void;

export interface WalletSnapshot {
  status: Status;
  connectedVia: ConnectedVia;
  walletType: "walletconnect" | "other";
  error: string | null;
  detected: DetectedWallet[];
  wallet: WalletInterFaceAPI | null;
  simple: SimpleWalletInterface | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  identity: ReturnType<any>;
  connectedWalletId: string | null;
  address: string | null;
  isConnected: boolean;
}

function getChainMeta(chainId: number) {
  const chain = evmChains.find((c) => c.id === chainId);
  if (!chain) throw new Error(`Chain ${chainId} not configured`);
  return {
    chainId: `0x${chainId.toString(16)}`,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls.default.http,
  };
}

async function buildWalletConnectAPI(
  walletCfg: WalletConnectConfig | undefined
): Promise<WalletInterFaceAPI> {
  const connector = await getUniversalConnector(walletCfg);
  const provider = connector.provider;

  const api: WalletInterFaceAPI = {
    ecosystem: "evm",
    type: "eip1193",

    async getAddress() {
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      if (!accounts?.[0])
        throw new Error("No account connected via WalletConnect");
      return accounts[0];
    },

    async getChainId() {
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      return parseInt(hex, 16);
    },

    async switchChain(chainId: number) {
      const hexChainId = `0x${chainId.toString(16)}`;
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        });
      } catch (err: unknown) {
        const code = (err as { code?: number })?.code;
        if (code === 4902) {
          const chainMeta = getChainMeta(chainId);
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [chainMeta],
          });
        } else {
          throw err;
        }
      }
    },

    async request(args) {
      return provider.request(args);
    },

    async disconnect() {
      await connector.disconnect().catch(() => {});
    },
  };

  return api;
}

function bindWalletConnectEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: ReturnType<any>,
  callbacks: {
    onAccountsChanged: (accounts: string[]) => void;
    onChainChanged: (chainId: string) => void;
    onDisconnect: () => void;
  }
): () => void {
  const onAccountsChanged = (accounts: unknown) => {
    const list = Array.isArray(accounts) ? (accounts as string[]) : [];
    callbacks.onAccountsChanged(list);
  };
  const onChainChanged = (chainId: unknown) => {
    callbacks.onChainChanged(String(chainId));
  };
  const onDisconnect = () => {
    callbacks.onDisconnect();
  };

  provider.on?.("accountsChanged", onAccountsChanged);
  provider.on?.("chainChanged", onChainChanged);
  provider.on?.("disconnect", onDisconnect);

  return () => {
    provider.removeListener?.("accountsChanged", onAccountsChanged);
    provider.removeListener?.("chainChanged", onChainChanged);
    provider.removeListener?.("disconnect", onDisconnect);
  };
}

class WalletManager {
  private _status: Status = "idle";
  private _connectedVia: ConnectedVia = null;
  private _wallet: WalletInterFaceAPI | null = null;
  private _detected: DetectedWallet[] = [];
  private _listeners = new Set<Listener>();
  private _error: string | null = null;
  private _identity = new IdentityStore();
  private _providerCleanup: (() => void) | null = null;
  private _connectedWalletId: string | null = null;
  private _address: string | null = null;
  private _onExternalDisconnectCallback: (() => void) | null = null;
  private _snapshot: WalletSnapshot | null = null;

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
  get connectedVia(): ConnectedVia {
    return this._connectedVia;
  }
  get connectedWalletId() {
    return this._connectedWalletId;
  }
  get address(): string | null {
    return this._address;
  }
  get isConnected(): boolean {
    return this._status === "connected";
  }

  get walletType(): "walletconnect" | "other" {
    return this._connectedVia === "walletconnect" ? "walletconnect" : "other";
  }

  get simple(): SimpleWalletInterface | null {
    if (!this._wallet) return null;
    const { getAddress, disconnect } = this._wallet;
    return { getAddress, disconnect };
  }

  get identity() {
    return this._identity.snapshot;
  }

  get snapshot(): WalletSnapshot {
    if (!this._snapshot) {
      this._snapshot = this.buildSnapshot();
    }
    return this._snapshot;
  }

  private buildSnapshot(): WalletSnapshot {
    return {
      status: this._status,
      connectedVia: this._connectedVia,
      walletType: this.walletType,
      error: this._error,
      detected: this._detected,
      wallet: this._wallet,
      simple: this.simple,
      identity: this.identity,
      connectedWalletId: this._connectedWalletId,
      address: this._address,
      isConnected: this.isConnected,
    };
  }

  onChange(fn: Listener) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private emit() {
    this._snapshot = null;
    for (const fn of this._listeners) fn(this._status);
  }

  onExternalDisconnect(cb: () => void): () => void {
    this._onExternalDisconnectCallback = cb;
    return () => {
      if (this._onExternalDisconnectCallback === cb) {
        this._onExternalDisconnectCallback = null;
      }
    };
  }

  private triggerExternalDisconnect() {
    this._onExternalDisconnectCallback?.();
  }

  setDetected(list: DetectedWallet[]) {
    this._detected = list;
  }

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
      this._connectedVia === "extension" &&
      this._connectedWalletId === target.meta.id &&
      this._wallet
    ) {
      this.emit();
      return;
    }

    this._status = "connecting";
    this.clearConnectedState();
    this.emit();

    try {
      const { api, error } = await connectDetectedWallet(target, {
        wagmi: opts?.wagmi,
      });

      if (api && !error) {
        this._wallet = api;
        this._connectedVia = "extension";
        this._connectedWalletId = target.meta.id;
        this.bindExtensionProviderEvents(target);
        await this.syncIdentityFromWallet(target.meta.id);
        this._status = "connected";
        this._error = null;
        return { error: null, api };
      }

      if (error) {
        this._status = "error";
        this._error = error;
        return { error, api };
      }
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
      this._status = "error";
      this.clearConnectedState();
    } finally {
      this.emit();
    }
  }

  async connectWalletConnect(walletCfg?: WalletConnectConfig) {
    if (
      this._status === "connected" &&
      this._connectedVia === "walletconnect" &&
      this._wallet
    ) {
      this.emit();
      return { error: null, api: this._wallet };
    }

    this._status = "connecting";
    this.clearConnectedState();
    this.emit();

    try {
      const connector = await getUniversalConnector(walletCfg);
      await connector.connect();

      const api = await buildWalletConnectAPI(walletCfg);
      this._wallet = api;
      this._connectedVia = "walletconnect";
      this._connectedWalletId = "walletconnect";

      const provider = connector.provider;
      this._providerCleanup = bindWalletConnectEvents(provider, {
        onAccountsChanged: (accounts) => {
          if (accounts.length === 0) {
            this.fullReset();
            this.triggerExternalDisconnect();
            this.emit();
            return;
          }
          void this.syncIdentityFromWallet("walletconnect");
          this.emit();
        },
        onChainChanged: () => {
          void this.syncIdentityFromWallet("walletconnect");
          this.emit();
        },
        onDisconnect: () => {
          // User disconnected from inside their mobile wallet
          this.fullReset();
          resetUniversalConnector();
          this.triggerExternalDisconnect();
          this.emit();
        },
      });

      await this.syncIdentityFromWallet("walletconnect");
      this._status = "connected";
      this._error = null;
      this.emit();
      return { error: null, api };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this._error = message;
      this._status = "error";
      this.clearConnectedState();
      this.emit();
      return { error: message, api: null };
    }
  }

  async disconnect(wagmi?: WagmiBridge) {
    if (wagmi && this._connectedVia === "extension") {
      await wagmi.disconnect().catch(() => {});
    }

    if (this._wallet?.disconnect) {
      await this._wallet.disconnect().catch(() => {});
    }

    if (this._connectedVia === "walletconnect") {
      resetUniversalConnector();
    }

    this.fullReset();
    this.emit();
  }

  attachWallet(api: WalletInterFaceAPI) {
    this.clearConnectedState();
    this._wallet = api;
    this._connectedVia = "direct";
    this._connectedWalletId = null;
    this._status = "connected";
    void this.syncIdentityFromWallet();
    this.emit();
  }

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

  private clearConnectedState() {
    this.clearProviderCleanup();
    this._wallet = null;
    this._connectedVia = null;
    this._connectedWalletId = null;
  }

  private fullReset() {
    this.clearConnectedState();
    this._address = null;
    this._identity = new IdentityStore();
    this._status = "idle";
    this._error = null;
  }

  private bindExtensionProviderEvents(target: DetectedWallet) {
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
          this.fullReset();
          this.triggerExternalDisconnect();
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
        this.fullReset();
        this.triggerExternalDisconnect();
        this.emit();
        return;
      }
      this._status = "connected";
      void this.syncIdentityFromWallet(target.meta.id);
      this.emit();
    };

    const onDisconnect = () => {
      this.fullReset();
      this.triggerExternalDisconnect();
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

      // Cache address for synchronous reads via .address getter
      this._address = address;

      const chain =
        this._wallet.ecosystem === "evm"
          ? { chainId: String(await this._wallet.getChainId()), type: "evm" }
          : this._wallet.ecosystem === "solana"
            ? {
                chainId: "solana-mainnet-beta",
                networkIdentifier: "solana-mainnet-beta",
                type: "solana",
              }
            : {
                chainId: "bip122:000000000019d6689c085ae165831e93",
                networkIdentifier: "bitcoin-mainnet",
                type: "bitcoin",
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
      // {???/?}
    }
  }
}

export const walletManager = new WalletManager();

export function useWireDetectionIntoManager() {
  const { detected } = useWalletDetection();
  useEffect(() => {
    walletManager.setDetected(detected);
  }, [detected]);
}

export function useWalletConnectConnect(walletCfg?: WalletConnectConfig) {
  const cfgRef = { current: walletCfg };
  return useCallback(
    () => walletManager.connectWalletConnect(cfgRef.current),
    []
  );
}

export function useWalletInfo(wagmi?: WagmiBridge) {
  const snapshot = useSyncExternalStore(
    (cb) => walletManager.onChange(cb),
    () => walletManager.snapshot,
    () => walletManager.snapshot
  );

  const disconnect = useCallback(async () => {
    await walletManager.disconnect(wagmi);
  }, []);

  return {
    walletMetaId: snapshot.connectedWalletId,
    address: snapshot.address,
    isConnected: snapshot.isConnected,
    connectedVia: snapshot.connectedVia,
    walletType: snapshot.walletType,
    status: snapshot.status,
    disconnect,
  };
}

export function useWalletExternalDisconnect(cb: () => void) {
  useEffect(() => {
    return walletManager.onExternalDisconnect(cb);
  }, []);
}
