// src/index.ts
export { Trustware, TrustwareCore } from "./core";
export { RateLimitError } from "./core/http";
export {
  connectDetectedWallet,
  useWalletDetection,
  useWireDetectionIntoManager,
  WagmiBridge,
  WagmiConnector,
  useEIP1193,
  useWagmi,
  toWalletInterfaceFromDetected,
} from "./wallets/";
export { TrustwareWidget } from "./widget/";
export { TrustwareProvider, useTrustware } from "./provider";
export * from "./types";
export * from "./constants";
