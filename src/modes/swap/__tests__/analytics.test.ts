import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildSwapPaymentParams,
  claimAttemptOnce,
} from "src/modes/swap/analytics";

const AVALANCHE = {
  chainId: "43114",
  networkName: "Avalanche",
  axelarChainName: "Avalanche",
};
const BASE = { chainId: "8453", axelarChainName: "base" };

describe("buildSwapPaymentParams", () => {
  // BI (iluvatar/db/g4a_repo.go) filters on these five keys; a rename silently
  // drops the row from every swap-mode metric.
  it("emits exactly deposit mode's key set", () => {
    const params = buildSwapPaymentParams({
      fromChain: AVALANCHE,
      fromToken: { symbol: "USDC" },
      toChain: BASE,
      toToken: { symbol: "WETH" },
      domain: "https://app.example",
    });

    assert.deepEqual(Object.keys(params).sort(), [
      "domain",
      "from_chain",
      "from_token",
      "to_chain",
      "to_token",
    ]);
  });

  // The whole point of the swap payload: destination is runtime state, not
  // config.routes, which swap mode does not require.
  it("reads the destination from the passed-in swap state", () => {
    const params = buildSwapPaymentParams({
      fromChain: AVALANCHE,
      fromToken: { symbol: "USDC" },
      toChain: BASE,
      toToken: { symbol: "WETH" },
      domain: "https://app.example",
    });

    assert.equal(params.to_chain, "base");
    assert.equal(params.to_token, "WETH");
    assert.equal(params.from_chain, "Avalanche");
    assert.equal(params.from_token, "USDC");
    assert.equal(params.domain, "https://app.example");
  });

  it("falls back networkName → axelarChainName → chainId", () => {
    assert.equal(
      buildSwapPaymentParams({
        fromChain: { chainId: 137 },
        fromToken: null,
        toChain: { networkName: "Linea", axelarChainName: "linea" },
        toToken: null,
        domain: "d",
      }).from_chain,
      137
    );
    assert.equal(
      buildSwapPaymentParams({
        fromChain: { chainId: 137 },
        fromToken: null,
        toChain: { networkName: "Linea", axelarChainName: "linea" },
        toToken: null,
        domain: "d",
      }).to_chain,
      "Linea"
    );
  });

  it("labels missing selections rather than dropping the param", () => {
    const params = buildSwapPaymentParams({
      fromChain: null,
      fromToken: undefined,
      toChain: null,
      toToken: undefined,
      domain: "d",
    });
    assert.equal(params.from_chain, "unknown");
    assert.equal(params.from_token, "unknown");
    assert.equal(params.to_chain, "unknown");
    assert.equal(params.to_token, "unknown");
  });
});

describe("claimAttemptOnce", () => {
  const routeA = { intentId: "intent-1" };
  const routeB = { intentId: "intent-2" };

  it("reports the first claim only", () => {
    const slot = { current: null as object | null };
    assert.equal(claimAttemptOnce(slot, routeA), true);
    assert.equal(claimAttemptOnce(slot, routeA), false);
    assert.equal(claimAttemptOnce(slot, routeA), false);
  });

  // A retry always rebuilds the route, so the second attempt is a new object
  // and must be counted; only a repeat of the same one is suppressed.
  it("reports a new attempt after a completed one", () => {
    const slot = { current: null as object | null };
    assert.equal(claimAttemptOnce(slot, routeA), true);
    assert.equal(claimAttemptOnce(slot, routeB), true);
    assert.equal(claimAttemptOnce(slot, routeB), false);
  });

  // A late poll from a superseded attempt resolving after a newer one has
  // already reported must not re-report the older attempt either.
  it("suppresses a stale claim it has already seen", () => {
    const slot = { current: null as object | null };
    claimAttemptOnce(slot, routeA);
    claimAttemptOnce(slot, routeB);
    assert.equal(claimAttemptOnce(slot, routeB), false);
  });

  // The whole reason the key is the route object and not its intentId:
  // buildRoute falls back to intentId "" when the backend omits one, and an
  // id-keyed guard would drop payment_initiated for every such attempt.
  it("still claims an attempt whose intent id is missing", () => {
    const slot = { current: null as object | null };
    const noId = { intentId: "" };
    const alsoNoId = { intentId: "" };
    assert.equal(claimAttemptOnce(slot, noId), true);
    assert.equal(claimAttemptOnce(slot, noId), false);
    assert.equal(claimAttemptOnce(slot, alsoNoId), true);
  });

  it("never claims a missing attempt", () => {
    const slot = { current: null as object | null };
    assert.equal(claimAttemptOnce(slot, undefined), false);
    assert.equal(claimAttemptOnce(slot, null), false);
    assert.equal(slot.current, null);
  });

  // initiated and completed keep separate slots, so one does not mask the other.
  it("tracks slots independently", () => {
    const initiated = { current: null as object | null };
    const completed = { current: null as object | null };
    assert.equal(claimAttemptOnce(initiated, routeA), true);
    assert.equal(claimAttemptOnce(completed, routeA), true);
  });
});
