// src/registry.ts
import { TrustwareConfigStore } from "./config/store";

export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export type ChainMeta = {
  id: string;
  networkIdentifier: string;
  nativeCurrency: { symbol: string; decimals: number; name: string };
};

export type TokenMeta = {
  chainId: string;
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  visible?: boolean;
  active?: boolean;
};

export class Registry {
  private _chainsById = new Map<string, ChainMeta>();
  private _tokensByChain = new Map<string, TokenMeta[]>();
  private _loaded = false;

  constructor(private baseURL: string) {}

  async ensureLoaded() {
    if (this._loaded) return;
    const cfg = TrustwareConfigStore.get();

    const [chainsRes, tokensRes] = await Promise.all([
      fetch(`${this.baseURL}/squid/chains`, {
        headers: { Accept: "application/json", "X-API-Key": cfg.apiKey },
      }),
      fetch(`${this.baseURL}/squid/tokens`, {
        headers: { Accept: "application/json", "X-API-Key": cfg.apiKey },
      }),
    ]);
    if (!chainsRes.ok) throw new Error(`chains: HTTP ${chainsRes.status}`);
    if (!tokensRes.ok) throw new Error(`tokens: HTTP ${tokensRes.status}`);

    const chains = await chainsRes.json();
    const tokens = await tokensRes.json();

    const chainsArr: ChainMeta[] = Array.isArray(chains)
      ? chains
      : (chains.data ?? []);
    for (const c of chainsArr) {
      if (c?.id) this._chainsById.set(String(c.id), c as ChainMeta);
    }

    const tokensArr: TokenMeta[] = Array.isArray(tokens)
      ? tokens
      : (tokens.data ?? []);
    for (const t of tokensArr) {
      const id = String(t.chainId);
      if (!this._tokensByChain.has(id)) this._tokensByChain.set(id, []);
      this._tokensByChain.get(id)!.push(t as TokenMeta);
    }

    this._loaded = true;
  }

  chain(chainId: string | number): ChainMeta | undefined {
    return this._chainsById.get(String(chainId));
  }

  tokens(chainId: string | number): TokenMeta[] {
    return this._tokensByChain.get(String(chainId)) ?? [];
  }

  resolveToken(
    chainId: string | number,
    input?: string | null,
  ): string | undefined {
    if (!input) return undefined;
    const s = String(input).trim();

    // address passthrough
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s as `0x${string}`;

    // native by symbol
    const chain = this.chain(chainId);
    const nativeSym = chain?.nativeCurrency?.symbol?.toUpperCase?.();
    if (nativeSym && s.toUpperCase() === nativeSym) return NATIVE;

    if (["ETH", "MATIC", "AVAX", "BNB", "NATIVE"].includes(s.toUpperCase()))
      return NATIVE;

    // symbol → address
    const list = this.tokens(chainId);
    const hit = list.find((t) => t.symbol?.toUpperCase?.() === s.toUpperCase());
    if (hit) return hit.address;

    return s;
  }
}
