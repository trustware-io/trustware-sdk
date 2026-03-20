import { TrustwareConfigStore } from "./config/store";
import type { ChainDef, TokenDef } from "./types/";
import {
  getNativeTokenAddress,
  normalizeAddress,
  normalizeChainKey,
  normalizeChainType,
} from "./utils/chains";

export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

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

export class Registry {
  private _chainsById = new Map<string, ChainDef>();
  private _chainAliases = new Map<string, string>();
  private _tokensByChain = new Map<string, TokenDef[]>();
  private _loaded = false;
  private _loadingPromise: Promise<void> | null = null;

  constructor(private baseURL: string) {}

  async ensureLoaded() {
    if (this._loaded) return;
    if (this._loadingPromise) {
      await this._loadingPromise;
      return;
    }

    this._loadingPromise = this.load();
    try {
      await this._loadingPromise;
    } finally {
      this._loadingPromise = null;
    }
  }

  private storeToken(chainKey: string, token: TokenDef) {
    const list = this._tokensByChain.get(chainKey) ?? [];
    list.push(token);
    this._tokensByChain.set(chainKey, list);
  }

  private async load() {
    const cfg = TrustwareConfigStore.get();

    const [chainsRes, tokensRes] = await Promise.all([
      fetch(`${this.baseURL}/v1/routes/chains`, {
        headers: { Accept: "application/json", "X-API-Key": cfg.apiKey },
      }),
      fetch(`${this.baseURL}/v1/routes/tokens`, {
        headers: { Accept: "application/json", "X-API-Key": cfg.apiKey },
      }),
    ]);
    if (!chainsRes.ok) throw new Error(`chains: HTTP ${chainsRes.status}`);
    if (!tokensRes.ok) throw new Error(`tokens: HTTP ${tokensRes.status}`);

    const chains = await chainsRes.json();
    const tokens = await tokensRes.json();

    const chainsArr: ChainDef[] = Array.isArray(chains)
      ? chains
      : (chains.data ?? []);
    for (const chain of chainsArr) {
      const canonical = chain?.chainId ?? chain?.id;
      if (canonical == null) continue;
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

    const tokensArr: TokenDef[] = Array.isArray(tokens)
      ? tokens
      : (tokens.data ?? []);
    for (const token of tokensArr) {
      const chainRef = token?.chainId;
      if (chainRef == null) continue;
      const normalized: TokenDef = {
        ...token,
        chainId: token.chainId ?? chainRef,
      };
      const resolvedChain = this.chain(chainRef);
      const aliases = resolvedChain
        ? getChainAliases(resolvedChain)
        : [normalizeChainKey(chainRef)];
      for (const alias of aliases) {
        this.storeToken(alias, normalized);
      }
    }

    this._loaded = true;
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
        unique.set(`${token.chainId}:${token.address}`, token);
      }
    }
    return Array.from(unique.values());
  }

  tokens(chainRef: string | number): TokenDef[] {
    return this._tokensByChain.get(normalizeChainKey(chainRef)) ?? [];
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
      ["ETH", "MATIC", "AVAX", "BNB", "SOL", "NATIVE"].includes(
        s.toUpperCase()
      )
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
