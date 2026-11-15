import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getBalancesByAddress, getBalancesByAddressStream } from "../balances";
import { TrustwareConfigStore } from "../../config/store";
import type { BalanceStreamSummary } from "../../types/blockchain";
import { ResponseShapeError } from "../wire";

const ADDRESS = "0xa5cc6f03b19b7528d34e19c7cdb918bdbe6ccbf1";

/** One chain_result frame in the shape the v2 backend's NDJSON stream emits. */
function chainFrame(chainId: string, symbol: string, balance: string) {
  return JSON.stringify({
    type: "chain_result",
    chainIndex: 0,
    chainId,
    source: "alchemy",
    count: 1,
    error: null,
    completed: 1,
    total: 2,
    lastCompletedChain: chainId,
    balances: [
      {
        chainKey: chainId,
        category: "native",
        symbol,
        balance,
        decimals: 18,
      },
    ],
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
          chainId: "8453",
          source: "alchemy",
          count: 1,
          error: null,
          balances: [
            {
              chainKey: "8453",
              category: "native",
              symbol: "ETH",
              balance: "1",
              decimals: 18,
            },
          ],
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

  it("requests the v2 path, not the deprecated alias", async () => {
    fetchStub = stubFetch((url) =>
      url.includes("stream=1")
        ? ndjsonResponse([chainFrame("8453", "ETH", "1"), summaryFrame(false)])
        : bufferedResponse(false)
    );

    await drain(getBalancesByAddressStream(ADDRESS));
    await getBalancesByAddress(ADDRESS);

    assert.equal(fetchStub.urls.length, 2);
    for (const url of fetchStub.urls) {
      assert.ok(
        url.startsWith(
          `https://api.trustware.io/api/v2/data/balances/${ADDRESS}`
        ),
        url
      );
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
  it("parses a v2 stream line into exactly the wrapper it describes", async () => {
    fetchStub = stubFetch(() =>
      ndjsonResponse([
        JSON.stringify({
          type: "chain_result",
          chainIndex: 3,
          chainId: "137",
          source: "fallback",
          count: 2,
          error: null,
          completed: 1,
          total: 2,
          lastCompletedChain: "137",
          balances: [
            {
              chainKey: "polygon",
              category: "native",
              symbol: "POL",
              decimals: 18,
              balance: "5000",
              name: "Polygon",
              logoUrl: "https://assets.trustware.io/pol.png",
            },
            {
              chainKey: "polygon",
              category: "erc20",
              contract: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
              symbol: "USDC.e",
              decimals: 6,
              balance: "7",
              address: ADDRESS,
            },
          ],
        }),
        summaryFrame(false),
      ])
    );

    const chunks = await drain(getBalancesByAddressStream(ADDRESS));

    assert.deepEqual(chunks, [
      [
        {
          chainId: "137",
          source: "fallback",
          count: 2,
          error: null,
          balances: [
            {
              chainKey: "polygon",
              category: "native",
              symbol: "POL",
              decimals: 18,
              balance: "5000",
              name: "Polygon",
              logoUrl: "https://assets.trustware.io/pol.png",
            },
            {
              chainKey: "polygon",
              category: "erc20",
              contract: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
              symbol: "USDC.e",
              decimals: 6,
              balance: "7",
              address: ADDRESS,
            },
          ],
        },
      ],
    ]);
  });

  it("parses a v2 buffered body, a chain that errored included", async () => {
    fetchStub = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            address: ADDRESS,
            partial: true,
            results: [
              {
                chainId: "8453",
                source: "alchemy",
                count: 1,
                error: null,
                balances: [
                  {
                    chainKey: "8453",
                    category: "native",
                    symbol: "ETH",
                    decimals: 18,
                    balance: "1",
                  },
                ],
              },
              // Go encodes the nil slice of a failed chain as null.
              {
                chainId: "solana-mainnet-beta",
                source: "",
                count: 0,
                error: "balance lookup timed out",
                balances: null,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );

    const results = await getBalancesByAddress(ADDRESS);

    assert.deepEqual(results, [
      {
        chainId: "8453",
        source: "alchemy",
        count: 1,
        error: null,
        balances: [
          {
            chainKey: "8453",
            category: "native",
            symbol: "ETH",
            decimals: 18,
            balance: "1",
          },
        ],
      },
      {
        chainId: "solana-mainnet-beta",
        source: "",
        count: 0,
        error: "balance lookup timed out",
        balances: [],
      },
    ]);
  });

  it("throws naming the field when a buffered result is still spelled the v1 way", async () => {
    fetchStub = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            address: ADDRESS,
            partial: false,
            results: [
              {
                chain_id: "8453",
                source: "alchemy",
                count: 0,
                error: null,
                balances: [],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );

    await assert.rejects(
      () => getBalancesByAddress(ADDRESS),
      (error: unknown) =>
        error instanceof ResponseShapeError &&
        error.field === "results[0].chainId" &&
        error.message ===
          'GET /data/balances/{address}: field "results[0].chainId" must be a non-empty string, received nothing (missing)'
    );
  });

  it("throws naming the field when a balance row lacks its chainKey", async () => {
    fetchStub = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            address: ADDRESS,
            partial: false,
            results: [
              {
                chainId: "8453",
                source: "alchemy",
                count: 1,
                error: null,
                balances: [
                  {
                    chain_key: "8453",
                    category: "native",
                    decimals: 18,
                    balance: "1",
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );

    await assert.rejects(
      () => getBalancesByAddress(ADDRESS),
      (error: unknown) =>
        error instanceof ResponseShapeError &&
        error.field === "results[0].balances[0].chainKey"
    );
  });

  it("reports a v1 stream line through the fallback event, then answers from the buffered path", async () => {
    const events: { type: string; message?: string }[] = [];
    TrustwareConfigStore.init({
      apiKey: "test_api_key",
      mode: "deposit",
      routes: { toChain: "8453", toToken: "USDC" },
      features: { balanceStreaming: true },
      onEvent: (event) => events.push(event as { type: string }),
    });
    fetchStub = stubFetch((url) =>
      url.includes("stream=1")
        ? ndjsonResponse([
            JSON.stringify({
              type: "chain_result",
              chain_id: "8453",
              source: "alchemy",
              count: 0,
              error: null,
              balances: [],
            }),
          ])
        : bufferedResponse(false)
    );

    const chunks = await drain(getBalancesByAddressStream(ADDRESS));

    assert.equal(chunks.length, 1);
    assert.deepEqual(
      events.filter((event) => event.type === "balance_stream_fallback"),
      [
        {
          type: "balance_stream_fallback",
          address: ADDRESS,
          message:
            'GET /data/balances/{address}?stream=1: field "line.chainId" must be a non-empty string, received nothing (missing)',
        },
      ]
    );
  });

  it("refuses a stream line type it does not know", async () => {
    const events: { type: string; message?: string }[] = [];
    TrustwareConfigStore.init({
      apiKey: "test_api_key",
      mode: "deposit",
      routes: { toChain: "8453", toToken: "USDC" },
      features: { balanceStreaming: true },
      onEvent: (event) => events.push(event as { type: string }),
    });
    fetchStub = stubFetch((url) =>
      url.includes("stream=1")
        ? ndjsonResponse([JSON.stringify({ type: "progress" })])
        : bufferedResponse(false)
    );

    await drain(getBalancesByAddressStream(ADDRESS));

    const fallback = events.find(
      (event) => event.type === "balance_stream_fallback"
    );
    assert.equal(
      fallback?.message,
      'GET /data/balances/{address}?stream=1: field "type" must be one of "chain_result", "summary", received "progress"'
    );
  });
});
