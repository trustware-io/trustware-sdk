/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRequire } from "module";
import type { WalletInterFaceAPI, DetectedWallet, EIP1193 } from "../types/";
export { useEIP1193, useWagmi } from "./eipWallets"; // <-- your old "src/wallet.ts" path

const require = createRequire(import.meta.url);

export function toWalletInterfaceFromDetected(
  dw: DetectedWallet
): WalletInterFaceAPI {
  if (!dw?.provider) throw new Error("No provider on detected wallet");
  const eth = dw.provider as EIP1193;
  // import locally to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useEIP1193 } = require("./eipWallets");
  return useEIP1193(eth);
}
