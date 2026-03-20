export * from "./bridges";
export * from "./connect";
export * from "./manager";
export * from "./adapters";
export * from "./solana";
export {
  useWalletDetection,
  useIsMobile,
  createWalletConnectEntry,
  buildDetectedWalletFromProvider,
} from "./detect";
export { autoDetectWallet } from "./eipWallets";
export { WALLETS, POPULAR_ORDER } from "./metadata";
export {
  formatDeepLink,
  formatWalletConnectDeepLink,
  formatWalletConnectDeepLinkForWallet,
} from "./deepLink";
// export {
//   connectWalletConnect,
//   disconnectWalletConnect,
//   getWalletConnectProvider,
//   isWalletConnectConfigured,
//   isWalletConnectConnected,
//   walletConnectEvents,
// } from "./walletconnect";
