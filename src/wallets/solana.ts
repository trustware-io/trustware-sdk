import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";

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

function decodeBase64Transaction(serializedTransaction: string) {
  const bytes = decodeBase64(serializedTransaction);
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

export function getSolanaProviders(): Partial<Record<WalletId, SolanaProviderLike>> {
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
  return SOLANA_WALLET_IDS.flatMap((walletId) => {
    const provider = providers[walletId];
    const meta = wallets.find((item) => item.id === walletId);
    if (!provider || !meta) return [];
    return [{ meta, provider, via: "solana-window" as const }];
  });
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
      rpcUrl?: string
    ) {
      const transaction = decodeBase64Transaction(serializedTransactionBase64);

      if (provider.signAndSendTransaction) {
        const result = await provider.signAndSendTransaction(transaction, {
          preflightCommitment: "confirmed",
        });

        if (typeof result === "string") return result;
        if (result?.signature) return result.signature;
      }

      if (!provider.signTransaction) {
        throw new Error("Connected Solana wallet cannot sign transactions");
      }

      const signed = await provider.signTransaction(transaction);
      const connection = new Connection(
        rpcUrl?.trim() || "https://api.mainnet-beta.solana.com",
        "confirmed"
      );
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
  };
}
