import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { routeErrorFromResponse } from "src/core/routeError";
import { mapError } from "src/widget/lib/mapError";

function routeError(
  summary: string,
  providers: Array<{
    name: string;
    outcome: string;
    code: string;
    message: string;
  }>
) {
  return routeErrorFromResponse(
    404,
    { error: summary, code: "no_route_available", providers },
    "Failed to build route"
  );
}

describe("mapError on a routing verdict", () => {
  it("names the minimum a provider asked for", () => {
    // Before this, an $8 EVM->Solana swap read "No Route Found — try a
    // different token", while Squid had said the amount was the problem and
    // named the figure.
    const mapped = mapError(
      routeError("no route available for this pair (squid: amount_too_low)", [
        {
          name: "squid",
          outcome: "declined",
          code: "amount_too_low",
          message: "Minimum swap amount for this route is 20.0 USDC",
        },
      ])
    );
    assert.equal(mapped.category, "no_route");
    assert.equal(mapped.title, "Amount Below the Minimum");
    assert.match(mapped.message, /20 USDC/);
  });

  it("falls back to a figure-less minimum message", () => {
    const mapped = mapError(
      "no route available for this pair (squid: amount_too_low; relay: amount_too_low)"
    );
    assert.equal(mapped.title, "Amount Below the Minimum");
    assert.match(mapped.message, /larger amount/);
  });

  it("says nothing about the amount when the declines disagree about direction", () => {
    // amount_too_low says "bigger", insufficient_liquidity says "smaller".
    const mapped = mapError(
      "no route available for this pair (squid: amount_too_low; lifi: insufficient_liquidity)"
    );
    assert.equal(mapped.title, "No Route Found");
  });

  it("reports liquidity when that is the only reason", () => {
    const mapped = mapError(
      "no route available for this pair (squid: insufficient_liquidity)"
    );
    assert.equal(mapped.category, "route_error");
    assert.equal(mapped.title, "Insufficient Liquidity");
  });

  it("does not claim the pair is unroutable when a provider failed", () => {
    // The backend deliberately refuses to call this a no-route; so must we.
    const mapped = mapError(
      "routing providers failed to answer (squid: provider_error; relay: no_routes)"
    );
    assert.equal(mapped.category, "route_error");
    assert.notEqual(mapped.title, "No Route Found");
  });

  it("blames the caller's destination call when that is what reverted", () => {
    const mapped = mapError(
      "no route available for this pair (squid: destination_call_failed; lifi: destination_call_failed)"
    );
    assert.equal(mapped.title, "Destination Call Failed");
  });

  it("still reports an unsupported pair as no route", () => {
    const mapped = mapError(
      "no route available for this pair (squid: pair_unsupported; relay: chain_unsupported)"
    );
    assert.equal(mapped.category, "no_route");
    assert.equal(mapped.title, "No Route Found");
  });

  it("leaves non-routing errors to the existing rules", () => {
    assert.equal(mapError("Failed to fetch").category, "network_error");
    assert.equal(mapError("execution reverted").category, "transaction_failed");
    assert.equal(
      mapError("insufficient funds for gas").category,
      "insufficient_funds"
    );
    assert.equal(mapError("connection timeout").category, "timeout");
  });
});

// The widget maps an error, stores the message in component state, and maps it
// again on the way out (SwapMode renders mapError(route.error)). A message that
// did not classify the same way the second time became "Something Went Wrong".
describe("mapError is stable when applied to its own output", () => {
  const inputs = [
    "no route available for this pair (squid: amount_too_low)",
    "no route available for this pair (squid: amount_too_low; relay: amount_too_low)",
    "no route available for this pair (squid: insufficient_liquidity)",
    "no route available for this pair (squid: pair_unsupported)",
    "no route available for this pair (squid: destination_call_failed)",
    "routing providers failed to answer (squid: provider_error)",
    "insufficient funds for gas",
    "execution reverted",
    "Failed to fetch",
  ];

  for (const input of inputs) {
    it(`holds for: ${input}`, () => {
      const once = mapError(input);
      const twice = mapError(once.message);
      assert.equal(
        twice.category,
        once.category,
        `category drifted for ${input}`
      );
      assert.equal(twice.title, once.title, `title drifted for ${input}`);
    });
  }
});
