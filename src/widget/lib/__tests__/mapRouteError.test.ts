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

/** The current API's 400: the caller's address was rejected pre-flight. */
function rejected(...names: string[]) {
  return routeErrorFromResponse(
    400,
    {
      error: "request rejected: invalid address",
      code: "invalid_address",
      providers: names.map((name) => ({
        name,
        outcome: "rejected",
        code: "invalid_address",
        message: `provider "${name}" rejected toAddress: invalid EVM address checksum`,
      })),
    },
    "Failed to build route"
  );
}

// The copy is the contract here, so it is spelled out rather than imported.
const LIQUIDITY = {
  category: "route_error",
  title: "Insufficient Liquidity",
  message:
    "There isn't enough liquidity to route this swap right now. Try a different token or network, or a smaller amount.",
};
const NO_ROUTE = {
  category: "no_route",
  title: "No Route Found",
  message:
    "No swap route exists for this pair. Try a different amount or token.",
};
const BUSY = {
  category: "route_error",
  title: "Route Unavailable",
  message: "Routing is busy right now. Please wait a moment and try again.",
};

describe("mapError on a routing verdict", () => {
  it("blames the address, not the pair, when the backend rejected it", () => {
    // Before this the rejection read as "No Route Found — try a different
    // token": every outcome was non-"failed", so it counted as all-declined.
    const mapped = mapError(rejected("squid", "lifi"));
    assert.equal(mapped.category, "invalid_address");
    assert.equal(mapped.title, "Invalid Address");
    assert.match(mapped.message, /check the address/i);
  });

  it("keeps the rejection verdict next to a decline", () => {
    const err = routeErrorFromResponse(
      400,
      {
        error: "request rejected: invalid address",
        code: "invalid_address",
        providers: [
          {
            name: "lifi",
            outcome: "rejected",
            code: "invalid_address",
            message: "",
          },
          {
            name: "relay",
            outcome: "declined",
            code: "no_routes",
            message: "",
          },
        ],
      },
      "Failed to build route"
    );
    assert.equal(mapError(err).category, "invalid_address");
  });

  it("reads the flattened 400 summary the same way", () => {
    const mapped = mapError("request rejected: invalid address");
    assert.equal(mapped.category, "invalid_address");
    assert.equal(mapped.title, "Invalid Address");
  });

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

  // Squid alone on a pair it cannot route at any size, as on 2026-10-29 for
  // Base USDC to Monad: the advice leads with a different token or network.
  it("reports liquidity, leading with token or network, when that is the only reason", () => {
    assert.deepEqual(mapError(declined("insufficient_liquidity")), LIQUIDITY);
  });

  it("reports liquidity when every provider cites it", () => {
    assert.deepEqual(
      mapError(
        declined(
          "insufficient_liquidity",
          "insufficient_liquidity",
          "insufficient_liquidity"
        )
      ),
      LIQUIDITY
    );
  });

  // Every provider enabled: Squid says "Low liquidity" for a pair the others
  // call unsupported. Nobody can route it, so "try a smaller amount" is wrong.
  it("calls it no route when only some providers cite liquidity", () => {
    assert.deepEqual(
      mapError(
        declined("insufficient_liquidity", "pair_unsupported", "no_routes")
      ),
      NO_ROUTE
    );
  });

  it("does not claim the pair is unroutable when a provider failed", () => {
    // The backend deliberately refuses to call this a no-route; so must we.
    assert.deepEqual(
      mapError(failed(["failed", "provider_error"], ["declined", "no_routes"])),
      BUSY
    );
  });

  // A 429 from Squid arrives as a failed provider: it answered, but refused
  // to quote, so "did not respond" was untrue.
  it("asks for a retry, not a different pair, when a provider is rate-limited", () => {
    assert.deepEqual(
      mapError(
        failed(
          ["failed", "provider_error"],
          ["declined", "insufficient_liquidity"]
        )
      ),
      BUSY
    );
  });

  it("only reports liquidity when every provider's decline cites it", () => {
    // Every assignment of these codes to one, two or three providers.
    const codes = [
      "insufficient_liquidity",
      "pair_unsupported",
      "chain_unsupported",
      "no_routes",
      "amount_too_low",
      "destination_call_failed",
    ];
    const assignments: string[][] = codes.map((code) => [code]);
    for (let size = 2; size <= 3; size++) {
      for (const prefix of assignments.filter((a) => a.length === size - 1)) {
        for (const code of codes) assignments.push([...prefix, code]);
      }
    }
    assert.equal(assignments.length, 6 + 36 + 216);

    for (const assignment of assignments) {
      const mapped = mapError(declined(...assignment));
      const allLiquidity = assignment.every(
        (code) => code === "insufficient_liquidity"
      );
      assert.equal(
        mapped.title === LIQUIDITY.title,
        allLiquidity,
        `${assignment.join(", ")} -> ${mapped.title}`
      );
    }
  });

  // The message the routing API flattens to when only provider text survives.
  it("reads Squid's own low-liquidity text the same way", () => {
    assert.deepEqual(
      mapError(
        'squid api error: status=400 body={"message":"Low liquidity, please reduce swap amount and try again","statusCode":400}'
      ),
      LIQUIDITY
    );
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
    [
      "liquidity beside unsupported",
      declined("insufficient_liquidity", "pair_unsupported"),
    ],
    [
      "rate-limited beside a decline",
      failed(
        ["failed", "provider_error"],
        ["declined", "insufficient_liquidity"]
      ),
    ],
    [
      "Squid's low-liquidity text",
      'squid api error: status=400 body={"message":"Low liquidity, please reduce swap amount and try again"}',
    ],
    ["pair_unsupported", declined("pair_unsupported")],
    ["destination_call_failed", declined("destination_call_failed")],
    ["provider_error", failed(["failed", "provider_error"])],
    ["invalid_address", rejected("squid", "lifi")],
    ["flattened 400 summary", "request rejected: invalid address"],
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

describe("mapError on the SDK's own value verdict", () => {
  // buildRoute refuses a route whose fees exceed its output with the same
  // structure the API uses for its verdicts, so both widget modes read it
  // through the codes rather than the sentence.
  it("names the fees verdict and blocks rather than suggests a retry", () => {
    const mapped = mapError(declined("fees_exceed_output"));
    assert.equal(mapped.category, "fees_exceed_output");
    assert.equal(mapped.title, "Fees Exceed Amount Received");
    assert.match(mapped.message, /costs more in fees than it delivers/);
  });

  // The widget stores the mapped sentence and maps it again on render.
  it("recognizes its own sentence on the second pass", () => {
    const first = mapError(declined("fees_exceed_output"));
    assert.deepEqual(mapError(first.message), first);
  });
});
