// Wallet identifiers for popular wallets
export type WalletId =
  | "metamask"
  | "coinbase"
  | "walletconnect"
  | "rainbow"
  | "phantom-evm"
  | "rabby"
  | "brave"
  | "okx"
  | "zerion"
  | "taho"
  | "safe"
  | "imtoken"
  | "trust"
  | "bitget"
  | "kucoin";

// Wallet categories for grouping
export type WalletCategory = "injected" | "walletconnect" | "app";

// Metadata about a wallet provider for display and detection purposes
export type WalletMeta = {
  id: WalletId;
  name: string;
  category: WalletCategory;
  // Local path preferred; fallback to CDN or emoji via `emoji` field
  logo: string; // e.g. "/assets/wallets/metamask.svg"
  emoji?: string;
  homepage?: string;
  chromeWebStore?: string;
  android?: string; // Play Store
  ios?: string; // App Store
  // Mobile deep link (use `formatDeepLink` below to inject current URL)
  deepLink?: (currentUrl: string) => string;
  // Heuristics for detection (legacy EIP-1193) on window.ethereum
  detectFlags?: string[]; // checks like `isMetaMask`, `isCoinbaseWallet`, etc.
};

export type EIP1193 = {
  request(args: { method: string; params?: any[] | object }): Promise<any>;
};

// Details of a provider detected via EIP-6963 standard including metadata and supported methods/events
export type EIP6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string; // data URL or URL
    rdns?: string; // reverse-DNS id (e.g., io.metamask)
    version?: string;
    wallets?: { name: string; version?: string }[]; // for aggregators
    features?: string[]; // e.g., ['signTypedData', 'eth_sendTransaction']
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any; // EIP-1193 Provider
  methods: string[];
  events: string[];
};

// Detected wallet with metadata and detection method
export type DetectedWallet = {
  meta: WalletMeta;
  via: "eip6963" | "injected-flag" | "walletconnect";
  detail?: EIP6963ProviderDetail;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider?: any;
};

// Comprehensive wallet interface with transaction sending capabilities
// and support for either EIP-1193 or Wagmi standards
export type WalletInterFaceAPI = {
  getAddress(): Promise<string>;
  getChainId(): Promise<number>;
  switchChain(chainId: number): Promise<void>;
} & (
  | {
      type: "eip1193";
      request(args: { method: string; params?: any[] | object }): Promise<any>;
    }
  | {
      type: "wagmi";
      sendTransaction(tx: {
        to: `0x${string}`;
        data: `0x${string}`;
        value?: bigint;
        chainId?: number;
      }): Promise<{ hash: `0x${string}` }>;
    }
);

// A simplified wallet interface without transaction sending capabilities
export type SimpleWalletInterface = {
  getAddress(): Promise<string>;
  getChainId(): Promise<number>;
  switchChain(chainId: number): Promise<void>;
};
