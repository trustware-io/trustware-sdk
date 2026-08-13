import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { withRateLimitRetry, RateLimitError } from "../http";
import { TrustwareConfigStore } from "../../config/store";
import type { RateLimitInfo } from "../../types/config";

/** A 429 carrying the headers the backend sets on a rate limited response. */
function limited(retryAfterSeconds: number): Response {
  return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
    status: 429,
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 42),
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

/** A 429 whose headers the caller cannot read — a browser hitting an origin
 *  that doesn't expose them. This is what every browser saw before the backend
 *  listed the rate limit headers in Access-Control-Expose-Headers. */
function limitedOpaque(): Response {
  return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
    status: 429,
  });
}

/**
 * Replaces setTimeout so waits resolve immediately while recording what was
 * asked for. Asserting the requested delay is the point — "it slept 2000ms
 * because the server said 2" is the behaviour, and a real sleep would only
 * make the suite slower without testing more.
 */
function captureDelays() {
  const delays: number[] = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    return real(fn, 0);
  }) as typeof globalThis.setTimeout;
  return {
    delays,
    restore: () => {
      globalThis.setTimeout = real;
    },
  };
}

function ok(): Response {
  return new Response(JSON.stringify({ data: {} }), { status: 200 });
}

/** Returns each queued response in turn and records the call count. */
function responder(queue: Response[]) {
  let calls = 0;
  return {
    attempt: () => {
      calls++;
      const next = queue.shift();
      if (!next) throw new Error("attempt called more times than queued");
      return Promise.resolve(next);
    },
    get calls() {
      return calls;
    },
  };
}

describe("withRateLimitRetry", () => {
  let seen: { info: RateLimitInfo; attempt: number }[] = [];

  beforeEach(() => {
    seen = [];
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "0xtoken" },
      retry: {
        onRateLimited: (info, attempt) => seen.push({ info, attempt }),
      },
    });
  });

  it("passes a successful response straight through", async () => {
    const r = responder([ok()]);
    const res = await withRateLimitRetry(r.attempt);

    assert.equal(res.status, 200);
    assert.equal(r.calls, 1);
  });

  // The server's Retry-After points at the end of its fixed window; waiting it
  // out is the only schedule that lands in the next one.
  it("waits the server's Retry-After and then succeeds", async () => {
    const timers = captureDelays();
    try {
      const r = responder([limited(2), ok()]);
      const res = await withRateLimitRetry(r.attempt);

      assert.equal(res.status, 200);
      assert.equal(r.calls, 2);
      assert.deepEqual(timers.delays, [2000], "Retry-After is seconds");
      assert.equal(seen.length, 1, "onRateLimited should fire for the 429");
      assert.equal(seen[0].info.retryAfter, 2);
    } finally {
      timers.restore();
    }
  });

  // The case that makes the cap worth having: a wait this long would park a
  // payment UI on a spinner. Fail immediately instead, carrying the wait.
  it("refuses to block on a long Retry-After and reports the wait", async () => {
    const r = responder([limited(55)]);

    await assert.rejects(
      () => withRateLimitRetry(r.attempt),
      (err: unknown) => {
        assert.ok(err instanceof RateLimitError);
        assert.equal(
          err.retriesExhausted,
          false,
          "not exhausted — we chose not to wait"
        );
        assert.equal(err.rateLimitInfo.retryAfter, 55);
        assert.match(err.message, /try again in 55 seconds/i);
        return true;
      }
    );
    assert.equal(r.calls, 1, "must not burn a retry it knows will 429");
  });

  it("gives up after the fixed retry budget and reports exhaustion", async () => {
    const timers = captureDelays();
    try {
      const r = responder([limited(1), limited(1), limited(1), limited(1)]);

      await assert.rejects(
        () => withRateLimitRetry(r.attempt),
        (err: unknown) => {
          assert.ok(err instanceof RateLimitError);
          assert.equal(err.retriesExhausted, true);
          return true;
        }
      );

      // 1 initial attempt + MAX_RETRIES retries.
      assert.equal(r.calls, 4);
      assert.deepEqual(timers.delays, [1000, 1000, 1000]);
      assert.equal(seen.length, 4, "every 429 should notify");
    } finally {
      timers.restore();
    }
  });

  // Without readable headers there is no Retry-After to follow, so the blind
  // exponential fallback runs — and the callbacks stay silent, because there is
  // nothing to report. This is the degraded path, not the intended one.
  it("falls back to exponential backoff when headers are unreadable", async () => {
    const timers = captureDelays();
    try {
      const r = responder([limitedOpaque(), limitedOpaque(), ok()]);
      const res = await withRateLimitRetry(r.attempt);

      assert.equal(res.status, 200);
      assert.equal(r.calls, 3);
      // base * 2^n, and every one of these lands inside the same 60s window
      // the server is enforcing — which is exactly why the exposed
      // Retry-After matters more than this fallback.
      assert.deepEqual(timers.delays, [1000, 2000]);
      assert.equal(seen.length, 0, "no header, nothing to report");
    } finally {
      timers.restore();
    }
  });
});
