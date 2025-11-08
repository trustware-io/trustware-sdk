// src/registry.ts
import { TrustwareConfigStore } from "./config/store";
import type { ChainDef, TokenDef } from "./types/";

export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export class Registry {
  private _chainsById = new Map<string, ChainDef>();
  private _tokensByChain = new Map<string, TokenDef[]>();
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

    const chainsArr: ChainDef[] = Array.isArray(chains)
      ? chains
      : (chains.data ?? []);
    for (const c of chainsArr) {
      const canonical = c?.chainId ?? c?.id;
      if (canonical == null) continue;
      const chainId = c.chainId ?? canonical;
      const normalized: ChainDef = {
        ...c,
        id: c.id ?? canonical,
        chainId,
      };
      this._chainsById.set(String(canonical), normalized);
    }

    const tokensArr: TokenDef[] = Array.isArray(tokens)
      ? tokens
      : (tokens.data ?? []);
    for (const t of tokensArr) {
      const canonical = t?.chainId;
      if (canonical == null) continue;
      const id = String(canonical);
      const normalized: TokenDef = {
        ...t,
        chainId: t.chainId ?? canonical,
      };
      if (!this._tokensByChain.has(id)) this._tokensByChain.set(id, []);
      this._tokensByChain.get(id)!.push(normalized);
    }

    this._loaded = true;
  }

  chains(): ChainDef[] {
    return Array.from(this._chainsById.values());
  }
  
  chain(chainId: string | number): ChainDef | undefined {
    return this._chainsById.get(String(chainId));
  }

  tokens(chainId: string | number): TokenDef[] {
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
