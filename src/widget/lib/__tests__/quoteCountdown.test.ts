import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  QUOTE_WARNING_FRACTION,
  quoteCountdown,
  quoteRefreshIntervalMs,
  shouldRefreshQuote,
} from "src/widget/lib/quoteCountdown";
import { MAX_ROUTE_REFRESH_MS } from "src/config/routeRefresh";
import { DATE_HEADER_TRUNCATION_MS } from "src/core/routeExpiry";
import { mulberry32 } from "src/__tests__/seededRandom";

describe("quoteCountdown", () => {
  it("keeps today's swap countdown at the 60 s default: warn from 50 s, refresh at 60 s", () => {
    assert.deepEqual(quoteCountdown(0, 60_000), {
      progress: 0,
      warning: false,
      expired: false,
    });
    assert.deepEqual(quoteCountdown(30_000, 60_000), {
      progress: 0.5,
      warning: false,
      expired: false,
    });
    assert.equal(quoteCountdown(49_999, 60_000).warning, false);
    assert.deepEqual(quoteCountdown(50_000, 60_000), {
      progress: 50_000 / 60_000,
      warning: true,
      expired: false,
    });
    assert.equal(quoteCountdown(59_999, 60_000).expired, false);
    assert.deepEqual(quoteCountdown(60_000, 60_000), {
      progress: 1,
      warning: true,
      expired: true,
    });
  });

  it("refreshes at a configured 15 s, not at 60 s", () => {
    assert.equal(
      shouldRefreshQuote(quoteCountdown(14_999, 15_000), false),
      false
    );
    assert.equal(
      shouldRefreshQuote(quoteCountdown(15_000, 15_000), false),
      true
    );
    assert.equal(quoteCountdown(7_500, 15_000).progress, 0.5);
    assert.equal(quoteCountdown(12_499, 15_000).warning, false);
    assert.equal(quoteCountdown(12_500, 15_000).warning, true);
  });

  it("scales the warning with the interval instead of a fixed 10 s", () => {
    // A fixed 10 s would leave a 10 s interval in the warning colour from
    // the start. A sixth of it is the last 1.67 s.
    assert.equal(quoteCountdown(0, 10_000).warning, false);
    assert.equal(quoteCountdown(8_333, 10_000).warning, false);
    assert.equal(quoteCountdown(8_334, 10_000).warning, true);
    assert.equal(quoteCountdown(249_999, 300_000).warning, false);
    assert.equal(quoteCountdown(250_000, 300_000).warning, true);
  });

  it("stays full after the interval and fresh for a clock that stepped back", () => {
    assert.deepEqual(quoteCountdown(90_000, 60_000), {
      progress: 1,
      warning: true,
      expired: true,
    });
    assert.deepEqual(quoteCountdown(-5_000, 60_000), {
      progress: 0,
      warning: false,
      expired: false,
    });
  });

  it("refuses an interval or elapsed time it can't count with", () => {
    for (const interval of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => quoteCountdown(0, interval), {
        message: `A quote countdown needs a positive interval in ms (got ${interval}).`,
      });
    }
    assert.throws(() => quoteCountdown(Number.NaN, 60_000), {
      message: "A quote countdown's elapsed time is NaN.",
    });
  });

  it("holds its invariants for any interval and elapsed time", () => {
    const random = mulberry32(20261017);
    for (let i = 0; i < 5_000; i++) {
      const interval =
        i % 10 === 0
          ? [1, MAX_ROUTE_REFRESH_MS][i % 20 === 0 ? 0 : 1]
          : 1 + Math.floor(random() * MAX_ROUTE_REFRESH_MS);
      const elapsed = Math.floor((random() * 3 - 1) * interval);
      const later = elapsed + Math.floor(random() * interval);
      const now = quoteCountdown(elapsed, interval);
      const next = quoteCountdown(later, interval);
      const label = `interval ${interval}, elapsed ${elapsed}`;

      assert.ok(Number.isFinite(now.progress), label);
      assert.ok(now.progress >= 0 && now.progress <= 1, label);
      assert.equal(now.expired, elapsed >= interval, label);
      assert.equal(
        now.warning,
        Math.max(elapsed, 0) >= interval * (1 - QUOTE_WARNING_FRACTION),
        label
      );
      if (now.expired) assert.ok(now.warning && now.progress === 1, label);
      assert.ok(next.progress >= now.progress, `${label}: went backwards`);
      if (now.warning) assert.ok(next.warning, label);
    }
  });
});

describe("shouldRefreshQuote", () => {
  it("refreshes an expired quote, but never while a confirm is in flight", () => {
    const expired = quoteCountdown(60_000, 60_000);
    const fresh = quoteCountdown(1_000, 60_000);
    assert.equal(shouldRefreshQuote(expired, false), true);
    assert.equal(shouldRefreshQuote(expired, true), false);
    assert.equal(shouldRefreshQuote(fresh, false), false);
    assert.equal(shouldRefreshQuote(fresh, true), false);
  });
});

describe("quoteRefreshIntervalMs", () => {
  const receivedAt = Date.UTC(2026, 9, 24, 10, 0, 0);
  /** A route expiring `inMs` after the latest the server's clock can read
   *  at `receivedAt` (its Date, plus the 999 ms truncation), on a server
   *  whose clock runs `offsetMs` ahead of the device's. */
  const expiringIn = (inMs: number, offsetMs = 0) => ({
    intentId: "intent-1",
    expiresAt: new Date(
      receivedAt + offsetMs + DATE_HEADER_TRUNCATION_MS + inMs
    ),
    serverClockOffsetMs: offsetMs,
  });

  it("counts down to the expiry less the Date header's truncation", () => {
    assert.equal(
      quoteRefreshIntervalMs(60_000, receivedAt, {
        intentId: "intent-1",
        expiresAt: new Date(receivedAt + 45_000),
        serverClockOffsetMs: 0,
      }),
      44_001
    );
  });

  it("is the host's interval when the route outlives it", () => {
    assert.equal(
      quoteRefreshIntervalMs(60_000, receivedAt, expiringIn(1_800_000)),
      60_000
    );
  });

  it("is cut to the route's expiry when that comes first", () => {
    assert.equal(
      quoteRefreshIntervalMs(60_000, receivedAt, expiringIn(45_000)),
      45_000
    );
  });

  it("is the expiry exactly when the two coincide", () => {
    assert.equal(
      quoteRefreshIntervalMs(60_000, receivedAt, expiringIn(60_000)),
      60_000
    );
  });

  it("counts to the expiry on the server's clock, whichever way the device is off", () => {
    for (const offsetMs of [-300_000, -1, 1, 300_000]) {
      assert.equal(
        quoteRefreshIntervalMs(
          60_000,
          receivedAt,
          expiringIn(45_000, offsetMs)
        ),
        45_000,
        `offset ${offsetMs}`
      );
    }
  });

  it("refreshes at once a route that arrived already expired", () => {
    for (const late of [0, 1, 90_000]) {
      assert.equal(
        quoteRefreshIntervalMs(60_000, receivedAt, expiringIn(-late)),
        1
      );
    }
  });

  it("refuses an invalid expiry instead of counting down forever", () => {
    assert.throws(
      () =>
        quoteRefreshIntervalMs(60_000, receivedAt, {
          intentId: "intent-1",
          expiresAt: new Date(Number.NaN),
          serverClockOffsetMs: 0,
        }),
      {
        message: `A quote refresh interval needs a finite time to expiry (expiresAt Invalid Date, received at ${receivedAt}).`,
      }
    );
  });

  it("is always a valid countdown interval no later than either bound", () => {
    const random = mulberry32(433);
    for (let i = 0; i < 5000; i++) {
      const refreshMs = 1 + Math.floor(random() * MAX_ROUTE_REFRESH_MS);
      const untilExpiryMs = Math.floor(
        (random() - 0.2) * 2 * MAX_ROUTE_REFRESH_MS
      );
      const offsetMs = Math.floor((random() - 0.5) * 2 * 86_400_000);
      const interval = quoteRefreshIntervalMs(
        refreshMs,
        receivedAt,
        expiringIn(untilExpiryMs, offsetMs)
      );
      const context = `refresh ${refreshMs}, expiry in ${untilExpiryMs}, offset ${offsetMs}`;
      assert.ok(Number.isSafeInteger(interval) && interval >= 1, context);
      assert.ok(interval <= refreshMs, context);
      assert.ok(interval <= Math.max(1, untilExpiryMs), context);
      // It is one of the bounds, never something in between.
      assert.ok(
        interval === refreshMs || interval === Math.max(1, untilExpiryMs),
        context
      );
      // quoteCountdown accepts it, and it runs out by the expiry.
      assert.equal(quoteCountdown(interval, interval).expired, true, context);
    }
  });
});
