import type { WalletInterFaceAPI, DetectedWallet, EIP1193 } from "../types/";
import { useEIP1193, useWagmi } from "./eipWallets";
import { toSolanaWalletInterface } from "./solana";

export { useEIP1193, useWagmi };

export function toWalletInterfaceFromDetected(
  dw: DetectedWallet
): WalletInterFaceAPI {
  if (!dw?.provider) throw new Error("No provider on detected wallet");
  if (dw.via === "solana-window" || dw.meta.ecosystem === "solana") {
    return toSolanaWalletInterface(dw.provider);
  }
  const eth = dw.provider as EIP1193;
  return useEIP1193(eth);
}
