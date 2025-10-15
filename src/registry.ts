// src/registry.ts
import { TrustwareConfig } from "./types";
export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

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

export class Registry {
  private _chainsById = new Map<string, ChainMeta>();
  private _tokensByChain = new Map<string, TokenMeta[]>(); // key: chainId
  private _loaded = false;
  private cfg: TrustwareConfig = {
    apiKey: "",
  };

  constructor(
    private baseURL: string,
    cfg: { apiKey?: string } = {},
  ) {} // e.g. http://localhost:8000/api

  async ensureLoaded() {
    if (this._loaded) return;
    // fetch concurrently.
    const [chainsRes, tokensRes] = await Promise.all([
      fetch(`${this.baseURL}/squid/chains`, {
        headers: { Accept: "application/json", "X-API-Key": this.cfg.apiKey },
      }),
      fetch(`${this.baseURL}/squid/tokens`, {
        headers: { Accept: "application/json", "X-API-Key": this.cfg.apiKey },
      }),
    ]);
    if (!chainsRes.ok) throw new Error(`chains: HTTP ${chainsRes.status}`);
    if (!tokensRes.ok) throw new Error(`tokens: HTTP ${tokensRes.status}`);

    const chains = await chainsRes.json();
    const tokens = await tokensRes.json();

    // chains can be array or wrapped; normalize expecting an array
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

  /** Resolve UI input into a wire token for Squid (address or NATIVE sentinel). */
  resolveToken(
    chainId: string | number,
    input?: string | null,
  ): string | undefined {
    if (!input) return undefined;
    const s = String(input).trim();

    // If it looks like an address, pass through
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s as `0x${string}`;

    // Try native-by-symbol (case-insensitive, from chains metadata)
    const chain = this.chain(chainId);
    const nativeSym = chain?.nativeCurrency?.symbol?.toUpperCase?.();
    if (nativeSym && s.toUpperCase() === nativeSym) return NATIVE;

    // Also accept a few common native aliases:
    if (["ETH", "MATIC", "AVAX", "BNB", "NATIVE"].includes(s.toUpperCase()))
      return NATIVE;

    // Otherwise map symbol → address using tokens list for that chain
    const list = this.tokens(chainId);
    const hit = list.find((t) => t.symbol?.toUpperCase?.() === s.toUpperCase());
    if (hit) return hit.address;

    // No match; let caller decide to throw or pass-through
    return s;
  }
}
