/* global process */
/**
 * Live integration case for the NDJSON address-balance stream.
 *
 * Unlike the unit tests, this drives the built bundle against a real backend
 * and a real funded address, so it covers the parts a fetch stub cannot: that
 * the backend still speaks the frame shape the parser expects, that streaming
 * actually beats the buffered call on time-to-first-result, and that both paths
 * return the same holdings.
 *
 * It is opt-in because it needs a backend and a funded address:
 *
 *   npm run build:local                  # bakes __API_ROOT__=http://localhost:8000
 *   TW_LIVE_BALANCES=1 \
 *   TW_LIVE_ADDRESS=0x… \
 *   TW_API_KEY=test-… \
 *   node --test scripts/balances-stream-live.test.mjs
 *
 * The backend needs BALANCE_STREAM_ENABLED=true; without it the SDK silently
 * falls back to the buffered endpoint and the fallback assertion below fails,
 * which is the intended signal rather than a green run that proved nothing.
 *
 * TW_LIVE_ADDRESS can be any funded address. The address these assertions were
 * written against came from the MetaMask agent wallet (`mm wallet address`),
 * which is a convenient way to get one with real cross-chain holdings.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { Trustware } from "../dist/core.mjs";

const ENABLED = process.env.TW_LIVE_BALANCES === "1";
const ADDRESS = process.env.TW_LIVE_ADDRESS ?? "";
const API_KEY = process.env.TW_API_KEY ?? "";
const skip = ENABLED
  ? false
  : "set TW_LIVE_BALANCES=1 (plus TW_LIVE_ADDRESS, TW_API_KEY) to run";

/** Rows keyed by contract, not symbol: token metadata is a best-effort lookup
 *  on the backend and a symbol can come back UNKNOWN on either path. */
function holdings(wrappers) {
  const out = new Map();
  for (const wrapper of wrappers) {
    for (const row of wrapper.balances ?? []) {
      if (!row.balance || row.balance === "0") continue;
      out.set(`${wrapper.chain_id}:${row.contract ?? row.address ?? row.symbol}`, row.balance);
    }
  }
  return out;
}

test("streams address balances and reports its terminal state", { skip }, async (t) => {
  assert.ok(ADDRESS, "TW_LIVE_ADDRESS is required");
  assert.ok(API_KEY, "TW_API_KEY is required");

  const events = [];
  await Trustware.init({
    apiKey: API_KEY,
    mode: "deposit",
    // Required by config validation; unrelated to the balance calls under test.
    routes: { toChain: "8453", toToken: "USDC" },
    features: { balanceStreaming: true },
    onEvent: (event) => events.push(event),
  });

  const summaries = [];
  const controller = new AbortController();
  const streamed = [];
  const startedAt = performance.now();
  let firstChunkMs = null;

  for await (const chunk of Trustware.getBalancesByAddressStream(ADDRESS, {
    signal: controller.signal,
    onSummary: (summary) => summaries.push(summary),
  })) {
    if (firstChunkMs === null) firstChunkMs = performance.now() - startedAt;
    streamed.push(...chunk);
  }
  const streamTotalMs = performance.now() - startedAt;

  assert.ok(streamed.length > 0, "stream produced no chunks");
  assert.equal(
    events.filter((e) => e.type === "balance_stream_fallback").length,
    0,
    "stream fell back to the buffered endpoint — is BALANCE_STREAM_ENABLED off?"
  );
  assert.equal(
    events.filter((e) => e.type === "balance_stream_chunk").length,
    streamed.length,
    "one balance_stream_chunk event per chunk"
  );

  // The summary is the whole point of the terminal frame: without it a caller
  // cannot tell an empty wallet from a scan that failed on half its chains.
  assert.equal(summaries.length, 1, "expected exactly one summary");
  const [summary] = summaries;
  assert.equal(summary.address.toLowerCase(), ADDRESS.toLowerCase());
  assert.equal(typeof summary.partial, "boolean");
  assert.ok(summary.total > 0, "summary reported no chains");
  assert.equal(summary.completed, streamed.length);
  t.diagnostic(
    `summary: completed=${summary.completed}/${summary.total} partial=${summary.partial} server=${summary.elapsedMs}ms`
  );

  const bufferedStartedAt = performance.now();
  const bufferedSummaries = [];
  const buffered = await Trustware.getBalancesByAddress(ADDRESS, {
    onSummary: (s) => bufferedSummaries.push(s),
  });
  const bufferedTotalMs = performance.now() - bufferedStartedAt;

  assert.equal(bufferedSummaries.length, 1, "buffered path reported no summary");

  // Streaming does not finish sooner, it starts sooner — that is the feature.
  assert.ok(
    firstChunkMs < bufferedTotalMs,
    `first chunk (${Math.round(firstChunkMs)}ms) should beat the buffered response (${Math.round(bufferedTotalMs)}ms)`
  );
  t.diagnostic(
    `ttfb: stream ${Math.round(firstChunkMs)}ms vs buffered ${Math.round(bufferedTotalMs)}ms (stream total ${Math.round(streamTotalMs)}ms)`
  );

  const streamedHoldings = holdings(streamed);
  const bufferedHoldings = holdings(buffered);
  assert.ok(streamedHoldings.size > 0, "no non-zero balances found — is the address funded?");
  assert.deepEqual(
    [...streamedHoldings.entries()].sort(),
    [...bufferedHoldings.entries()].sort(),
    "streamed and buffered holdings disagree"
  );
  t.diagnostic(`holdings matched across both paths: ${streamedHoldings.size} rows`);
});
