import type {
  BalanceRow,
  BalanceStreamOptions,
  BalanceStreamSummary,
  GetBalancesOptions,
  WalletAddressBalanceWrapper,
  ChainDef,
} from "../types/";
import { apiBase, jsonHeaders, rateLimitedFetch } from "./http";
import {
  ResponseShapeError,
  optionalString,
  readArray,
  readObject,
  requireBoolean,
  requireNumber,
  requireOneOf,
  requireString,
  requireText,
  type WireObject,
} from "./wire";
import { Registry } from "../registry";
import { TrustwareConfigStore } from "../config/store";
import {
  getNativeTokenAddress,
  isNativeTokenAddress,
  normalizeChainType,
} from "../utils/chains";
import { validateAddressForChain } from "../validation/address";

export type { BalanceRow };

type RawBalanceRow = Record<string, unknown>;

const BALANCES_SOURCE = "GET /data/balances/{address}";
const BALANCES_STREAM_SOURCE = "GET /data/balances/{address}?stream=1";

const BALANCE_CATEGORIES = [
  "native",
  "erc20",
  "spl",
  "btc",
  "coin",
  "bank",
] as const satisfies readonly BalanceRow["category"][];

function parseBalanceRow(
  raw: unknown,
  source: string,
  path: string
): BalanceRow {
  const wire = readObject(raw, source, path);
  const at = (key: string) => `${path}.${key}`;
  const row: BalanceRow = {
    chainKey: requireString(wire, "chainKey", source, at("chainKey")),
    category: requireOneOf(
      wire,
      "category",
      BALANCE_CATEGORIES,
      source,
      at("category")
    ),
    decimals: requireNumber(wire, "decimals", source, at("decimals")),
    balance: requireString(wire, "balance", source, at("balance")),
  };
  for (const key of [
    "contract",
    "address",
    "symbol",
    "name",
    "logoUrl",
  ] as const) {
    const value = optionalString(wire, key, source, at(key));
    if (value !== undefined) row[key] = value;
  }
  return row;
}

/**
 * One chain's scan result, from the buffered body's `results` or a stream's
 * `chain_result` line. Go sends a nil slice as `null`, which is a chain that
 * errored or holds nothing, so a null `balances` is an empty one.
 */
function parseChainBalances(
  raw: unknown,
  source: string,
  path: string
): WalletAddressBalanceWrapper {
  const wire = readObject(raw, source, path);
  const at = (key: string) => `${path}.${key}`;
  const error = wire.error;
  if (error !== null && typeof error !== "string") {
    throw new ResponseShapeError(
      source,
      at("error"),
      "a string or null",
      error
    );
  }
  const balances =
    wire.balances === null
      ? []
      : readArray(wire.balances, source, at("balances")).map((row, index) =>
          parseBalanceRow(row, source, `${at("balances")}[${index}]`)
        );
  return {
    chainId: requireString(wire, "chainId", source, at("chainId")),
    balances,
    count: requireNumber(wire, "count", source, at("count")),
    error,
    source: requireText(wire, "source", source, at("source")),
  };
}

/** The buffered body: `{ address, partial, results }`. */
function parseBalancesBody(raw: unknown): {
  partial: boolean;
  results: WalletAddressBalanceWrapper[];
} {
  const wire: WireObject = readObject(raw, BALANCES_SOURCE, "body");
  return {
    partial: requireBoolean(wire, "partial", BALANCES_SOURCE),
    results: readArray(wire.results, BALANCES_SOURCE, "results").map(
      (result, index) =>
        parseChainBalances(result, BALANCES_SOURCE, `results[${index}]`)
    ),
  };
}

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
    // The backend's native rows carry no contract address at all.
    const nativeFlag =
      explicitNative ||
      category === "native" ||
      !tokenAddress ||
      isNativeTokenAddress(tokenAddress, chainType);

    if (nativeFlag) {
      const nativeRow: BalanceRow = {
        chainKey,
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
      chainKey,
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
      chainKey,
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

export function mergeBalanceWrappers(
  current: WalletAddressBalanceWrapper[],
  incoming: WalletAddressBalanceWrapper[]
): WalletAddressBalanceWrapper[] {
  const merged = new Map<string, WalletAddressBalanceWrapper>();

  for (const item of current) {
    merged.set(item.chainId, item);
  }

  for (const item of incoming) {
    const existing = merged.get(item.chainId);
    if (!existing) {
      merged.set(item.chainId, item);
      continue;
    }

    const balancesByKey = new Map<string, BalanceRow>();
    for (const row of existing.balances ?? []) {
      balancesByKey.set(`${row.contract ?? row.address ?? row.symbol}`, row);
    }
    for (const row of item.balances ?? []) {
      balancesByKey.set(`${row.contract ?? row.address ?? row.symbol}`, row);
    }

    merged.set(item.chainId, {
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

type StreamLine =
  | { kind: "chain"; chunk: WalletAddressBalanceWrapper[] }
  | { kind: "summary"; summary: BalanceStreamSummary };

/**
 * One NDJSON line. Text that is not JSON is skipped unless `strict`; a line
 * that is JSON but breaks the contract (an unknown `type`, a chain result
 * without its `chainId`) always throws, because dropping it would show a
 * wallet with fewer chains than it holds.
 */
function parseStreamLine(
  line: string,
  address: string,
  strict: boolean | undefined
): StreamLine | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    if (strict) throw error;
    return null;
  }
  const wire = readObject(parsed, BALANCES_STREAM_SOURCE, "line");
  switch (wire.type) {
    case "chain_result":
      return {
        kind: "chain",
        chunk: [parseChainBalances(wire, BALANCES_STREAM_SOURCE, "line")],
      };
    // The backend closes the stream with a summary line carrying `partial`.
    // It is not a chunk: hand it to the caller instead of dropping it.
    case "summary":
      return { kind: "summary", summary: toSummary(wire, address) };
    default:
      throw new ResponseShapeError(
        BALANCES_STREAM_SOURCE,
        "type",
        'one of "chain_result", "summary"',
        wire.type
      );
  }
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

  function* chunksOf(lines: string[]) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = parseStreamLine(trimmed, address, options.strict);
      if (!parsed) continue;
      if (parsed.kind === "summary") {
        options.onSummary?.(parsed.summary);
        continue;
      }
      emitBalanceStreamChunk(address, parsed.chunk.length);
      yield parsed.chunk;
    }
  }

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
        yield* chunksOf(frames);
      }

      // The summary is the last line, so it is the one most likely to arrive
      // without a trailing newline.
      yield* chunksOf([buffer]);
    } finally {
      reader.releaseLock();
    }
  }

  return stream();
}

/** Map chain reference -> backend chain key and return enriched balances */
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

  const url = `${apiBase()}/data/wallets/${encodeURIComponent(chainKey)}/${trimmedAddress}/balances`;
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

  const url = `${apiBase()}/data/balances/${address}`;
  const r = await rateLimitedFetch(url, {
    method: "GET",
    credentials: "omit",
    headers: jsonHeaders(),
  });
  if (!r.ok) throw new Error(`balances: HTTP ${r.status}`);
  const { partial, results } = parseBalancesBody(await r.json());

  // The buffered response carries the same `partial` flag the stream reports in
  // its summary frame. Reporting it here too means a consumer's onSummary fires
  // exactly once per scan whichever path served it — including the fallback
  // below, where the caller asked to stream and silently did not.
  if (opts?.onSummary) {
    const completed = results.length;
    opts.onSummary({ address, partial, completed, total: completed });
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

  const url = `${apiBase()}/data/balances/${address}?stream=1`;

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
      const { partial, results } = parseBalancesBody(await response.json());
      opts.onSummary?.({
        address,
        partial,
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
