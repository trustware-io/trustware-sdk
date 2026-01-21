import { TrustwareWidgetTheme, TrustwareWidgetMessages } from "./theme";

/** WalletConnect configuration options (all optional - SDK has built-in defaults) */
export type WalletConnectConfig = {
  /** Override the built-in WalletConnect project ID (optional - SDK includes one) */
  projectId?: string;
  /** Chain IDs to support (defaults to [1] for Ethereum mainnet) */
  chains?: number[];
  /** Optional chain IDs (chains that can be switched to) */
  optionalChains?: number[];
  /** dApp metadata shown in wallet */
  metadata?: {
    name: string;
    description?: string;
    url: string;
    icons?: string[];
  };
  /** Custom relay URL (defaults to WalletConnect's relay) */
  relayUrl?: string;
  /** Whether to show our custom QR modal (default: true) */
  showQrModal?: boolean;
  /** Disable WalletConnect entirely (default: false) */
  disabled?: boolean;
};

/** Resolved WalletConnect config with defaults applied */
export type ResolvedWalletConnectConfig = {
  projectId: string;
  chains: number[];
  optionalChains: number[];
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  relayUrl?: string;
  showQrModal: boolean;
};

export type TrustwareConfigOptions = {
  apiKey: string; // Required API key for authentication
  routes: {
    toChain: string; // Default destination chain
    toToken: string; // Default destination token
    fromToken?: string; // Default source token (optional)
    fromAddress?: string; // Default source address (optional)
    toAddress?: string; // Default destination address (optional; can be updated later via Trustware.setDestinationAddress)
    defaultSlippage?: number; // Default slippage percentage (optional) defautts to 1
    options?: {
      routeRefreshMs?: number; // Route refresh interval in milliseconds (optional)
      fixedFromAmount?: string | number;
      minAmountOut?: string | number;
      maxAmountOut?: string | number;
    };
  };
  autoDetectProvider?: boolean; // Whether to auto-detect wallet provider (optional, default: false.)
  theme?: TrustwareWidgetTheme; // Optional theme customization
  messages?: Partial<TrustwareWidgetMessages>; // Optional message customization
  rateLimit?: RateLimitConfig; // Optional rate limit configuration
  walletConnect?: WalletConnectConfig; // Optional WalletConnect configuration
};

export type ResolvedTrustwareConfig = {
  apiKey: string;
  routes: {
    toChain: string;
    toToken: string;
    fromToken?: string;
    fromAddress?: string;
    toAddress?: string;
    defaultSlippage: number; // resolved
    options: {
      routeRefreshMs?: number;
      fixedFromAmount?: string | number;
      minAmountOut?: string | number;
      maxAmountOut?: string | number;
    };
  };
  autoDetectProvider: boolean;
  theme: TrustwareWidgetTheme;
  messages: TrustwareWidgetMessages;
  rateLimit: ResolvedRateLimitConfig;
  walletConnect?: ResolvedWalletConnectConfig; // Optional WalletConnect config
};

export const DEFAULT_SLIPPAGE = 1; // Default slippage percentage
export const DEFAULT_AUTO_DETECT_PROVIDER = false; // Default auto-detect provider setting

// Rate limit types for SDK rate limit handling
export type RateLimitInfo = {
  /** Maximum requests allowed in the current window */
  limit: number;
  /** Requests remaining in the current window */
  remaining: number;
  /** Unix timestamp when the rate limit window resets */
  reset: number;
  /** Seconds until rate limit resets (only present on 429 responses) */
  retryAfter?: number;
};

export type RateLimitConfig = {
  /** Enable automatic retry on 429 responses (default: true) */
  enabled?: boolean;
  /** Maximum number of retries on 429 (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Callback when rate limit info is received */
  onRateLimitInfo?: (info: RateLimitInfo) => void;
  /** Callback when rate limit is hit (429 received) */
  onRateLimited?: (info: RateLimitInfo, retryCount: number) => void;
  /** Callback when remaining requests fall below threshold */
  onRateLimitApproaching?: (info: RateLimitInfo, threshold: number) => void;
  /** Threshold for onRateLimitApproaching callback (default: 5) */
  approachingThreshold?: number;
};

export type ResolvedRateLimitConfig = {
  enabled: boolean;
  maxRetries: number;
  baseDelayMs: number;
  approachingThreshold: number;
  onRateLimitInfo?: (info: RateLimitInfo) => void;
  onRateLimited?: (info: RateLimitInfo, retryCount: number) => void;
  onRateLimitApproaching?: (info: RateLimitInfo, threshold: number) => void;
};

export const DEFAULT_RATE_LIMIT_CONFIG: ResolvedRateLimitConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelayMs: 1000,
  approachingThreshold: 5,
};
