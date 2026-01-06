import type { WalletInterFaceAPI, DetectedWallet, EIP1193 } from "../types/";
import { useEIP1193, useWagmi } from "./eipWallets";

export { useEIP1193, useWagmi };

export function toWalletInterfaceFromDetected(
  dw: DetectedWallet
): WalletInterFaceAPI {
  if (!dw?.provider) throw new Error("No provider on detected wallet");
  const eth = dw.provider as EIP1193;
  return useEIP1193(eth);
}
