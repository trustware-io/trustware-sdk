// constants.ts
declare const __SDK_VERSION__: string;

export const SDK_NAME = "@trustware/sdk";
export const SDK_VERSION: string = __SDK_VERSION__;
export const API_ROOT = "https://api.trustware.io";
export const API_PREFIX = "/api";

// Assets base URL for wallet logos and other static assets
export const ASSETS_BASE_URL = "https://app.trustware.io";

// WalletConnect Cloud project ID - built into the SDK for seamless wallet connections
// This is a public identifier (not a secret) registered with WalletConnect Cloud
export const WALLETCONNECT_PROJECT_ID = "4ead125c-63be-4b1a-a835-cef2dce67b84";
