import { TrustwareConfigStore } from "./config/store";
import type {
  ChainDef,
  TokenDef,
  TokenPageOptions,
  TokenPageResult,
} from "./types/";
import {
  getNativeTokenAddress,
  normalizeAddress,
  normalizeChainKey,
  normalizeChainType,
} from "./utils/chains";

export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_CACHE_LIMIT = 100;

type CachedTokenPage = TokenPageResult & { storedAt: number };

function getChainAliases(chain: ChainDef): string[] {
  const values = [
    chain.chainId,
    chain.id,
    chain.networkIdentifier,
    chain.axelarChainName,
    chain.networkName,
  ];
  return values.map((value) => normalizeChainKey(value)).filter(Boolean);
}

function tokenKey(token: TokenDef): string {
  return `${normalizeChainKey(token.chainId)}:${token.address.toLowerCase()}`;
}

function parseTokenPage(payload: unknown): TokenPageResult {
  if (Array.isArray(payload)) {
    return {
      data: payload as TokenDef[],
      pageInfo: { hasNextPage: false },
    };
  }

  const parsed = (payload ?? {}) as {
    data?: TokenDef[];
    results?: TokenDef[];
    tokens?: TokenDef[];
    pageInfo?: { hasNextPage?: boolean; nextCursor?: string };
    pagination?: { hasNextPage?: boolean; nextCursor?: string };
    nextCursor?: string;
    hasNextPage?: boolean;
  };

  const data = parsed.data ?? parsed.results ?? parsed.tokens ?? [];
  const info = parsed.pageInfo ?? parsed.pagination;
  return {
    data: Array.isArray(data) ? data : [],
    pageInfo: {
      hasNextPage:
        info?.hasNextPage ?? parsed.hasNextPage ?? Boolean(info?.nextCursor),
      nextCursor: info?.nextCursor ?? parsed.nextCursor,
    },
  };
}

function normalizeToken(token: TokenDef): TokenDef {
  return {
    ...token,
    chainId: token.chainId,
  };
}

export class Registry {
  private _chainsById = new Map<string, ChainDef>();
  private _chainAliases = new Map<string, string>();
  private _tokensByChain = new Map<string, TokenDef[]>();
  private _tokensByChainKey = new Map<string, Map<string, TokenDef>>();
  private _pageCache = new Map<string, CachedTokenPage>();
  private _loaded = false;
  private _chainsLoaded = false;
  private _loadingPromise: Promise<void> | null = null;
  private _chainsLoadingPromise: Promise<void> | null = null;

  constructor(private baseURL: string) {}

  async ensureLoaded() {
    if (this._loaded) return;
    if (this._loadingPromise) {
      await this._loadingPromise;
      return;
    }

    this._loadingPromise = this.loadAllTokens();
    try {
      await this._loadingPromise;
    } finally {
      this._loadingPromise = null;
    }
  }

  async ensureChainsLoaded() {
    if (this._chainsLoaded) return;
    if (this._chainsLoadingPromise) {
      await this._chainsLoadingPromise;
      return;
    }

    this._chainsLoadingPromise = this.loadChains();
    try {
      await this._chainsLoadingPromise;
    } finally {
      this._chainsLoadingPromise = null;
    }
  }

  private get config() {
    return TrustwareConfigStore.get();
  }

  private emitPageLoaded(
    chainRef: string | number,
    query: string | undefined,
    result: TokenPageResult,
    cursor?: string
  ) {
    this.config.onEvent?.({
      type: "token_page_loaded",
      chainRef: String(chainRef),
      query,
      count: result.data.length,
      hasNextPage: result.pageInfo.hasNextPage,
      cursor,
    });
  }

  private emitPageError(
    chainRef: string | number,
    query: string | undefined,
    cursor: string | undefined,
    error: unknown
  ) {
    const message = error instanceof Error ? error.message : String(error);
    this.config.onEvent?.({
      type: "token_page_error",
      chainRef: String(chainRef),
      query,
      cursor,
      message,
    });
  }

  private storeChain(chain: ChainDef) {
    const canonical = chain?.chainId ?? chain?.id;
    if (canonical == null) return;
    const normalized: ChainDef = {
      ...chain,
      id: chain.id ?? canonical,
      chainId: chain.chainId ?? canonical,
    };
    const canonicalKey = normalizeChainKey(canonical);
    this._chainsById.set(canonicalKey, normalized);
    for (const alias of getChainAliases(normalized)) {
      this._chainAliases.set(alias, canonicalKey);
    }
  }

  private storeTokenForAlias(chainKey: string, token: TokenDef) {
    const key = tokenKey(token);
    const existingByKey = this._tokensByChainKey.get(chainKey) ?? new Map();
    existingByKey.set(key, token);
    this._tokensByChainKey.set(chainKey, existingByKey);
    this._tokensByChain.set(chainKey, Array.from(existingByKey.values()));
  }

  private storeToken(token: TokenDef) {
    const chainRef = token?.chainId;
    if (chainRef == null) return;
    const normalized = normalizeToken(token);
    const resolvedChain = this.chain(chainRef);
    const aliases = resolvedChain
      ? getChainAliases(resolvedChain)
      : [normalizeChainKey(chainRef)];
    for (const alias of aliases) {
      this.storeTokenForAlias(alias, normalized);
    }
  }

  private async loadChains() {
    const chainsRes = await fetch(`${this.baseURL}/v1/routes/chains`, {
      headers: { Accept: "application/json", "X-API-Key": this.config.apiKey },
    });
    if (!chainsRes.ok) throw new Error(`chains: HTTP ${chainsRes.status}`);

    const chains = await chainsRes.json();
    const chainsArr: ChainDef[] = Array.isArray(chains)
      ? chains
      : (chains.data ?? []);

    for (const chain of chainsArr) {
      this.storeChain(chain);
    }

    this._chainsLoaded = true;
  }

  private async loadAllTokens() {
    await this.ensureChainsLoaded();

    const tokensRes = await fetch(`${this.baseURL}/v1/routes/tokens`, {
      headers: { Accept: "application/json", "X-API-Key": this.config.apiKey },
    });
    if (!tokensRes.ok) throw new Error(`tokens: HTTP ${tokensRes.status}`);

    const tokens = await tokensRes.json();
    const tokensArr: TokenDef[] = Array.isArray(tokens)
      ? tokens
      : (tokens.data ?? []);
    for (const token of tokensArr) {
      this.storeToken(token);
    }

    this._loaded = true;
  }

  private prunePageCache() {
    const now = Date.now();
    for (const [key, value] of this._pageCache.entries()) {
      if (now - value.storedAt > PAGE_CACHE_TTL_MS) {
        this._pageCache.delete(key);
      }
    }

    while (this._pageCache.size > PAGE_CACHE_LIMIT) {
      const oldestKey = this._pageCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this._pageCache.delete(oldestKey);
    }
  }

  private pageCacheKey(
    chainRef: string | number,
    opts: TokenPageOptions = {}
  ): string {
    const chain = this.chain(chainRef);
    const canonical = normalizeChainKey(chain?.chainId ?? chainRef);
    return `${canonical}::${opts.q ?? ""}::${opts.limit ?? ""}::${opts.cursor ?? ""}`;
  }

  private filterTokens(
    tokens: TokenDef[],
    chainRef: string | number,
    query?: string
  ): TokenDef[] {
    const normalizedChain = normalizeChainKey(chainRef);
    const normalizedQuery = query?.trim().toLowerCase();
    return tokens.filter((token) => {
      if (normalizeChainKey(token.chainId) !== normalizedChain) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        token.symbol?.toLowerCase().includes(normalizedQuery) ||
        token.name?.toLowerCase().includes(normalizedQuery) ||
        token.address?.toLowerCase().includes(normalizedQuery)
      );
    });
  }

  chains(): ChainDef[] {
    return Array.from(this._chainsById.values());
  }

  chain(chainRef: string | number): ChainDef | undefined {
    const normalized = normalizeChainKey(chainRef);
    const canonicalKey = this._chainAliases.get(normalized) ?? normalized;
    return this._chainsById.get(canonicalKey);
  }

  allTokens(): TokenDef[] {
    const unique = new Map<string, TokenDef>();
    for (const list of this._tokensByChain.values()) {
      for (const token of list) {
        unique.set(tokenKey(token), token);
      }
    }
    return Array.from(unique.values());
  }

  tokens(chainRef: string | number): TokenDef[] {
    return this._tokensByChain.get(normalizeChainKey(chainRef)) ?? [];
  }

  async tokensPage(
    chainRef: string | number,
    opts: TokenPageOptions = {}
  ): Promise<TokenPageResult> {
    await this.ensureChainsLoaded();

    if (!this.config.features.tokensPagination) {
      await this.ensureLoaded();
      const all = this.filterTokens(this.allTokens(), chainRef, opts.q);
      const start = opts.cursor ? Number(opts.cursor) || 0 : 0;
      const limit = opts.limit ?? all.length;
      const data = all.slice(start, start + limit);
      return {
        data,
        pageInfo: {
          hasNextPage: start + limit < all.length,
          nextCursor:
            start + limit < all.length ? String(start + limit) : undefined,
        },
      };
    }

    const cacheKey = this.pageCacheKey(chainRef, opts);
    const cached = this._pageCache.get(cacheKey);
    if (cached && Date.now() - cached.storedAt <= PAGE_CACHE_TTL_MS) {
      return { data: cached.data, pageInfo: cached.pageInfo };
    }

    const chain = this.chain(chainRef);
    const chainKey = normalizeChainKey(chain?.chainId ?? chainRef);
    const url = new URL(`${this.baseURL}/v1/routes/tokens`);
    url.searchParams.set("chainId", chainKey);
    if (opts.cursor) url.searchParams.set("cursor", opts.cursor);
    if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));
    if (opts.q) url.searchParams.set("q", opts.q);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "X-API-Key": this.config.apiKey,
        },
      });

      if (!res.ok) {
        throw new Error(`tokens page: HTTP ${res.status}`);
      }

      const parsed = parseTokenPage(await res.json());
      const deduped = new Map<string, TokenDef>();
      for (const token of parsed.data) {
        const normalized = normalizeToken(token);
        this.storeToken(normalized);
        deduped.set(tokenKey(normalized), normalized);
      }

      const result = {
        data: Array.from(deduped.values()),
        pageInfo: parsed.pageInfo,
      };

      this._pageCache.set(cacheKey, { ...result, storedAt: Date.now() });
      this.prunePageCache();
      this.emitPageLoaded(chainRef, opts.q, result, opts.cursor);
      return result;
    } catch (error) {
      this.emitPageError(chainRef, opts.q, opts.cursor, error);
      await this.ensureLoaded();
      const fallback = this.filterTokens(this.allTokens(), chainRef, opts.q);
      return {
        data: fallback,
        pageInfo: { hasNextPage: false },
      };
    }
  }

  async *iterateTokens(
    chainRef: string | number,
    opts: Omit<TokenPageOptions, "cursor"> = {}
  ): AsyncGenerator<TokenPageResult, void, void> {
    let cursor: string | undefined;
    do {
      const page = await this.tokensPage(chainRef, { ...opts, cursor });
      yield page;
      cursor = page.pageInfo.nextCursor;
      if (!page.pageInfo.hasNextPage) {
        break;
      }
    } while (cursor);
  }

  findToken(chainRef: string | number, address: string): TokenDef | undefined {
    const chain = this.chain(chainRef);
    const chainType = normalizeChainType(chain);
    const normalizedAddress = normalizeAddress(address, chainType);
    return this.tokens(chainRef).find((token) => {
      return normalizeAddress(token.address, chainType) === normalizedAddress;
    });
  }

  resolveToken(
    chainRef: string | number,
    input?: string | null
  ): string | undefined {
    if (!input) return undefined;
    const s = String(input).trim();
    const chain = this.chain(chainRef);
    const chainType = normalizeChainType(chain);

    if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s;
    if (chainType === "solana" && s.length > 20) return s;

    const nativeAddress = getNativeTokenAddress(chainType);
    const nativeSymbol = chain?.nativeCurrency?.symbol?.toUpperCase?.();
    if (
      (nativeSymbol && s.toUpperCase() === nativeSymbol) ||
      ["ETH", "MATIC", "AVAX", "BNB", "SOL", "NATIVE"].includes(s.toUpperCase())
    ) {
      return chainType === "solana" ? nativeAddress : NATIVE;
    }

    const hit = this.tokens(chainRef).find((token) => {
      if (!token.symbol) return false;
      return token.symbol.toUpperCase() === s.toUpperCase();
    });
    if (hit) return hit.address;

    return s;
  }
}
