/**
 * WalletConnect adapter with lazy loading to minimize bundle impact.
 * Only imports @walletconnect/ethereum-provider when actually connecting.
 */

import type { ResolvedWalletConnectConfig } from "../types/config";
import type { WalletInterFaceAPI, EIP1193 } from "../types/wallets";
import { TrustwareConfigStore } from "../config/store";

// Tiny event emitter for WalletConnect events
type WCEventType = "display_uri" | "connect" | "disconnect" | "error";
type WCListener = (data: unknown) => void;

class WalletConnectEvents {
  private listeners = new Map<WCEventType, Set<WCListener>>();

  on(event: WCEventType, fn: WCListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off(event: WCEventType, fn: WCListener) {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: WCEventType, data: unknown) {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  clear() {
    this.listeners.clear();
  }
}

export const walletConnectEvents = new WalletConnectEvents();

// Singleton provider instance (cached after first connection)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wcProvider: any = null;
let isConnecting = false;

/**
 * Check if WalletConnect is available.
 * WalletConnect is enabled by default (built-in project ID), unless explicitly disabled.
 */
export function isWalletConnectConfigured(): boolean {
  try {
    const cfg = TrustwareConfigStore.get();
    // WalletConnect is enabled by default - check if it wasn't disabled
    return cfg.walletConnect !== undefined;
  } catch {
    // Config not initialized yet - WalletConnect will be available once initialized
    return true; // Optimistically return true since WC is enabled by default
  }
}

/**
 * Get the WalletConnect config from the SDK config store
 */
export function getWalletConnectConfig(): ResolvedWalletConnectConfig | null {
  try {
    const cfg = TrustwareConfigStore.get();
    return cfg.walletConnect ?? null;
  } catch {
    return null;
  }
}

/**
 * Lazy-load and initialize WalletConnect provider
 * Returns null if dependencies are missing or config is not set
 */
async function initWalletConnectProvider(): Promise<EIP1193 | null> {
  const config = getWalletConnectConfig();
  if (!config) {
    console.warn(
      "[Trustware SDK] WalletConnect not configured. Add walletConnect.projectId to your config."
    );
    return null;
  }

  try {
    // Lazy import WalletConnect provider
    // This is a dynamic import that will fail gracefully if the package is not installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let EthereumProvider: any;
    try {
      const wcModule = await import(
        /* webpackIgnore: true */
        "@walletconnect/ethereum-provider"
      );
      EthereumProvider = wcModule.EthereumProvider;
    } catch {
      console.error(
        "[Trustware SDK] @walletconnect/ethereum-provider not installed. " +
          "Install it with: npm install @walletconnect/ethereum-provider"
      );
      throw new Error(
        "WalletConnect dependencies not installed. Run: npm install @walletconnect/ethereum-provider"
      );
    }

    const provider = await EthereumProvider.init({
      projectId: config.projectId,
      chains: config.chains,
      optionalChains: config.optionalChains,
      metadata: config.metadata,
      relayUrl: config.relayUrl,
      showQrModal: false, // We render our own QR modal
    });

    // Forward WalletConnect events
    provider.on("display_uri", (uri: string) => {
      walletConnectEvents.emit("display_uri", uri);
    });

    provider.on("connect", () => {
      walletConnectEvents.emit("connect", null);
    });

    provider.on("disconnect", () => {
      walletConnectEvents.emit("disconnect", null);
      wcProvider = null;
    });

    return provider as EIP1193;
  } catch (err) {
    console.error("[Trustware SDK] Failed to initialize WalletConnect:", err);
    walletConnectEvents.emit("error", err);
    return null;
  }
}

/**
 * Connect via WalletConnect
 * Emits 'display_uri' event with QR code URI for custom modal
 */
export async function connectWalletConnect(): Promise<WalletInterFaceAPI | null> {
  if (isConnecting) {
    console.warn("[Trustware SDK] WalletConnect connection already in progress");
    return null;
  }

  isConnecting = true;

  try {
    // Reuse existing provider if available and connected
    if (wcProvider?.connected) {
      return wrapWalletConnectProvider(wcProvider);
    }

    const provider = await initWalletConnectProvider();
    if (!provider) {
      return null;
    }

    // Store the provider
    wcProvider = provider;

    // Initiate connection - this will emit 'display_uri' event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (provider as any).connect();

    return wrapWalletConnectProvider(provider);
  } catch (err) {
    console.error("[Trustware SDK] WalletConnect connection failed:", err);
    walletConnectEvents.emit("error", err);
    wcProvider = null;
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnect WalletConnect session
 */
export async function disconnectWalletConnect(): Promise<void> {
  if (!wcProvider) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (wcProvider as any).disconnect();
  } catch (err) {
    console.warn("[Trustware SDK] WalletConnect disconnect error:", err);
  } finally {
    wcProvider = null;
    walletConnectEvents.emit("disconnect", null);
  }
}

/**
 * Get the current WalletConnect provider (if connected)
 */
export function getWalletConnectProvider(): EIP1193 | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return wcProvider?.connected ? (wcProvider as any) : null;
}

/**
 * Check if WalletConnect is currently connected
 */
export function isWalletConnectConnected(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(wcProvider as any)?.connected;
}

/**
 * Wrap WalletConnect provider in WalletInterFaceAPI
 */
function wrapWalletConnectProvider(provider: EIP1193): WalletInterFaceAPI {
  return {
    type: "eip1193",
    async getAddress(): Promise<string> {
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      if (!accounts.length) {
        const requested = (await provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        return requested[0];
      }
      return accounts[0];
    },
    async getChainId(): Promise<number> {
      const chainId = (await provider.request({
        method: "eth_chainId",
      })) as string;
      return parseInt(chainId, 16);
    },
    async switchChain(chainId: number): Promise<void> {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    },
    request: provider.request.bind(provider),
  };
}
