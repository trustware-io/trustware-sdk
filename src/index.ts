// src/index.ts
export { Trustware, TrustwareCore } from "./core";
export { RateLimitError } from "./core/http";
export { assertValidPostHook } from "./core";
export type { BuildRouteBody, BuildRouteResponse } from "./core";
export { useWalletTokenState } from "src/widget/state/deposit/useWalletTokenState";
export type { YourTokenData } from "src/widget/state/deposit/types";
export {
  connectDetectedWallet,
  useWalletDetection,
  useWireDetectionIntoManager,
  WagmiBridge,
  WagmiConnector,
  createEIP1193Wallet,
  useEIP1193,
  createWagmiWallet,
  useWagmi,
  toWalletInterfaceFromDetected,
  useWalletInfo,
  useWalletExternalDisconnect,
  walletManager,
  WALLETS,
  POPULAR_ORDER,
} from "./wallets/";
export { TrustwareWidget } from "./widget/";
export { TrustwareProvider, useTrustware } from "./provider";
export { TrustwareError } from "./errors/TrustwareError";
export * from "./identity";
export * from "./validation/address";
export * from "./types";
export * from "./constants";
