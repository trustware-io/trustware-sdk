import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resolveConfig } from "../merge";
import { TrustwareError } from "../../errors/TrustwareError";
import { TrustwareErrorCode } from "../../errors/errorCodes";
import type { TrustwareConfigOptions } from "../../types/";

function assertThrowsInvalidConfig(fn: () => unknown) {
  try {
    fn();
    assert.fail("expected resolveConfig to throw");
  } catch (err) {
    assert.ok(err instanceof TrustwareError);
    assert.equal(
      (err as TrustwareError).code,
      TrustwareErrorCode.INVALID_CONFIG
    );
  }
}

describe("resolveConfig - deposit mode (default)", () => {
  it("throws INVALID_CONFIG when routes.toChain/toToken are missing", () => {
    assertThrowsInvalidConfig(() =>
      resolveConfig({
        apiKey: "test-key",
        routes: {},
      } as unknown as TrustwareConfigOptions)
    );
  });

  it("resolves successfully with valid routes and defaults mode to 'deposit'", () => {
    const resolved = resolveConfig({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
    assert.equal(resolved.mode, "deposit");
    assert.equal(resolved.routes.toChain, "8453");
    assert.equal(resolved.routes.toToken, "USDC");
    assert.equal(resolved.features.swapMode, false);
  });

  it("still throws on an invalid toAddress for the configured chain", () => {
    assertThrowsInvalidConfig(() =>
      resolveConfig({
        apiKey: "test-key",
        routes: {
          toChain: "8453",
          toToken: "USDC",
          toAddress: "not-an-address",
        },
      })
    );
  });
});

describe("resolveConfig - swap mode", () => {
  it("resolves successfully with mode: 'swap' and no routes at all", () => {
    const resolved = resolveConfig({
      apiKey: "test-key",
      mode: "swap",
    });
    assert.equal(resolved.mode, "swap");
    assert.equal(resolved.routes.toChain, "");
    assert.equal(resolved.routes.toToken, "");
    assert.equal(resolved.features.swapMode, true);
  });

  it("does not require toChain/toToken even if a partial routes object is given", () => {
    const resolved = resolveConfig({
      apiKey: "test-key",
      mode: "swap",
      routes: { defaultSlippage: 2 },
    });
    assert.equal(resolved.mode, "swap");
    assert.equal(resolved.routes.defaultSlippage, 2);
  });
});

describe("resolveConfig - legacy features.swapMode (deprecated)", () => {
  let warnCalls: unknown[][];
  const originalWarn = console.warn;

  beforeEach(() => {
    warnCalls = [];
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };
  });

  it("still resolves successfully without routes and maps to mode: 'swap'", () => {
    const resolved = resolveConfig({
      apiKey: "test-key",
      features: { swapMode: true },
    } as unknown as TrustwareConfigOptions);
    assert.equal(resolved.mode, "swap");
    assert.equal(resolved.features.swapMode, true);
    assert.ok(
      warnCalls.length >= 1,
      "expected a deprecation warning for features.swapMode"
    );
    console.warn = originalWarn;
  });
});

describe("resolveConfig - balance streaming default", () => {
  it("streams by default", () => {
    const resolved = resolveConfig({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    } as unknown as TrustwareConfigOptions);
    assert.equal(resolved.features.balanceStreaming, true);
  });

  it("still lets an integrator opt out", () => {
    const resolved = resolveConfig({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
      features: { balanceStreaming: false },
    } as unknown as TrustwareConfigOptions);
    assert.equal(resolved.features.balanceStreaming, false);
  });
});
