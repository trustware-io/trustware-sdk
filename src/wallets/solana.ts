import { getSolanaTxStatus, sendSolanaSerialized } from "../core/sdkRpc";

import type {
  DetectedWallet,
  SolanaProviderLike,
  SolanaWalletInterface,
  WalletId,
  WalletMeta,
} from "../types";

type SolanaEventHandlers = {
  onConnect?: () => void;
  onAccountChanged?: () => void;
  onDisconnect?: () => void;
};

const SOLANA_WALLET_IDS: WalletId[] = [
  "phantom-solana",
  "solflare",
  "backpack",
];

// CAIP-2 chain ID for Solana mainnet — used by the Wallet Standard
const SOLANA_MAINNET_CHAIN = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// Minimal base58 encoder for Solana transaction signatures (64 bytes → ~88 chars)
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

// ── Wallet Standard types (subset we need — no npm dependency required) ──────

type WalletStandardAccount = {
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
  features: readonly string[];
};

type WalletStandardWallet = {
  name: string;
  icon: string;
  chains: readonly string[];
  features: Record<
    string,
    {
      version?: string;
      connect?: (opts?: {
        silent?: boolean;
      }) => Promise<{ accounts: WalletStandardAccount[] }>;
      disconnect?: () => Promise<void>;
      signTransaction?: (params: {
        account: WalletStandardAccount;
        transaction: Uint8Array;
        chain?: string;
      }) => Promise<{ signedTransaction: Uint8Array }[]>;
      signAndSendTransaction?: (params: {
        account: WalletStandardAccount;
        transaction: Uint8Array;
        chain?: string;
        options?: Record<string, unknown>;
      }) => Promise<{ signature: Uint8Array }[]>;
    }
  >;
  accounts: readonly WalletStandardAccount[];
};

/**
 * Synchronously collect all wallets currently registered in the Wallet Standard
 * registry, and prompt any that haven't announced yet.
 */
type WalletStandardRegisterAPI = {
  register(...wallets: WalletStandardWallet[]): () => void;
};

function collectWalletStandardWallets(): WalletStandardWallet[] {
  if (typeof window === "undefined") return [];

  const collected: WalletStandardWallet[] = [];

  const api: WalletStandardRegisterAPI = {
    register(...wallets) {
      collected.push(...wallets);
      return () => {};
    },
  };

  // Tell wallets the app is ready — those already registered respond synchronously
  try {
    window.dispatchEvent(
      Object.assign(
        new Event("wallet-standard:app-ready", { bubbles: false }),
        {
          detail: api,
        }
      )
    );
  } catch {
    // non-fatal
  }

  return collected;
}

/**
 * Wrap a Wallet Standard wallet into the SolanaProviderLike shape our
 * existing toSolanaWalletInterface() adapter expects.
 */
function walletStandardToSolanaProvider(
  wallet: WalletStandardWallet
): SolanaProviderLike {
  let currentAccount: WalletStandardAccount | null = wallet.accounts[0] ?? null;

  const provider: SolanaProviderLike = {
    get isConnected() {
      return !!currentAccount;
    },
    get publicKey() {
      if (!currentAccount) return undefined;
      const addr = currentAccount.address;
      return { toString: () => addr };
    },

    async connect() {
      const feature = wallet.features["standard:connect"];
      if (!feature?.connect)
        throw new Error("Wallet Standard connect not available");
      const result = await feature.connect({ silent: false });
      currentAccount = result.accounts[0] ?? null;
      if (!currentAccount)
        throw new Error("No Solana account returned from MetaMask");
      return { publicKey: { toString: () => currentAccount!.address } };
    },

    async disconnect() {
      const feature = wallet.features["standard:disconnect"];
      await feature?.disconnect?.();
      currentAccount = null;
    },

    async signAndSendTransaction(transaction, options) {
      const feature = wallet.features["solana:signAndSendTransaction"];
      if (!feature?.signAndSendTransaction || !currentAccount) {
        throw new Error("signAndSendTransaction not available");
      }
      const txBytes = (transaction as { serialize(): Uint8Array }).serialize();
      const results = await feature.signAndSendTransaction({
        account: currentAccount,
        transaction: txBytes,
        chain: SOLANA_MAINNET_CHAIN,
        options: options as Record<string, unknown> | undefined,
      });
      const sig = results[0]?.signature;
      if (!sig) throw new Error("No signature returned");
      // Wallet Standard returns raw bytes; Solana expects base58
      return typeof sig === "string" ? sig : encodeBase58(sig);
    },

    async signTransaction(transaction) {
      const feature = wallet.features["solana:signTransaction"];
      if (!feature?.signTransaction || !currentAccount) {
        throw new Error("signTransaction not available");
      }
      const txBytes = (transaction as { serialize(): Uint8Array }).serialize();
      const results = await feature.signTransaction({
        account: currentAccount,
        transaction: txBytes,
        chain: SOLANA_MAINNET_CHAIN,
      });
      const signed = results[0]?.signedTransaction;
      if (!signed) throw new Error("No signed transaction returned");
      return { serialize: () => signed };
    },

    on() {},
    off() {},
    removeListener() {},
  };

  return provider;
}

/** Detect MetaMask's native Solana wallet via the Wallet Standard registry. */
function detectMetaMaskSolanaWallet(wallets: WalletMeta[]): DetectedWallet[] {
  const meta = wallets.find((w) => w.id === "metamask-solana");
  if (!meta) return [];

  const standardWallets = collectWalletStandardWallets();
  const mmWallet = standardWallets.find(
    (w) =>
      w.name.toLowerCase().includes("metamask") &&
      w.chains.some((c) => c.startsWith("solana:"))
  );
  if (!mmWallet) return [];

  return [
    {
      meta,
      provider: walletStandardToSolanaProvider(mmWallet),
      via: "solana-window" as const,
    },
  ];
}

function getPublicKeyString(provider?: SolanaProviderLike | null) {
  const publicKey = provider?.publicKey;
  if (!publicKey) return null;
  const text = publicKey.toString().trim();
  return text || null;
}

function decodeBase64(serializedTransaction: string) {
  const trimmed = serializedTransaction.trim();
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(trimmed, "base64"));
  }
  const binary = globalThis.atob(trimmed);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function decodeBase64Transaction(serializedTransaction: string) {
  const bytes = decodeBase64(serializedTransaction);
  const { Transaction, VersionedTransaction } = await import("@solana/web3.js");
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

function encodeBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

async function waitForSolanaConfirmation(chainId: string, signature: string) {
  const started = Date.now();
  const timeoutMs = 120000;
  const intervalMs = 2000;

  while (Date.now() - started < timeoutMs) {
    const status = await getSolanaTxStatus({ chainId, signature });
    if (status.status === "success") return signature;
    if (status.status === "failed") {
      throw new Error("Solana transaction failed");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for Solana transaction confirmation");
}

export function getSolanaProviders(): Partial<
  Record<WalletId, SolanaProviderLike>
> {
  if (typeof window === "undefined") return {};

  const win = window as typeof window & {
    solana?: SolanaProviderLike;
    phantom?: { solana?: SolanaProviderLike };
    solflare?: SolanaProviderLike;
    backpack?: { solana?: SolanaProviderLike };
  };

  const providers: Partial<Record<WalletId, SolanaProviderLike>> = {};
  const phantom =
    win.phantom?.solana ?? (win.solana?.isPhantom ? win.solana : undefined);
  const solflare =
    win.solflare ?? (win.solana?.isSolflare ? win.solana : undefined);
  const backpack =
    win.backpack?.solana ?? (win.solana?.isBackpack ? win.solana : undefined);

  if (phantom) providers["phantom-solana"] = phantom;
  if (solflare) providers.solflare = solflare;
  if (backpack) providers.backpack = backpack;

  return providers;
}

export function detectSolanaWallets(wallets: WalletMeta[]): DetectedWallet[] {
  const providers = getSolanaProviders();
  const windowDetected = SOLANA_WALLET_IDS.flatMap((walletId) => {
    const provider = providers[walletId];
    const meta = wallets.find((item) => item.id === walletId);
    if (!provider || !meta) return [];
    return [{ meta, provider, via: "solana-window" as const }];
  });

  return [...windowDetected, ...detectMetaMaskSolanaWallet(wallets)];
}

export function bindSolanaProviderEvents(
  provider: SolanaProviderLike,
  handlers: SolanaEventHandlers
) {
  const onConnect = () => handlers.onConnect?.();
  const onAccountChanged = () => handlers.onAccountChanged?.();
  const onDisconnect = () => handlers.onDisconnect?.();

  provider.on?.("connect", onConnect);
  provider.on?.("accountChanged", onAccountChanged);
  provider.on?.("disconnect", onDisconnect);

  return () => {
    provider.off?.("connect", onConnect);
    provider.off?.("accountChanged", onAccountChanged);
    provider.off?.("disconnect", onDisconnect);
    provider.removeListener?.("connect", onConnect);
    provider.removeListener?.("accountChanged", onAccountChanged);
    provider.removeListener?.("disconnect", onDisconnect);
  };
}

export function toSolanaWalletInterface(
  provider: SolanaProviderLike
): SolanaWalletInterface {
  return {
    ecosystem: "solana",
    type: "solana",
    async getAddress() {
      const current = getPublicKeyString(provider);
      if (current) return current;
      if (!provider.connect) {
        throw new Error("Selected Solana wallet cannot connect");
      }
      await provider.connect();
      const next = getPublicKeyString(provider);
      if (!next) throw new Error("No connected Solana address");
      return next;
    },
    async disconnect() {
      await provider.disconnect?.();
    },
    async getChainKey() {
      return "solana-mainnet-beta";
    },
    async sendSerializedTransaction(
      serializedTransactionBase64: string,
      chainId?: string
    ) {
      const transaction = await decodeBase64Transaction(
        serializedTransactionBase64
      );

      if (provider.signAndSendTransaction) {
        // skipPreflight: the wallet's own preflight simulation runs against
        // whatever RPC it happens to be pointed at, which frequently lags the
        // aggregator's RPC for freshly-built multi-hop routes (new/updated
        // address lookup tables, just-minted blockhash). A failed preflight
        // aborts the send locally with no broadcast and no on-chain trace —
        // exactly the intermittent "nothing broadcasted" failures seen here.
        // Skipping it defers validity checking to actual execution, which we
        // already verify via status polling after send.
        const MAX_INTERNAL_ERROR_ATTEMPTS = 3;
        const INTERNAL_ERROR_RETRY_DELAY_MS = 500;

        for (
          let attempt = 1;
          attempt <= MAX_INTERNAL_ERROR_ATTEMPTS;
          attempt++
        ) {
          try {
            const result = await provider.signAndSendTransaction(transaction, {
              skipPreflight: true,
            });

            if (typeof result === "string") return result;
            if (result?.signature) return result.signature;
            break;
          } catch (err) {
            // Solflare and Phantom both surface a generic -32603 "Internal
            // error" from their own extension-internal message dispatch —
            // confirmed (via stack trace) to originate inside the wallet's
            // own inpage script, not from Solana or our transaction content
            // (which simulates cleanly independently). This is a long-
            // standing, unresolved fault reported across wallets with no
            // known root cause; treated by the community as transient and
            // retry-worthy. Scoped narrowly to this exact code so unrelated
            // failures (user rejection, real simulation errors) still
            // surface immediately.
            const code = (err as { code?: number } | null | undefined)?.code;
            if (code === -32603 && attempt < MAX_INTERNAL_ERROR_ATTEMPTS) {
              await new Promise((resolve) =>
                setTimeout(resolve, INTERNAL_ERROR_RETRY_DELAY_MS * attempt)
              );
              continue;
            }
            throw err;
          }
        }
      }

      if (!provider.signTransaction) {
        throw new Error("Connected Solana wallet cannot sign transactions");
      }

      const signed = await provider.signTransaction(transaction);
      const resolvedChainId = chainId?.trim() || "solana-mainnet";
      const serializedSigned = encodeBase64(signed.serialize());
      const { signature } = await sendSolanaSerialized({
        chainId: resolvedChainId,
        serializedTransaction: serializedSigned,
      });
      await waitForSolanaConfirmation(resolvedChainId, signature);
      return signature;
    },
  };
}
