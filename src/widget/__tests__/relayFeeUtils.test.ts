import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeRelayFeeUsd,
  computeAdjustedSliderMax,
} from "../utils/relayFeeUtils";

describe("computeRelayFeeUsd", () => {
  it("returns 0 when isNativeSelected is true", () => {
    const route = {
      sponsorship: { paymaster: "0x1" },
      txReq: { value: "1000000000000000000" },
    };
    assert.equal(computeRelayFeeUsd(route, true), 0);
  });

  it("returns 0 when routeResult is null", () => {
    assert.equal(computeRelayFeeUsd(null, false), 0);
  });

  it("returns 0 when route has no sponsorship", () => {
    const route = { txReq: { value: "1000000000000000000" } };
    assert.equal(computeRelayFeeUsd(route, false), 0);
  });

  it("returns 0 when txReq.value is 0", () => {
    const route = { sponsorship: { paymaster: "0x1" }, txReq: { value: "0" } };
    assert.equal(computeRelayFeeUsd(route, false), 0);
  });

  it("returns 0 when txReq.value is absent", () => {
    const route = { sponsorship: { paymaster: "0x1" }, txReq: {} };
    assert.equal(computeRelayFeeUsd(route, false), 0);
  });

  it("sums amountUSD from fee costs array", () => {
    const route = {
      sponsorship: { paymaster: "0x1" },
      txReq: { value: "1000000000000000000" },
      route: {
        estimate: {
          fees: [{ amountUSD: "1.50" }, { amountUSD: "0.75" }],
        },
      },
    };
    const result = computeRelayFeeUsd(route, false);
    assert.ok(
      Math.abs(result - 2.25) < 0.0001,
      `expected ~2.25, got ${result}`
    );
  });

  it("falls back to amountUsd (lowercase) when amountUSD absent", () => {
    const route = {
      sponsorship: { paymaster: "0x1" },
      txReq: { value: "1000000000000000000" },
      route: {
        estimate: {
          fees: [{ amountUsd: "3.00" }],
        },
      },
    };
    const result = computeRelayFeeUsd(route, false);
    assert.ok(Math.abs(result - 3.0) < 0.0001);
  });

  it("falls back to fromAmountUsd - toAmountMinUsd when fees sum to 0", () => {
    const route = {
      sponsorship: { paymaster: "0x1" },
      txReq: { value: "1000000000000000000" },
      route: {
        estimate: {
          fees: [],
          fromAmountUsd: "100.00",
          toAmountMinUsd: "95.50",
        },
      },
    };
    const result = computeRelayFeeUsd(route, false);
    assert.ok(Math.abs(result - 4.5) < 0.0001, `expected ~4.5, got ${result}`);
  });

  it("fallback never returns negative (clamps to 0)", () => {
    const route = {
      sponsorship: { paymaster: "0x1" },
      txReq: { value: "1000000000000000000" },
      route: {
        estimate: {
          fees: [],
          fromAmountUsd: "90.00",
          toAmountMinUsd: "95.00",
        },
      },
    };
    assert.equal(computeRelayFeeUsd(route, false), 0);
  });

  it("ignores NaN fee entries gracefully", () => {
    const route = {
      sponsorship: { paymaster: "0x1" },
      txReq: { value: "1000000000000000000" },
      route: {
        estimate: {
          fees: [{ amountUSD: "not-a-number" }, { amountUSD: "2.00" }],
        },
      },
    };
    const result = computeRelayFeeUsd(route, false);
    assert.ok(Math.abs(result - 2.0) < 0.0001);
  });
});

describe("computeAdjustedSliderMax", () => {
  it("returns effectiveSliderMax unchanged when relayFeeUsd is 0", () => {
    assert.equal(computeAdjustedSliderMax(100, 0, 3000), 100);
  });

  it("returns effectiveSliderMax unchanged when tokenPriceUSD is 0", () => {
    assert.equal(computeAdjustedSliderMax(100, 5, 0), 100);
  });

  it("returns undefined when effectiveSliderMax is undefined and no relay fee", () => {
    assert.equal(computeAdjustedSliderMax(undefined, 0, 3000), undefined);
  });

  it("returns undefined when effectiveSliderMax is undefined even with relay fee", () => {
    assert.equal(computeAdjustedSliderMax(undefined, 5, 3000), undefined);
  });

  it("deducts relay fee reserve with 1.15x buffer from slider max", () => {
    // relayFeeUsd=10, tokenPriceUSD=2000, reserve = (10/2000)*1.15 = 0.00575
    // effectiveSliderMax=1.0 → adjusted = 1.0 - 0.00575 ≈ 0.99425
    const result = computeAdjustedSliderMax(1.0, 10, 2000);
    const expected = 1.0 - (10 / 2000) * 1.15;
    assert.ok(result !== undefined);
    assert.ok(
      Math.abs(result! - expected) < 1e-10,
      `expected ${expected}, got ${result}`
    );
  });

  it("clamps to 0 when relay fee reserve exceeds slider max", () => {
    // relayFeeUsd=100, tokenPriceUSD=1, reserve = 100*1.15 = 115 > 10
    const result = computeAdjustedSliderMax(10, 100, 1);
    assert.equal(result, 0);
  });
});
