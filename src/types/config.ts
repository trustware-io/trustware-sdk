import { TrustwareError } from "src/errors/TrustwareError";
import { TrustwareTheme, TrustwareWidgetMessages } from "./theme";
import { TrustwareEvent } from "src/events/events";
import { Transaction } from "./routes";

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

/** Destination/source route defaults. Required in "deposit" mode; optional (and only
 * partially meaningful) in "swap" mode, where chains/tokens are chosen entirely in-widget. */
export type RoutesConfig = {
  toChain: string; // Default destination chain
  toToken: string; // Default destination token
  fromToken?: string; // Default source token (optional)
  fromChain?: string; // Default source chain (optional)
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

type CommonConfigOptions = {
  apiKey: string; // Required API key for authentication
  autoDetectProvider?: boolean; // Whether to auto-detect wallet provider (optional, default: false.)
  theme?: TrustwareTheme; // "light" | "dark" | "system" (default: "system")
  messages?: Partial<TrustwareWidgetMessages>; // Optional message customization
  retry?: RetryConfig; // Optional retry configuration for rate-limited requests
  walletConnect?: WalletConnectConfig; // Optional WalletConnect configuration
  features?: FeatureFlags; // Optional feature rollout controls

  onError?: (error: TrustwareError) => void;
  onSuccess?: (transaction: Transaction) => void;
  onEvent?: (event: TrustwareEvent) => void;
};

export type TrustwareConfigOptions = CommonConfigOptions &
  (
    | {
        /** Default mode: bridge/top-up to a preconfigured destination chain+token. */
        mode?: "deposit";
        routes: RoutesConfig;
      }
    | {
        /** Swap mode: from/to chain+token are chosen entirely in-widget; `routes` is not required. */
        mode: "swap";
        routes?: Partial<RoutesConfig>;
      }
  );

export type ResolvedTrustwareConfig = {
  apiKey: string;
  mode: "deposit" | "swap";
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
  theme: TrustwareTheme;
  messages: TrustwareWidgetMessages;
  retry: ResolvedRetryConfig;
  walletConnect?: ResolvedWalletConnectConfig | WalletConnectConfig | undefined;
  features: ResolvedFeatureFlags;
  onError?: (error: TrustwareError) => void;
  onSuccess?: (transaction: Transaction) => void;
  onEvent?: (event: TrustwareEvent) => void;
};

/** A token identified by contract address + chain ID. Used for swap mode configuration. */
export type SwapTokenRef = {
  /** EVM contract address (or native placeholder, e.g. "0xeeee...") */
  address: string;
  /** Numeric chain ID, e.g. 8453 for Base */
  chainId: number;
};

export type FeatureFlags = {
  tokensPagination?: boolean;
  balanceStreaming?: boolean;
  shouldAllowGA4?: boolean;
  /**
   * @deprecated Use top-level `mode: "swap"` on `TrustwareConfigOptions` instead. Still
   * supported for backward compatibility and treated as equivalent to `mode: "swap"`.
   */
  swapMode?: boolean;
  /**
   * Pre-selects the destination token in swap mode. When set, the widget opens
   * with this token already chosen as the "buy" side.
   * Example: `{ address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chainId: 8453 }` (Base USDC)
   */
  swapDefaultDestToken?: SwapTokenRef;
  /**
   * When true (and `swapDefaultDestToken` is set), the destination token is fixed
   * and the user cannot change it. The "select token to buy" button is disabled.
   */
  swapLockDestToken?: boolean;
  /**
   * Restricts the destination ("buy") token selector to only these tokens. The user
   * can still sell any token from their wallet; only the buy side is limited.
   * Each entry is a token address + chain ID pair. When omitted, all tokens are selectable.
   * Example: `[{ address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1 }]`
   */
  swapAllowedDestTokens?: SwapTokenRef[];
};

export type ResolvedFeatureFlags = {
  tokensPagination: boolean;
  balanceStreaming: boolean;
  shouldAllowGA4: boolean;
  swapMode: boolean;
  swapDefaultDestToken: SwapTokenRef | null;
  swapLockDestToken: boolean;
  swapAllowedDestTokens: SwapTokenRef[] | null;
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

/**
 * Rate limit *observability*. Retry timing itself is not configurable: the
 * limit is enforced server-side per API key, so the only retry schedule that
 * can actually succeed is the one the server dictates through Retry-After.
 * Tuning it client-side could only make requests fail sooner or hammer a
 * limit that is already closed — see RETRY_POLICY.
 */
export type RetryConfig = {
  /** Callback when rate limit info is received from server */
  onRateLimitInfo?: (info: RateLimitInfo) => void;
  /** Callback when rate limit is hit (429 received) */
  onRateLimited?: (info: RateLimitInfo, retryCount: number) => void;
  /** Callback when remaining requests fall below threshold */
  onRateLimitApproaching?: (info: RateLimitInfo, threshold: number) => void;
  /** Threshold for onRateLimitApproaching callback (default: 5) */
  approachingThreshold?: number;
};

export type ResolvedRetryConfig = {
  approachingThreshold: number;
  onRateLimitInfo?: (info: RateLimitInfo) => void;
  onRateLimited?: (info: RateLimitInfo, retryCount: number) => void;
  onRateLimitApproaching?: (info: RateLimitInfo, threshold: number) => void;
};

export const DEFAULT_RETRY_CONFIG: ResolvedRetryConfig = {
  approachingThreshold: 5,
};

/**
 * Fixed retry schedule for 429 responses. Not integrator-configurable — the
 * rate limit is enforced server-side per API key, so these are the values that
 * work against it and nothing a client sets can widen the limit.
 *
 * The server limits on a fixed window and reports the remaining wait in
 * Retry-After, so that value is the only one that lands in the next window;
 * BASE_DELAY_MS is the blind fallback for when the header is unreadable.
 * MAX_DELAY_MS caps how long a call may block: past it the SDK stops early and
 * throws RateLimitError carrying retryAfter, so a payment UI can say "try
 * again in N seconds" instead of sitting on a spinner for a minute.
 */
export const RETRY_POLICY = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 10_000,
} as const;

export const DEFAULT_FEATURE_FLAGS: ResolvedFeatureFlags = {
  tokensPagination: true,
  balanceStreaming: false,
  shouldAllowGA4: true,
  swapMode: false,
  swapDefaultDestToken: null,
  swapLockDestToken: false,
  swapAllowedDestTokens: null,
};
