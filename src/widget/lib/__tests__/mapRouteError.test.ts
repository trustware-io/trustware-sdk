import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { routeErrorFromResponse } from "src/core/routeError";
import { mapError } from "src/widget/lib/mapError";

type Provider = {
  name: string;
  outcome: string;
  code: string;
  message: string;
};

function routeError(summary: string, providers: Provider[]) {
  return routeErrorFromResponse(
    404,
    { error: summary, code: "no_route_available", providers },
    "Failed to build route"
  );
}

/** The current API's 404: a bare summary, every verdict in `providers`. */
function declined(...codes: string[]) {
  return routeError(
    "no route available for this pair",
    codes.map((code, i) => ({
      name: `provider${i}`,
      outcome: "declined",
      code,
      message: "",
    }))
  );
}

/** The current API's 502: at least one provider failed. */
function failed(...entries: Array<[outcome: string, code: string]>) {
  return routeErrorFromResponse(
    502,
    {
      error: "routing providers failed to answer",
      code: "providers_failed",
      providers: entries.map(([outcome, code], i) => ({
        name: `provider${i}`,
        outcome,
        code,
        message: "",
      })),
    },
    "Failed to build route"
  );
}

describe("mapError on a routing verdict", () => {
  it("names the minimum a provider asked for", () => {
    // Before this, an $8 EVM->Solana swap read "No Route Found — try a
    // different token", while Squid had said the amount was the problem and
    // named the figure.
    const mapped = mapError(
      routeError("no route available for this pair", [
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
    const mapped = mapError(declined("amount_too_low", "amount_too_low"));
    assert.equal(mapped.title, "Amount Below the Minimum");
    assert.match(mapped.message, /larger amount/);
  });

  it("says nothing about the amount when the declines disagree about direction", () => {
    // amount_too_low says "bigger", insufficient_liquidity says "smaller".
    const mapped = mapError(
      declined("amount_too_low", "insufficient_liquidity")
    );
    assert.equal(mapped.title, "No Route Found");
  });

  it("reports liquidity when that is the only reason", () => {
    const mapped = mapError(declined("insufficient_liquidity"));
    assert.equal(mapped.category, "route_error");
    assert.equal(mapped.title, "Insufficient Liquidity");
  });

  it("does not claim the pair is unroutable when a provider failed", () => {
    // The backend deliberately refuses to call this a no-route; so must we.
    const mapped = mapError(
      failed(["failed", "provider_error"], ["declined", "no_routes"])
    );
    assert.equal(mapped.category, "route_error");
    assert.notEqual(mapped.title, "No Route Found");
  });

  it("blames the caller's destination call when that is what reverted", () => {
    const mapped = mapError(
      declined("destination_call_failed", "destination_call_failed")
    );
    assert.equal(mapped.title, "Destination Call Failed");
  });

  it("keeps a destination-call result on its own wording, not the cache", () => {
    // The self-mapped cache must not be what decides this: after many distinct
    // results have gone through, a second pass on a destination-call message
    // still has to read as "Destination Call Failed", not "Route Unavailable".
    for (let i = 0; i < 200; i++) {
      mapError(
        routeError("no route available for this pair", [
          {
            name: "squid",
            outcome: "declined",
            code: "amount_too_low",
            message: `Minimum swap amount for this route is ${i + 1}.5 USDC`,
          },
        ])
      );
    }
    const once = mapError(declined("destination_call_failed"));
    assert.equal(once.title, "Destination Call Failed");
    const twice = mapError(once.message);
    assert.equal(twice.title, "Destination Call Failed");
    assert.equal(twice.category, "route_error");
    // A never-seen phrasing takes the same rule without any cache help.
    const fresh = mapError("Destination contract call reverted at 0xabc");
    assert.equal(fresh.title, "Destination Call Failed");
  });

  it("still reports an unsupported pair as no route", () => {
    const mapped = mapError(declined("pair_unsupported", "chain_unsupported"));
    assert.equal(mapped.category, "no_route");
    assert.equal(mapped.title, "No Route Found");
  });

  it("reads a bare current-API summary as a plain no-route once flattened", () => {
    // If a caller stores err.message before classifying, the codes are gone;
    // the sentence alone still lands on the right category.
    const mapped = mapError("no route available for this pair");
    assert.equal(mapped.category, "no_route");
    assert.equal(mapped.title, "No Route Found");
  });

  it("still classifies a legacy summary that spelled the codes out", () => {
    // Backends before the verdict moved into `providers` alone.
    const mapped = mapError(
      "no route available for this pair (squid: amount_too_low; relay: amount_too_low)"
    );
    assert.equal(mapped.title, "Amount Below the Minimum");
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
  const inputs: Array<[label: string, input: unknown]> = [
    [
      "amount_too_low with a figure",
      routeError("no route available for this pair", [
        {
          name: "squid",
          outcome: "declined",
          code: "amount_too_low",
          message: "Minimum swap amount for this route is 20.0 USDC",
        },
      ]),
    ],
    ["amount_too_low x2", declined("amount_too_low", "amount_too_low")],
    ["insufficient_liquidity", declined("insufficient_liquidity")],
    ["pair_unsupported", declined("pair_unsupported")],
    ["destination_call_failed", declined("destination_call_failed")],
    ["provider_error", failed(["failed", "provider_error"])],
    ["bare summary string", "no route available for this pair"],
    ["insufficient funds for gas", "insufficient funds for gas"],
    ["execution reverted", "execution reverted"],
    ["Failed to fetch", "Failed to fetch"],
  ];

  for (const [label, input] of inputs) {
    it(`holds for: ${label}`, () => {
      const once = mapError(input);
      const twice = mapError(once.message);
      assert.equal(
        twice.category,
        once.category,
        `category drifted for ${label}`
      );
      assert.equal(twice.title, once.title, `title drifted for ${label}`);
    });
  }
});
