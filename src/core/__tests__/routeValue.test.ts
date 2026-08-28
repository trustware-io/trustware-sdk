import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isValueDestroying, routeNetUsd } from "src/core/routeValue";

describe("routeNetUsd", () => {
  it("is output value minus fees", () => {
    assert.equal(
      routeNetUsd({ toAmountUsd: "1.0037", totalFeesUsd: "0.039" })?.toFixed(4),
      "0.9647"
    );
  });

  it("is null when the provider priced neither side", () => {
    assert.equal(routeNetUsd({}), null);
    assert.equal(routeNetUsd(undefined), null);
  });

  // Null means unknown, not fine — half a quote can't be scored.
  it("is null when only one side is priced", () => {
    assert.equal(routeNetUsd({ toAmountUsd: "1.0" }), null);
    assert.equal(routeNetUsd({ totalFeesUsd: "0.04" }), null);
  });

  it("is null on unparseable figures", () => {
    assert.equal(
      routeNetUsd({ toAmountUsd: "n/a", totalFeesUsd: "0.04" }),
      null
    );
  });
});

describe("isValueDestroying", () => {
  // The live Plume→ETH quote: $0.088 of fees against $0.051 of output, which
  // the backend scored net_usd -0.036990 and returned as the winner anyway.
  it("flags the route whose fees exceed its output", () => {
    assert.equal(
      isValueDestroying({ toAmountUsd: "0.050950", totalFeesUsd: "0.087940" }),
      true
    );
  });

  it("passes an ordinary route", () => {
    assert.equal(
      isValueDestroying({ toAmountUsd: "1.0037", totalFeesUsd: "0.039" }),
      false
    );
  });

  it("passes a route whose fees exactly equal its output", () => {
    assert.equal(
      isValueDestroying({ toAmountUsd: "0.05", totalFeesUsd: "0.05" }),
      false
    );
  });

  // An unpriced route must stay executable: blocking on missing data would
  // take out every provider that doesn't return USD figures.
  it("does not block when the estimate carries no USD figures", () => {
    assert.equal(isValueDestroying({}), false);
    assert.equal(isValueDestroying(undefined), false);
    assert.equal(isValueDestroying({ toAmountUsd: "0.05" }), false);
  });

  // Sub-cent figures on both sides are rounding noise, not a real signal.
  it("ignores dust where both sides are below the noise floor", () => {
    assert.equal(
      isValueDestroying({ toAmountUsd: "0.001", totalFeesUsd: "0.004" }),
      false
    );
  });

  it("still flags dust output against a real fee", () => {
    assert.equal(
      isValueDestroying({ toAmountUsd: "0.001", totalFeesUsd: "0.90" }),
      true
    );
  });
});
