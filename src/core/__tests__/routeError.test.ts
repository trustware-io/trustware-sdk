import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RouteError,
  formatMinimum,
  isRouteError,
  parseRouteError,
  routeErrorFromResponse,
} from "src/core/routeError";

/** A 404 exactly as iluvatar's returnProviderOutcomes renders it. */
const noRouteBody = {
  error:
    "no route available for this pair (squid: amount_too_low; relay: no_routes)",
  code: "no_route_available",
  providers: [
    {
      name: "squid",
      outcome: "declined",
      code: "amount_too_low",
      message: "Minimum swap amount for this route is 20.0 USDC",
    },
    {
      name: "relay",
      outcome: "declined",
      code: "no_routes",
      message: "provider returned no routes",
    },
  ],
};

describe("routeErrorFromResponse", () => {
  it("keeps the message the SDK has always thrown", () => {
    // Every existing caller reads err.message; the structure is additive.
    const err = routeErrorFromResponse(
      404,
      noRouteBody,
      "Failed to build route"
    );
    assert.equal(err.message, noRouteBody.error);
    assert.ok(err instanceof Error);
    assert.ok(isRouteError(err));
  });

  it("carries the status, verdict and per-provider outcomes", () => {
    const err = routeErrorFromResponse(
      404,
      noRouteBody,
      "Failed to build route"
    );
    assert.equal(err.status, 404);
    assert.equal(err.code, "no_route_available");
    assert.equal(err.isNoRouteAvailable, true);
    assert.deepEqual(err.providerCodes, ["amount_too_low", "no_routes"]);
  });

  it("falls back to the caller's message when the body carried none", () => {
    const err = routeErrorFromResponse(502, {}, "Failed to build route");
    assert.equal(err.message, "Failed to build route");
    assert.deepEqual(err.providers, []);
    assert.equal(err.isNoRouteAvailable, false);
  });

  it("survives a body that is not the shape we expect", () => {
    const err = routeErrorFromResponse(500, null, "Failed to build route");
    assert.equal(err.message, "Failed to build route");
    assert.deepEqual(err.providers, []);
  });

  it("ignores a providers field that is not an array of objects", () => {
    const err = routeErrorFromResponse(
      404,
      { error: "no route available for this pair", providers: "squid" },
      "Failed to build route"
    );
    assert.deepEqual(err.providers, []);
  });

  it("drops a provider entry whose identifying fields are not strings", () => {
    // A malformed entry must not turn the route failure into a parse failure
    // later on — `message.match` on a number would throw inside parseRouteError.
    const err = routeErrorFromResponse(
      404,
      {
        error: "no route available for this pair (squid: amount_too_low)",
        providers: [
          {
            name: "squid",
            outcome: "declined",
            code: "amount_too_low",
            message: 20,
          },
          { name: 7, outcome: "declined", code: "no_routes", message: "x" },
          { name: "relay", outcome: "declined", code: "no_routes" },
          null,
          "lifi",
        ],
      },
      "Failed to build route"
    );
    assert.deepEqual(err.providers, [
      {
        name: "squid",
        outcome: "declined",
        code: "amount_too_low",
        message: "",
      },
      { name: "relay", outcome: "declined", code: "no_routes", message: "" },
    ]);
    const facts = parseRouteError(err);
    assert.ok(facts);
    assert.deepEqual(facts.codes, ["amount_too_low", "no_routes"]);
    assert.equal(facts.minimum, undefined);
  });
});

describe("isRouteError", () => {
  it("recognizes a RouteError from another realm by shape", () => {
    // A bundle boundary can hand us an object whose Error prototype is not
    // ours; the structural fields are what matter.
    const foreign = Object.assign(Object.create(null), {
      name: "RouteError",
      message: "no route available for this pair (squid: no_routes)",
      status: 404,
      code: "no_route_available",
      providers: [
        { name: "squid", outcome: "declined", code: "no_routes", message: "" },
      ],
    });
    assert.ok(isRouteError(foreign));
    assert.deepEqual(parseRouteError(foreign)?.codes, ["no_routes"]);
    assert.equal(isRouteError(null), false);
    assert.equal(isRouteError({ name: "RouteError" }), false);
  });
});

describe("parseRouteError", () => {
  it("reads the verdict off a RouteError", () => {
    const facts = parseRouteError(
      routeErrorFromResponse(404, noRouteBody, "x")
    );
    assert.ok(facts);
    assert.deepEqual(facts.codes, ["amount_too_low", "no_routes"]);
    assert.equal(facts.allDeclined, true);
    assert.deepEqual(facts.minimum, { amount: "20", symbol: "USDC" });
  });

  it("recovers the codes from a bare summary string", () => {
    // The widget flattens errors to strings on the way into component state,
    // so the string path is the one that runs in practice.
    const facts = parseRouteError(noRouteBody.error);
    assert.ok(facts);
    assert.deepEqual(facts.codes, ["amount_too_low", "no_routes"]);
    assert.equal(facts.allDeclined, true);
  });

  it("marks a round containing a real failure as not all-declined", () => {
    const facts = parseRouteError(
      "routing providers failed to answer (squid: provider_error; relay: no_routes)"
    );
    assert.ok(facts);
    assert.equal(facts.allDeclined, false);
  });

  it("does not read routing codes out of ordinary prose", () => {
    // "connection timeout" is not the provider outcome `timeout`. Without the
    // summary guard this misfiled every timeout as a routing verdict.
    assert.equal(parseRouteError("connection timeout while fetching"), null);
    assert.equal(parseRouteError("Error: timeout"), null);
    assert.equal(parseRouteError(new Error("no_routes")), null);
    assert.equal(parseRouteError(""), null);
    assert.equal(parseRouteError(null), null);
    assert.equal(parseRouteError(undefined), null);
  });

  it("returns null for a summary with no recognizable codes", () => {
    assert.equal(parseRouteError("no route available for this pair"), null);
  });

  it("stays linear on oversized or colon-less summaries", () => {
    // Response text is untrusted input to these parsers; neither a long
    // identifier with no ":" nor a huge body may cost more than one pass.
    const longIdentifier =
      "no route available for this pair (" + "a".repeat(50_000) + ")";
    const started = Date.now();
    assert.equal(parseRouteError(longIdentifier), null);
    assert.ok(Date.now() - started < 200);

    const stillParses =
      "no route available for this pair (" +
      "a".repeat(4_000) +
      "; squid: no_routes)";
    assert.deepEqual(parseRouteError(stillParses)?.codes, ["no_routes"]);
  });

  it("reads the backend's own minimum wording too", () => {
    const facts = parseRouteError(
      new RouteError({
        message: "no route available for this pair (squid: amount_too_low)",
        status: 404,
        code: "no_route_available",
        providers: [
          {
            name: "squid",
            outcome: "declined",
            code: "amount_too_low",
            message:
              'provider "squid" requires at least $20.00 USD for this Solana route',
          },
        ],
      })
    );
    assert.ok(facts);
    assert.deepEqual(facts.minimum, { amount: "20", symbol: "USD" });
  });
});

describe("minimum amounts", () => {
  function minimumOf(message: string) {
    return parseRouteError(
      new RouteError({
        message: "no route available for this pair (squid: amount_too_low)",
        status: 404,
        providers: [
          {
            name: "squid",
            outcome: "declined",
            code: "amount_too_low",
            message,
          },
        ],
      })
    )?.minimum;
  }

  it("trims padding without touching significant digits", () => {
    assert.deepEqual(
      minimumOf("Minimum swap amount for this route is 20.00 USDC"),
      {
        amount: "20",
        symbol: "USDC",
      }
    );
    assert.deepEqual(
      minimumOf("Minimum swap amount for this route is 20.50 USDC"),
      {
        amount: "20.5",
        symbol: "USDC",
      }
    );
    assert.deepEqual(
      minimumOf("Minimum swap amount for this route is 1,000 USDT"),
      {
        amount: "1000",
        symbol: "USDT",
      }
    );
    assert.deepEqual(
      minimumOf("Minimum swap amount for this route is 100 USDC"),
      {
        amount: "100",
        symbol: "USDC",
      }
    );
  });

  it("handles a long zero-padded amount in one pass", () => {
    const padded =
      "Minimum swap amount for this route is 20." +
      "0".repeat(3_000) +
      "1 USDC";
    const started = Date.now();
    const minimum = minimumOf(padded);
    assert.ok(Date.now() - started < 200);
    assert.equal(minimum?.symbol, "USDC");
    assert.ok(minimum?.amount.startsWith("20.0"));
    assert.ok(minimum?.amount.endsWith("1"));
  });
});

describe("formatMinimum", () => {
  it("renders a token minimum and a dollar minimum differently", () => {
    assert.equal(formatMinimum({ amount: "20", symbol: "USDC" }), "20 USDC");
    assert.equal(formatMinimum({ amount: "20", symbol: "USD" }), "$20");
    assert.equal(formatMinimum({ amount: "20", symbol: "" }), "20");
    assert.equal(formatMinimum(undefined), "");
  });
});
