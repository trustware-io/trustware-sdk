import type {
  BalanceRow,
  BalanceStreamOptions,
  BalanceStreamSummary,
  GetBalancesOptions,
  WalletAddressBalanceWrapper,
  ChainDef,
} from "../types/";
import { apiBase, jsonHeaders, rateLimitedFetch } from "./http";
import { Registry } from "../registry";
import { TrustwareConfigStore } from "../config/store";
import {
  getNativeTokenAddress,
  isZeroAddressLike,
  normalizeChainType,
} from "../utils/chains";
import { validateAddressForChain } from "../validation/address";

export type { BalanceRow };

type RawBalanceRow = Record<string, unknown>;
type RawBalanceChunk =
  WalletAddressBalanceWrapper | WalletAddressBalanceWrapper[];

const balanceCache = new Map<string, BalanceRow[]>();

function toStringOrUndefined(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toNumberOrUndefined(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function fallbackTokenSymbol(address: string, chainType?: string | null) {
  if (chainType?.toLowerCase() === "solana") {
    return "SPL";
  }
  return `TOKEN-${address.slice(0, 6)}`;
}

function emitBalanceStreamChunk(address: string, chunkSize: number) {
  TrustwareConfigStore.get().onEvent?.({
    type: "balance_stream_chunk",
    address,
    chunkSize,
  });
}

function emitBalanceStreamFallback(address: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  TrustwareConfigStore.get().onEvent?.({
    type: "balance_stream_fallback",
    address,
    message,
  });
}

function normalizeRows(
  rows: RawBalanceRow[],
  chain: ChainDef,
  address: string,
  registry: Registry
) {
  const chainKey = chain.networkIdentifier ?? String(chain.chainId ?? chain.id);
  const chainType = normalizeChainType(chain);
  const nativeAddress = getNativeTokenAddress(chainType);
  const map = new Map<string, BalanceRow>();

  for (const item of rows) {
    const category = toStringOrUndefined(item.category)?.toLowerCase();
    const addressRaw =
      item.contract ?? item.token_address ?? item.address ?? item.addr;
    const tokenAddress =
      typeof addressRaw === "string" ? addressRaw.trim() : undefined;
    const symbol = toStringOrUndefined(item.symbol ?? item.sym);
    const name =
      toStringOrUndefined(item.name ?? item.token_name ?? item.token) ?? symbol;
    const decimals = toNumberOrUndefined(item.decimals ?? item.dec);
    const balance = String(item.balance ?? item.bal ?? "0");
    const explicitNative = Boolean(item.native ?? item.is_native);
    const nativeFlag =
      explicitNative ||
      category === "native" ||
      isZeroAddressLike(tokenAddress, chainType);

    if (nativeFlag) {
      const nativeRow: BalanceRow = {
        chain_key: chainKey,
        category: "native",
        contract: nativeAddress,
        address: nativeAddress,
        symbol: symbol ?? chain.nativeCurrency?.symbol ?? "NATIVE",
        name: name ?? chain.nativeCurrency?.name ?? symbol,
        decimals: decimals ?? chain.nativeCurrency?.decimals ?? 18,
        balance,
      };
      map.set(`${chainKey}:${nativeAddress}`, nativeRow);
      continue;
    }

    if (!tokenAddress || decimals === undefined) continue;

    const metadata = registry.findToken(chain.chainId, tokenAddress);
    const displaySymbol =
      symbol ??
      metadata?.symbol ??
      fallbackTokenSymbol(tokenAddress, chainType);
    const displayName = name ?? metadata?.name ?? displaySymbol;
    const normalizedAddress = metadata?.address ?? tokenAddress;

    map.set(`${chainKey}:${normalizedAddress}`, {
      chain_key: chainKey,
      category:
        (category as BalanceRow["category"] | undefined) ??
        (chainType === "solana" ? "spl" : "erc20"),
      contract: normalizedAddress,
      address: normalizedAddress,
      symbol: displaySymbol,
      name: displayName,
      decimals: metadata?.decimals ?? decimals,
      balance,
      logoURI: metadata?.logoURI,
      usdPrice: metadata?.usdPrice,
    });
  }

  if (!Array.from(map.values()).some((row) => row.category === "native")) {
    map.set(`${chainKey}:${nativeAddress}`, {
      chain_key: chainKey,
      category: "native",
      contract: nativeAddress,
      address: nativeAddress,
      symbol: chain.nativeCurrency?.symbol ?? "NATIVE",
      name: chain.nativeCurrency?.name ?? chain.nativeCurrency?.symbol,
      decimals: chain.nativeCurrency?.decimals ?? 18,
      balance: "0",
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    try {
      return Number(BigInt(b.balance) - BigInt(a.balance));
    } catch {
      return 0;
    }
  });
}

function normalizeStreamChunk(
  chunk: RawBalanceChunk
): WalletAddressBalanceWrapper[] {
  return Array.isArray(chunk) ? chunk : [chunk];
}

function mergeBalanceWrappers(
  current: WalletAddressBalanceWrapper[],
  incoming: WalletAddressBalanceWrapper[]
): WalletAddressBalanceWrapper[] {
  const merged = new Map<string, WalletAddressBalanceWrapper>();

  for (const item of current) {
    merged.set(item.chain_id, item);
  }

  for (const item of incoming) {
    const existing = merged.get(item.chain_id);
    if (!existing) {
      merged.set(item.chain_id, item);
      continue;
    }

    const balancesByKey = new Map<string, BalanceRow>();
    for (const row of existing.balances ?? []) {
      balancesByKey.set(`${row.contract ?? row.address ?? row.symbol}`, row);
    }
    for (const row of item.balances ?? []) {
      balancesByKey.set(`${row.contract ?? row.address ?? row.symbol}`, row);
    }

    merged.set(item.chain_id, {
      ...existing,
      ...item,
      balances: Array.from(balancesByKey.values()),
      count: item.count ?? existing.count,
    });
  }

  return Array.from(merged.values());
}

function toSummary(
  frame: Record<string, unknown>,
  address: string
): BalanceStreamSummary {
  const total = toNumberOrUndefined(frame.total) ?? 0;
  return {
    address: toStringOrUndefined(frame.address) ?? address,
    partial: Boolean(frame.partial),
    completed: toNumberOrUndefined(frame.completed) ?? 0,
    total,
    elapsedMs: toNumberOrUndefined(frame.elapsed),
  };
}

async function parseStreamingBalances(
  response: Response,
  address: string,
  options: BalanceStreamOptions = {}
): Promise<AsyncGenerator<WalletAddressBalanceWrapper[], void, void>> {
  if (!response.body) {
    throw new Error("balances stream: empty response body");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  async function* stream(): AsyncGenerator<
    WalletAddressBalanceWrapper[],
    void,
    void
  > {
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n/);
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const trimmed = frame.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            // The backend closes the stream with a summary frame carrying
            // `partial`. It has no chain_id, so it is not a chunk — hand it to
            // the caller instead of dropping it on the floor.
            if (!parsed.chain_id) {
              if (parsed.type === "summary") {
                options.onSummary?.(toSummary(parsed, address));
              }
              continue;
            }
            const chunk = normalizeStreamChunk(parsed as RawBalanceChunk);
            emitBalanceStreamChunk(address, chunk.length);
            yield chunk;
          } catch (error) {
            if (options.strict) {
              throw error;
            }
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          const parsed = JSON.parse(tail) as Record<string, unknown>;
          if (parsed.chain_id) {
            const chunk = normalizeStreamChunk(parsed as RawBalanceChunk);
            emitBalanceStreamChunk(address, chunk.length);
            yield chunk;
          } else if (parsed.type === "summary") {
            // The summary is the last line, so it is the frame most likely to
            // arrive without a trailing newline.
            options.onSummary?.(toSummary(parsed, address));
          }
        } catch (error) {
          if (options.strict) {
            throw error;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  return stream();
}

/** Map chain reference -> backend chain_key and return enriched balances */
export async function getBalances(
  chainRef: string | number,
  address: string,
  opts?: GetBalancesOptions
): Promise<BalanceRow[]> {
  const reg = await ensureRegistry();
  const chain = reg.chain(chainRef);
  if (!chain) return [];

  const trimmedAddress = address.trim();
  const validation = validateAddressForChain(trimmedAddress, chain);
  if (!validation.isValid) return [];

  const chainKey = chain.networkIdentifier ?? String(chain.chainId ?? chain.id);
  const cacheKey = [
    chainKey,
    trimmedAddress,
    chain.nativeCurrency?.symbol ?? "",
    chain.nativeCurrency?.decimals ?? "",
    normalizeChainType(chain) ?? "",
  ].join(":");
  if (!opts?.forceRefresh) {
    const cached = balanceCache.get(cacheKey);
    if (cached) return cached;
  }

  const url = `${apiBase()}/v1/data/wallets/${encodeURIComponent(chainKey)}/${trimmedAddress}/balances`;
  // The busiest SDK endpoint against a limit shared by every visitor of an
  // integrator's site, so it is the likeliest to see a 429 — the sibling
  // balance calls in this file already retry.
  const response = await rateLimitedFetch(url, {
    method: "GET",
    credentials: "omit",
    headers: jsonHeaders(),
  });
  if (!response.ok) throw new Error(`balances: HTTP ${response.status}`);
  const json = await response.json();
  const rows: RawBalanceRow[] = Array.isArray(json) ? json : (json.data ?? []);
  const normalized = normalizeRows(rows, chain, trimmedAddress, reg);
  balanceCache.set(cacheKey, normalized);
  return normalized;
}

export async function getBalancesByAddress(
  address: string,
  opts?: BalanceStreamOptions
): Promise<WalletAddressBalanceWrapper[]> {
  if (opts?.stream && TrustwareConfigStore.get().features.balanceStreaming) {
    const merged: WalletAddressBalanceWrapper[] = [];
    for await (const chunk of getBalancesByAddressStream(address, opts)) {
      const next = mergeBalanceWrappers(merged, chunk);
      merged.splice(0, merged.length, ...next);
    }
    return merged;
  }

  const url = `${apiBase()}/v1/data/balances/${address}`;
  const r = await rateLimitedFetch(url, {
    method: "GET",
    credentials: "omit",
    headers: jsonHeaders(),
  });
  if (!r.ok) throw new Error(`balances: HTTP ${r.status}`);
  const j = await r.json();
  const results: WalletAddressBalanceWrapper[] = Array.isArray(j)
    ? j
    : (j.results ?? []);

  // The buffered response carries the same `partial` flag the stream reports in
  // its summary frame. Reporting it here too means a consumer's onSummary fires
  // exactly once per scan whichever path served it — including the fallback
  // below, where the caller asked to stream and silently did not.
  if (opts?.onSummary) {
    const completed = results.length;
    opts.onSummary({
      address,
      partial: Array.isArray(j) ? false : Boolean(j.partial),
      completed,
      total: completed,
    });
  }
  return results;
}

/**
 * Options for the buffered call this module falls back to.
 *
 * `stream: false` is the load-bearing part: getBalancesByAddress re-enters the
 * generator when `stream` is set, so forwarding the caller's options verbatim
 * would turn a persistently failing stream into infinite recursion.
 */
function bufferedOptions(opts: BalanceStreamOptions): BalanceStreamOptions {
  return { ...opts, stream: false };
}

export async function* getBalancesByAddressStream(
  address: string,
  opts: BalanceStreamOptions = {}
): AsyncGenerator<WalletAddressBalanceWrapper[], void, void> {
  if (!TrustwareConfigStore.get().features.balanceStreaming) {
    yield await getBalancesByAddress(address, bufferedOptions(opts));
    return;
  }

  const url = `${apiBase()}/v1/data/balances/${address}?stream=1`;

  try {
    const response = await rateLimitedFetch(url, {
      method: "GET",
      credentials: "omit",
      headers: jsonHeaders({
        Accept: "application/x-ndjson, application/json",
      }),
      signal: opts.signal,
    });

    if (!response.ok) {
      throw new Error(`balances stream: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      // Asked to stream, answered buffered — the shape a caller is least likely
      // to notice, so it reports its summary like every other path.
      const payload = await response.json();
      const results: WalletAddressBalanceWrapper[] = Array.isArray(payload)
        ? payload
        : (payload.results ?? []);
      opts.onSummary?.({
        address,
        partial: Array.isArray(payload) ? false : Boolean(payload.partial),
        completed: results.length,
        total: results.length,
      });
      yield results;
      return;
    }

    const stream = await parseStreamingBalances(response, address, opts);
    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error) {
    emitBalanceStreamFallback(address, error);
    yield await getBalancesByAddress(address, bufferedOptions(opts));
  }
}

let _registry: Registry | undefined;
async function ensureRegistry(): Promise<Registry> {
  if (!_registry) {
    _registry = new Registry(apiBase());
  }
  await _registry.ensureLoaded();
  return _registry;
}
