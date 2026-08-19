export type ChainMeta = {
  id: string; // e.g. "43114"
  networkIdentifier: string; // e.g. "avalanche"
  nativeCurrency: { symbol: string; decimals: number; name: string };
};

export type TokenMeta = {
  chainId: string; // "43114"
  address: `0x${string}`;
  symbol: string; // e.g. "USDC.e"
  decimals: number;
  visible?: boolean;
  active?: boolean;
};

export type BalanceRow = {
  chain_key: string;
  category: "native" | "erc20" | "spl" | "btc";
  contract?: string;
  address?: string;
  symbol?: string;
  decimals: number;
  balance: string;
  name?: string;
  logoURI?: string;
  usdPrice?: number;
};

export type WalletAddressBalanceWrapper = {
  chain_id: string;
  balances: BalanceRow[];
  count: number;
  error: string | null;
  source: string;
};

export type TokenPageOptions = {
  cursor?: string;
  limit?: number;
  q?: string;
};

export type TokenPageInfo = {
  hasNextPage: boolean;
  nextCursor?: string;
};

export type TokenPageResult = {
  data: TokenDef[];
  pageInfo: TokenPageInfo;
};

/**
 * Terminal state of an address balance scan.
 *
 * `partial` is the one field a caller cannot reconstruct from the chunks: the
 * backend scans every configured chain and reports `partial: true` when any of
 * them failed, so "no balance on chain X" and "we could not reach chain X" look
 * identical in the rows themselves. Rendering an empty wallet off a partial
 * scan is the failure this exists to prevent.
 */
export type BalanceStreamSummary = {
  address: string;
  partial: boolean;
  /** Chains that reported a result — equal to `total` on a complete scan. */
  completed: number;
  total: number;
  /** Server-side scan duration. Absent on the buffered path, which does not report it. */
  elapsedMs?: number;
};

export type BalanceStreamOptions = {
  stream?: boolean;
  signal?: AbortSignal;
  strict?: boolean;
  /**
   * Called once per scan with its terminal state, on the streamed and buffered
   * paths alike — including when a stream fails and falls back — so a consumer
   * can trust `partial` without knowing which path served it.
   */
  onSummary?: (summary: BalanceStreamSummary) => void;
};

export type GetBalancesOptions = {
  /** Bypass the in-memory balance cache and re-fetch fresh data from the network. */
  forceRefresh?: boolean;
};

export type ChainType = "evm" | "cosmos" | "solana" | "btc" | string;

export interface NativeCurrency {
  symbol: string;
  name?: string;
  decimals?: number;
  icon?: string;
}

export interface ChainDef {
  /** API commonly sends both. We canonicalize on chainId as string. */
  chainId: string | number;
  id?: string | number;

  /** Keys we use to resolve chains from presets / user input */
  networkIdentifier?: string; // e.g. "avalanche", "optimism", "linea"
  axelarChainName?: string; // e.g. "Avalanche", "optimism", "linea"
  networkName?: string; // e.g. "Avalanche", "Linea"

  /** UI/availability flags */
  enabled?: boolean;
  visible?: boolean;
  isTestnet?: boolean;

  /** Display */
  chainIconURI?: string;
  nativeCurrency?: NativeCurrency;

  /** Kinds (some payloads use both) */
  type?: ChainType;
  chainType?: ChainType;

  /** Nice-to-have extras we won't rely on but keep for completeness */
  blockExplorerUrls?: string[];
  rpc?: string;
  rpcList?: string[];
}

export type TokenType = "evm" | "solana" | "btc" | string;

export interface TokenDef {
  /** Core identity */
  address: string;
  chainId: string | number;

  /** Display */
  logoURI?: string; // NOTE: was 'logoUR' in your snippet — fixed the typo
  name: string;
  symbol: string;

  /** Behavior / filtering */
  decimals: number;
  active?: boolean;
  visible?: boolean;
  type: TokenType;

  /** Optional metadata */
  usdPrice?: number;
  coingeckoId?: string;
  createdBy?: string;
  subGraphIds?: string[];
  subGraphOnly?: boolean;
}

export type TokenWithBalance = TokenDef & { balance?: bigint };
