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

/** A 429 with the window boundary but no Retry-After — e.g. a proxy that drops
 *  the header, or a limiter that only publishes X-RateLimit-*. */
function limitedResetOnly(secondsUntilReset: number): Response {
  return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
    status: 429,
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(
        Math.floor(Date.now() / 1000) + secondsUntilReset
      ),
    },
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

  // Short waits are absorbed one after another until the budget is spent —
  // no retry counter, just the time the server asked for versus the time we
  // are willing to give it.
  it("spends the wait budget across successive server-directed waits", async () => {
    const timers = captureDelays();
    try {
      const r = responder([limited(4), limited(4), limited(4)]);

      await assert.rejects(
        () => withRateLimitRetry(r.attempt),
        (err: unknown) => {
          assert.ok(err instanceof RateLimitError);
          assert.equal(
            err.retriesExhausted,
            false,
            "the wait is known, it just exceeded the budget"
          );
          return true;
        }
      );

      // 4s + 4s fits in the 10s budget; the third would take it to 12s.
      assert.deepEqual(timers.delays, [4000, 4000]);
      assert.equal(r.calls, 3);
      assert.equal(seen.length, 3, "every 429 should notify");
    } finally {
      timers.restore();
    }
  });

  // Retry-After is the direct answer, but the window boundary says the same
  // thing — so a proxy dropping one header doesn't cost us the retry.
  it("falls back to X-RateLimit-Reset when Retry-After is absent", async () => {
    const timers = captureDelays();
    try {
      const r = responder([limitedResetOnly(3), ok()]);
      const res = await withRateLimitRetry(r.attempt);

      assert.equal(res.status, 200);
      assert.equal(r.calls, 2);
      assert.equal(timers.delays.length, 1);
      assert.ok(
        timers.delays[0] > 2000 && timers.delays[0] <= 3000,
        `expected ~3s until reset, got ${timers.delays[0]}ms`
      );
    } finally {
      timers.restore();
    }
  });

  // With no readable headers there is nothing to schedule against. Guessing
  // spends the caller's remaining budget on requests that cannot succeed
  // inside the window that is already closed, so stop and say so.
  it("stops instead of guessing when the server gives no timing", async () => {
    const timers = captureDelays();
    try {
      const r = responder([limitedOpaque()]);

      await assert.rejects(
        () => withRateLimitRetry(r.attempt),
        (err: unknown) => {
          assert.ok(err instanceof RateLimitError);
          assert.equal(err.retriesExhausted, true);
          assert.match(err.message, /did not say when to retry/i);
          return true;
        }
      );

      assert.equal(r.calls, 1);
      assert.deepEqual(timers.delays, [], "must not sleep on a guess");
      assert.equal(seen.length, 0, "no header, nothing to report");
    } finally {
      timers.restore();
    }
  });
});
