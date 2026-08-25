// src/index.ts
export { Trustware, TrustwareCore } from "./core";
export { RateLimitError } from "./core/http";
export {
  RouteError,
  isRouteError,
  parseRouteError,
  formatMinimum,
  RouteDeclineCode,
  RouteFailureCode,
  RouteErrorCode,
} from "./core";
export type { RouteProviderOutcome, RouteErrorFacts } from "./core";
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
  useEIP1193,
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
