// constants.ts
declare const __SDK_VERSION__: string;
declare const __API_ROOT__: string;
declare const __GTM_ID__: string;
declare const __WALLETCONNECT_PROJECT_ID__: string;

export const SDK_NAME = "@trustware/sdk";
export const SDK_VERSION: string = __SDK_VERSION__;
export const API_ROOT: string = __API_ROOT__;
export const GTM_ID: string = __GTM_ID__;
export const API_PREFIX = "/api";

// Assets base URL for wallet logos and other static assets
export const ASSETS_BASE_URL = "https://app.trustware.io";

// WalletConnect Cloud project ID — injected at build time from
// TRUSTWARE_WALLETCONNECT_PROJECT_ID. Empty string disables WalletConnect.
export const WALLETCONNECT_PROJECT_ID: string = __WALLETCONNECT_PROJECT_ID__;
