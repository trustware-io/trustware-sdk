// Host-built Solana wallets against the built typings
// (signed off 2026-10-16: onAccepted on sendSerializedTransaction).
import { Trustware } from "@trustware/sdk";
import type { SolanaWalletInterface } from "@trustware/sdk";

declare function hostSignAndSend(base64: string): Promise<string>;

// A wallet written before onAccepted existed still fits: it ignores the
// option, and the SDK posts the receipt when it returns.
export const legacyWallet: SolanaWalletInterface = {
  ecosystem: "solana",
  type: "solana",
  getAddress: async () => "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  getChainKey: async () => "solana-mainnet-beta",
  sendSerializedTransaction: (base64: string) => hostSignAndSend(base64),
};

// A wallet that reports acceptance early, before confirmation.
export const reportingWallet: SolanaWalletInterface = {
  ...legacyWallet,
  async sendSerializedTransaction(base64, _chainId, options) {
    const signature = await hostSignAndSend(base64);
    options?.onAccepted?.(signature);
    return signature;
  },
};

Trustware.useWallet(reportingWallet);

export const wrongCallback: SolanaWalletInterface = {
  ...legacyWallet,
  sendSerializedTransaction: async (_b, _c, options) => {
    // @ts-expect-error onAccepted takes the signature string
    options?.onAccepted?.(42);
    return "sig";
  },
};
