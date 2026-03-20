import { getChainPopularityRank } from "./chainPopularity";

export interface TokenPopularitySortable {
  symbol?: string;
  name?: string;
  address?: string;
  balance?: string;
  chainId?: string | number;
}

/**
 * Mirrors frontend popularity ranking by symbol and well-known contracts.
 */
const POPULAR_TOKEN_SYMBOLS = new Set(
  [
    "USDC",
    "USDC.E",
    "USDBC",
    "USDT",
    "DAI",
    "ETH",
    "WETH",
    "WBTC",
    "BTC",
    "SOL",
    "MATIC",
  ].map((symbol) => symbol.toUpperCase())
);

const POPULAR_TOKEN_CONTRACTS = new Set([
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC (Ethereum)
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT (Ethereum)
  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI (Ethereum)
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC (Base)
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC (Polygon)
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC.e (Polygon)
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT (Polygon)
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC (Arbitrum)
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT (Arbitrum)
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // EVM native token marker
  "so11111111111111111111111111111111111111112", // Wrapped SOL
]);

function normalizeSymbol(symbol?: string): string {
  return (symbol ?? "").trim().toUpperCase();
}

function normalizeAddress(address?: string): string {
  return (address ?? "").trim().toLowerCase();
}

function hasPositiveBalance(balance?: string): boolean {
  if (!balance) return false;
  const trimmed = balance.trim();
  if (!trimmed) return false;

  if (/^[+-]?\d+$/.test(trimmed)) {
    try {
      return BigInt(trimmed) > 0n;
    } catch {
      return false;
    }
  }

  if (/^[+-]?\d*\.\d+$/.test(trimmed)) {
    const isNegative = trimmed.startsWith("-");
    if (isNegative) return false;

    const normalized = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
    const [whole, fraction = ""] = normalized.split(".");
    const wholeInt = whole ? BigInt(whole) : 0n;
    if (wholeInt > 0n) return true;
    return /[1-9]/.test(fraction);
  }

  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) && asNumber > 0;
}

export function isPopularToken(token: TokenPopularitySortable): boolean {
  const normalizedSymbol = normalizeSymbol(token.symbol);
  const normalizedAddress = normalizeAddress(token.address);

  return (
    POPULAR_TOKEN_SYMBOLS.has(normalizedSymbol) ||
    POPULAR_TOKEN_CONTRACTS.has(normalizedAddress)
  );
}

function compareText(a?: string, b?: string): number {
  return (a ?? "").localeCompare(b ?? "", undefined, {
    sensitivity: "base",
  });
}

function getGroupRank(token: TokenPopularitySortable): number {
  const popular = isPopularToken(token);
  const positiveBalance = hasPositiveBalance(token.balance);

  if (popular && positiveBalance) return 0; // Group A
  if (popular && !positiveBalance) return 1; // Group B
  if (!popular && positiveBalance) return 2; // Group C
  return 3; // Group D
}

function compareChainPopularity(
  a: TokenPopularitySortable,
  b: TokenPopularitySortable
): number {
  const rankA = getChainPopularityRank({ chainId: a.chainId });
  const rankB = getChainPopularityRank({ chainId: b.chainId });

  if (rankA !== null && rankB !== null && rankA !== rankB) {
    return rankA - rankB;
  }

  if (rankA !== null && rankB === null) return -1;
  if (rankA === null && rankB !== null) return 1;

  return 0;
}

export function sortTokensByPopularity<T extends TokenPopularitySortable>(
  tokens: T[]
): T[] {
  return tokens
    .map((token, index) => ({ token, index }))
    .sort((a, b) => {
      const rankDiff = getGroupRank(a.token) - getGroupRank(b.token);
      if (rankDiff !== 0) return rankDiff;

      const chainPopularityDiff = compareChainPopularity(a.token, b.token);
      if (chainPopularityDiff !== 0) return chainPopularityDiff;

      const symbolDiff = compareText(a.token.symbol, b.token.symbol);
      if (symbolDiff !== 0) return symbolDiff;

      const nameDiff = compareText(a.token.name, b.token.name);
      if (nameDiff !== 0) return nameDiff;

      const addressDiff = compareText(a.token.address, b.token.address);
      if (addressDiff !== 0) return addressDiff;

      // Stable deterministic tiebreaker for complete duplicates.
      return a.index - b.index;
    })
    .map(({ token }) => token);
}
