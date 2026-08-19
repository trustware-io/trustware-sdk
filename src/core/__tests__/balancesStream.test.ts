import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getBalancesByAddress, getBalancesByAddressStream } from "../balances";
import { TrustwareConfigStore } from "../../config/store";
import type { BalanceStreamSummary } from "../../types/blockchain";

const ADDRESS = "0xa5cc6f03b19b7528d34e19c7cdb918bdbe6ccbf1";

/** One chain_result frame in the shape the backend's NDJSON stream emits. */
function chainFrame(chainId: string, symbol: string, balance: string) {
  return JSON.stringify({
    type: "chain_result",
    chain_id: chainId,
    source: "alchemy",
    count: 1,
    error: null,
    completed: 1,
    total: 2,
    lastCompletedChain: chainId,
    balances: [{ chain_key: chainId, symbol, balance, decimals: 18 }],
  });
}

/** The terminal frame. `partial` is the field consumers cannot infer from rows. */
function summaryFrame(partial: boolean) {
  return JSON.stringify({
    type: "summary",
    address: ADDRESS,
    partial,
    completed: 2,
    total: 2,
    elapsed: 2560,
  });
}

/**
 * An NDJSON response. `trailingNewline: false` reproduces the real stream's
 * last line, which arrives without one and is therefore parsed from the tail
 * buffer rather than the split loop.
 */
function ndjsonResponse(lines: string[], trailingNewline = true): Response {
  const body = lines.join("\n") + (trailingNewline ? "\n" : "");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Chunked mid-line on purpose: frame reassembly is the parser's job.
      const bytes = new TextEncoder().encode(body);
      const split = Math.floor(bytes.length / 2);
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

function bufferedResponse(partial: boolean): Response {
  return new Response(
    JSON.stringify({
      address: ADDRESS,
      partial,
      results: [
        {
          chain_id: "8453",
          source: "alchemy",
          count: 1,
          error: null,
          balances: [{ chain_key: "8453", symbol: "ETH", balance: "1" }],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

type FetchStub = {
  urls: string[];
  restore: () => void;
};

function stubFetch(handler: (url: string) => Response): FetchStub {
  const real = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    urls.push(url);
    return handler(url);
  }) as typeof globalThis.fetch;
  return { urls, restore: () => (globalThis.fetch = real) };
}

async function drain(
  gen: AsyncGenerator<unknown[], void, void>
): Promise<unknown[][]> {
  const chunks: unknown[][] = [];
  for await (const chunk of gen) chunks.push(chunk);
  return chunks;
}

describe("address balances", () => {
  let fetchStub: FetchStub | null = null;

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test_api_key",
      mode: "deposit",
      routes: { toChain: "8453", toToken: "USDC" },
      features: { balanceStreaming: true },
    });
  });

  afterEach(() => {
    fetchStub?.restore();
    fetchStub = null;
  });

  it("requests the v1 path, not the deprecated alias", async () => {
    fetchStub = stubFetch((url) =>
      url.includes("stream=1")
        ? ndjsonResponse([chainFrame("8453", "ETH", "1"), summaryFrame(false)])
        : bufferedResponse(false)
    );

    await drain(getBalancesByAddressStream(ADDRESS));
    await getBalancesByAddress(ADDRESS);

    assert.equal(fetchStub.urls.length, 2);
    for (const url of fetchStub.urls) {
      assert.match(url, /\/v1\/data\/balances\//);
      // The legacy alias answers today but carries Deprecation + Sunset.
      assert.doesNotMatch(url, /\/api\/data\/balances\//);
    }
    assert.match(fetchStub.urls[0], /stream=1/);
  });

  it("reports partial from the summary frame instead of dropping it", async () => {
    fetchStub = stubFetch(() =>
      ndjsonResponse([
        chainFrame("8453", "ETH", "1"),
        chainFrame("137", "POL", "2"),
        summaryFrame(true),
      ])
    );

    const summaries: BalanceStreamSummary[] = [];
    const chunks = await drain(
      getBalancesByAddressStream(ADDRESS, {
        onSummary: (s) => summaries.push(s),
      })
    );

    // The summary is not a chunk: two chains in, two chunks out.
    assert.equal(chunks.length, 2);
    assert.equal(summaries.length, 1);
    assert.deepEqual(summaries[0], {
      address: ADDRESS,
      partial: true,
      completed: 2,
      total: 2,
      elapsedMs: 2560,
    });
  });

  it("still reports the summary when it arrives without a trailing newline", async () => {
    fetchStub = stubFetch(() =>
      ndjsonResponse(
        [chainFrame("8453", "ETH", "1"), summaryFrame(true)],
        false
      )
    );

    const summaries: BalanceStreamSummary[] = [];
    await drain(
      getBalancesByAddressStream(ADDRESS, {
        onSummary: (s) => summaries.push(s),
      })
    );

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].partial, true);
  });

  it("reports partial on the buffered path too", async () => {
    fetchStub = stubFetch(() => bufferedResponse(true));

    const summaries: BalanceStreamSummary[] = [];
    const results = await getBalancesByAddress(ADDRESS, {
      onSummary: (s) => summaries.push(s),
    });

    assert.equal(results.length, 1);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].partial, true);
    assert.equal(summaries[0].completed, 1);
  });

  it("reports the summary once when a failed stream falls back to buffered", async () => {
    // The shape staging and prod serve today: BALANCE_STREAM_ENABLED is off, so
    // the stream request is refused and the SDK silently answers from the
    // buffered endpoint. A consumer's partial handling must survive that.
    fetchStub = stubFetch((url) =>
      url.includes("stream=1")
        ? new Response(JSON.stringify({ error: "stream mode disabled" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        : bufferedResponse(true)
    );

    const summaries: BalanceStreamSummary[] = [];
    const chunks = await drain(
      getBalancesByAddressStream(ADDRESS, {
        onSummary: (s) => summaries.push(s),
      })
    );

    assert.equal(chunks.length, 1);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].partial, true);
    // Exactly one retry: the fallback must not re-enter the streaming path.
    assert.equal(fetchStub.urls.length, 2);
    assert.equal(
      fetchStub.urls.filter((u) => u.includes("stream=1")).length,
      1
    );
  });

  it("falls back without recursing when streaming is disabled in config", async () => {
    TrustwareConfigStore.init({
      apiKey: "test_api_key",
      mode: "deposit",
      routes: { toChain: "8453", toToken: "USDC" },
      features: { balanceStreaming: false },
    });
    fetchStub = stubFetch(() => bufferedResponse(false));

    const summaries: BalanceStreamSummary[] = [];
    const chunks = await drain(
      getBalancesByAddressStream(ADDRESS, {
        stream: true,
        onSummary: (s) => summaries.push(s),
      })
    );

    assert.equal(chunks.length, 1);
    assert.equal(fetchStub.urls.length, 1);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].partial, false);
  });

  it("reports a summary when the server answers a stream request with JSON", async () => {
    fetchStub = stubFetch(() => bufferedResponse(true));

    const summaries: BalanceStreamSummary[] = [];
    const chunks = await drain(
      getBalancesByAddressStream(ADDRESS, {
        onSummary: (s) => summaries.push(s),
      })
    );

    assert.equal(chunks.length, 1);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].partial, true);
  });
});
