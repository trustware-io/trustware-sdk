import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { resolveConfig } from "src/config/merge";
import {
  DEFAULT_ROUTE_REFRESH_MS,
  MAX_ROUTE_REFRESH_MS,
  resolveRouteRefreshMs,
} from "src/config/routeRefresh";
import { TrustwareError } from "src/errors/TrustwareError";
import { TrustwareErrorCode } from "src/errors/errorCodes";
import type { TrustwareConfigOptions } from "src/types";

function depositConfig(routeRefreshMs?: unknown): TrustwareConfigOptions {
  return {
    apiKey: "test-key",
    routes: {
      toChain: "8453",
      toToken: "USDC",
      options: { routeRefreshMs },
    },
  } as TrustwareConfigOptions;
}

function swapConfig(routeRefreshMs?: unknown): TrustwareConfigOptions {
  return {
    apiKey: "test-key",
    mode: "swap",
    routes: { options: { routeRefreshMs } },
  } as unknown as TrustwareConfigOptions;
}

function invalidMessage(shown: string) {
  return (
    "TrustwareConfig: 'routes.options.routeRefreshMs' must be a number of " +
    `milliseconds from 1 to 2147483647 (got ${shown}).`
  );
}

describe("routes.options.routeRefreshMs", () => {
  it("pins the default and the timer ceiling", () => {
    assert.equal(DEFAULT_ROUTE_REFRESH_MS, 60_000);
    assert.equal(MAX_ROUTE_REFRESH_MS, 2 ** 31 - 1);
  });

  it("defaults to 60 s in both modes when unset", () => {
    assert.equal(
      resolveConfig(depositConfig()).routes.options.routeRefreshMs,
      60_000
    );
    assert.equal(
      resolveConfig(swapConfig()).routes.options.routeRefreshMs,
      60_000
    );
    assert.equal(
      resolveConfig({ apiKey: "test-key", mode: "swap" }).routes.options
        .routeRefreshMs,
      60_000,
      "swap mode with no routes at all"
    );
  });

  it("passes a configured interval through unchanged, in both modes", () => {
    for (const ms of [1, 1.5, 10_000, 15_000, MAX_ROUTE_REFRESH_MS]) {
      assert.equal(
        resolveConfig(depositConfig(ms)).routes.options.routeRefreshMs,
        ms
      );
      assert.equal(
        resolveConfig(swapConfig(ms)).routes.options.routeRefreshMs,
        ms
      );
    }
  });

  it("keeps the other route options beside it", () => {
    const resolved = resolveConfig({
      apiKey: "test-key",
      routes: {
        toChain: "8453",
        toToken: "USDC",
        options: { routeRefreshMs: 15_000, minAmountOut: "10" },
      },
    });
    assert.deepEqual(resolved.routes.options, {
      routeRefreshMs: 15_000,
      minAmountOut: "10",
    });
  });

  it("refuses every value outside 1 to 2^31-1 ms, with the value named, in both modes", () => {
    const cases: [unknown, string][] = [
      [0, "0"],
      [-1, "-1"],
      [0.5, "0.5"],
      [MAX_ROUTE_REFRESH_MS + 1, "2147483648"],
      [Number.NaN, "NaN"],
      [Number.POSITIVE_INFINITY, "Infinity"],
      [Number.NEGATIVE_INFINITY, "-Infinity"],
      ["15000", '"15000"'],
      [null, "null"],
      [true, "true"],
    ];
    for (const [raw, shown] of cases) {
      for (const config of [depositConfig(raw), swapConfig(raw)]) {
        assert.throws(
          () => resolveConfig(config),
          (err) => {
            assert.ok(err instanceof TrustwareError);
            assert.equal(err.code, TrustwareErrorCode.INVALID_CONFIG);
            assert.equal(err.message, invalidMessage(shown));
            assert.equal(
              err.userMessage,
              "The configured route refresh interval is invalid."
            );
            return true;
          },
          `routeRefreshMs ${shown}`
        );
      }
      assert.throws(() => resolveRouteRefreshMs(raw), {
        message: invalidMessage(shown),
      });
    }
  });
});
