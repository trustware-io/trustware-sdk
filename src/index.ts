// src/index.ts
export { Trustware, TrustwareCore } from "./core";
export { connectDetectedWallet, useWalletDetection, useWireDetectionIntoManager, WagmiBridge, WagmiConnector } from "./wallets/";
export { TrustwareWidget } from "./widget/";
export { TrustwareProvider, useTrustware } from "./provider";
export * from "./types";
export * from "./constants";
