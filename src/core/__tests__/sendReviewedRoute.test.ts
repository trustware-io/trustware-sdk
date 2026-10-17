import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildRouteForReview,
  sendReviewedRoute,
  type BuiltRoute,
} from "src/core/signTimeRoute";
import type { BuildRouteBody } from "src/core/routes";
import {
  SOLANA,
  REBUILT_SOLANA_TX,
  REVIEWED_EVM_DATA,
  REBUILT_EVM_DATA,
  SOLANA_REQUEST,
  EVM_REQUEST,
  REVIEWED_ESTIMATE,
  FLOOR_TO_AMOUNT,
  type Event,
  type RouteReply,
  stubBackend,
  solanaWallet,
  evmWallet,
  reviewedSolanaReply,
  rebuiltSolanaReply,
} from "./routeBackendStub";
import { isRouteError } from "src/core/routeError";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import {
  Trustware,
  buildRouteForReview as coreBuildRouteForReview,
  sendReviewedRoute as coreSendReviewedRoute,
} from "src/core";

describe("sendReviewedRoute", () => {
  const realFetch = globalThis.fetch;
  let events: Event[];

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    events = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  async function reviewSolanaRoute(
    rebuilt: RouteReply,
    request: BuildRouteBody = SOLANA_REQUEST
  ): Promise<BuiltRoute> {
    globalThis.fetch = stubBackend(events, [
      reviewedSolanaReply,
      rebuilt,
    ]) as typeof fetch;
    walletManager.attachWallet(solanaWallet(events));
    const reviewed = await buildRouteForReview(request);
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build"],
      "reviewing builds the route once"
    );
    return reviewed;
  }

  it("rebuilds a Solana route from the same request before the wallet signs, and signs the rebuilt transaction", async () => {
    const reviewed = await reviewSolanaRoute(
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: "989000" })
    );

    const outcome = await sendReviewedRoute(reviewed, SOLANA);

    // The wallet here ignores onAccepted, like a host-built one: the
    // receipt goes out as soon as it returns, exactly once.
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build", "sign", "receipt"]
    );
    const [reviewBuild, rebuild, sign, receipt] = events;
    assert.deepEqual(receipt, {
      kind: "receipt",
      intentId: "intent-rebuilt",
      txHash: "solana-signature-1",
    });
    assert.equal(reviewBuild.kind, "build");
    assert.equal(rebuild.kind, "build");
    assert.deepEqual(rebuild.body, reviewBuild.body, "same request again");
    assert.deepEqual(sign, { kind: "sign", data: REBUILT_SOLANA_TX });

    assert.equal(outcome.kind, "sent");
    if (outcome.kind !== "sent") return;
    assert.equal(outcome.hash, "solana-signature-1");
    assert.deepEqual(outcome.receipt, {
      intentId: "intent-rebuilt",
      txHash: "solana-signature-1",
    });
    assert.equal(outcome.route.intentId, "intent-rebuilt");
    assert.equal(outcome.route.txReq.data, REBUILT_SOLANA_TX);
  });

  it("signs a rebuild whose output sits exactly on the accepted-slippage floor", async () => {
    const reviewed = await reviewSolanaRoute(
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: FLOOR_TO_AMOUNT })
    );

    const outcome = await sendReviewedRoute(reviewed, SOLANA);

    assert.equal(outcome.kind, "sent");
    assert.deepEqual(events.at(-2), { kind: "sign", data: REBUILT_SOLANA_TX });
    assert.deepEqual(events.at(-1), {
      kind: "receipt",
      intentId: "intent-rebuilt",
      txHash: "solana-signature-1",
    });
  });

  it("signs a rebuild that delivers more than the review", async () => {
    const reviewed = await reviewSolanaRoute(
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: "995000" })
    );

    const outcome = await sendReviewedRoute(reviewed, SOLANA);

    assert.equal(outcome.kind, "sent");
    if (outcome.kind !== "sent") return;
    assert.equal(outcome.receipt.intentId, "intent-rebuilt");
  });

  it("sends nothing and returns the rebuild for review when its output falls below the slippage the user accepted", async () => {
    const reviewed = await reviewSolanaRoute(
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: "985049" })
    );

    const outcome = await sendReviewedRoute(reviewed, SOLANA);

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"],
      "the wallet is never asked to sign"
    );
    assert.equal(outcome.kind, "route_changed");
    if (outcome.kind !== "route_changed") return;
    assert.deepEqual(outcome.change, {
      kind: "output_below_accepted_slippage",
      reviewedToAmount: 990000n,
      floorToAmount: 985050n,
      rebuiltToAmount: 985049n,
      slippageBps: 50,
    });
    assert.equal(outcome.rebuilt.result.intentId, "intent-rebuilt");
    assert.equal(outcome.rebuilt.result.txReq.data, REBUILT_SOLANA_TX);
    assert.deepEqual(outcome.rebuilt.request, SOLANA_REQUEST);
  });

  it("sends nothing when the rebuild spends more than the review", async () => {
    const reviewed = await reviewSolanaRoute(
      rebuiltSolanaReply({
        ...REVIEWED_ESTIMATE,
        fromAmount: "1000001",
        toAmount: "999000",
      })
    );

    const outcome = await sendReviewedRoute(reviewed, SOLANA);

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"]
    );
    assert.equal(outcome.kind, "route_changed");
    if (outcome.kind !== "route_changed") return;
    assert.deepEqual(outcome.change, {
      kind: "input_increased",
      reviewedFromAmount: 1000000n,
      rebuiltFromAmount: 1000001n,
    });
  });

  it("judges a rebuilt rebuild against the route the user re-reviewed", async () => {
    const first = await reviewSolanaRoute(
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: "900000" })
    );
    const changed = await sendReviewedRoute(first, SOLANA);
    assert.equal(changed.kind, "route_changed");
    if (changed.kind !== "route_changed") return;

    // Confirming the re-reviewed route rebuilds again. 900000 less 0.5% is
    // 895500, so 895500 now passes where it failed against the original.
    globalThis.fetch = stubBackend(events, [
      {
        status: 200,
        intentId: "intent-rebuilt-again",
        estimate: { ...REVIEWED_ESTIMATE, toAmount: "895500" },
        tx: { solana: "QUdBSU4tdHg=" },
      },
    ]) as typeof fetch;
    const outcome = await sendReviewedRoute(changed.rebuilt, SOLANA);

    assert.equal(outcome.kind, "sent");
    if (outcome.kind !== "sent") return;
    assert.deepEqual(outcome.receipt, {
      intentId: "intent-rebuilt-again",
      txHash: "solana-signature-1",
    });
    assert.deepEqual(events.at(-2), { kind: "sign", data: "QUdBSU4tdHg=" });
    assert.deepEqual(events.at(-1), {
      kind: "receipt",
      intentId: "intent-rebuilt-again",
      txHash: "solana-signature-1",
    });
    assert.equal(
      events.filter((e) => e.kind === "receipt").length,
      1,
      "the confirm that went back to review posted nothing"
    );
  });

  it("surfaces a failed rebuild as the backend's error and sends nothing", async () => {
    const reviewed = await reviewSolanaRoute({
      status: 503,
      body: { error: "Routing providers unavailable" },
    });

    await assert.rejects(sendReviewedRoute(reviewed, SOLANA), (err) => {
      assert.ok(isRouteError(err));
      assert.equal(err.message, "Routing providers unavailable");
      assert.equal(err.status, 503);
      return true;
    });
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"]
    );
  });

  it("surfaces a rebuild that never reaches the backend and sends nothing", async () => {
    const reviewed = await reviewSolanaRoute(reviewedSolanaReply);
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    await assert.rejects(sendReviewedRoute(reviewed, SOLANA), {
      name: "TypeError",
      message: "fetch failed",
    });
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build"]
    );
  });

  it("refuses a Solana route whose request names no slippage, before rebuilding", async () => {
    const { slippage: _omitted, ...noSlippage } = SOLANA_REQUEST;
    const reviewed = await reviewSolanaRoute(reviewedSolanaReply, noSlippage);

    await assert.rejects(sendReviewedRoute(reviewed, SOLANA), {
      message:
        "Can't judge a rebuilt Solana route: its request names no slippage, so the tolerance the user accepted is unknown.",
    });
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build"]
    );
  });

  it("refuses a rebuild with no output amount instead of guessing", async () => {
    const reviewed = await reviewSolanaRoute(
      rebuiltSolanaReply({ fromAmount: "1000000", toAmountUsd: "0.99" })
    );

    await assert.rejects(sendReviewedRoute(reviewed, SOLANA), {
      message:
        'Can\'t compare the rebuilt route (intent "intent-rebuilt") with the other one: its estimate.toAmount is undefined, not an integer amount.',
    });
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"]
    );
  });

  it("sends an EVM route as reviewed, without rebuilding it", async () => {
    globalThis.fetch = stubBackend(events, [
      {
        status: 200,
        intentId: "intent-evm",
        estimate: REVIEWED_ESTIMATE,
        tx: { evm: REVIEWED_EVM_DATA },
      },
      // Served only if the EVM route were wrongly rebuilt.
      {
        status: 200,
        intentId: "intent-evm-rebuilt",
        estimate: REVIEWED_ESTIMATE,
        tx: { evm: REBUILT_EVM_DATA },
      },
    ]) as typeof fetch;
    walletManager.attachWallet(evmWallet(events));
    const reviewed = await buildRouteForReview(EVM_REQUEST);

    const outcome = await sendReviewedRoute(reviewed, 8453, {
      approvalsEnsured: true,
    });

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "sign", "receipt"]
    );
    assert.deepEqual(events[1], { kind: "sign", data: REVIEWED_EVM_DATA });
    // EVM: accepted when the wallet returns the hash, and the receipt goes
    // out right then (sendRouteTransactionReporting's EVM branch).
    assert.deepEqual(events[2], {
      kind: "receipt",
      intentId: "intent-evm",
      txHash: `0x${"e".repeat(64)}`,
    });
    assert.equal(outcome.kind, "sent");
    if (outcome.kind !== "sent") return;
    assert.deepEqual(outcome.receipt, {
      intentId: "intent-evm",
      txHash: `0x${"e".repeat(64)}`,
    });
    assert.equal(outcome.route, reviewed.result);
  });
});

// What a host sees: the pair on the public facade, the wallet attached the
// way hosts attach one.
describe("Trustware.sendReviewedRoute (host API)", () => {
  const realFetch = globalThis.fetch;
  let events: Event[];

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    events = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("exposes the same functions on the facade and as named ./core exports", () => {
    assert.equal(Trustware.buildRouteForReview, buildRouteForReview);
    assert.equal(Trustware.sendReviewedRoute, sendReviewedRoute);
    assert.equal(coreBuildRouteForReview, buildRouteForReview);
    assert.equal(coreSendReviewedRoute, sendReviewedRoute);
  });

  it("rebuilds a host's Solana route before the wallet signs, and reports the rebuilt intent", async () => {
    globalThis.fetch = stubBackend(events, [
      reviewedSolanaReply,
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: "989000" }),
    ]) as typeof fetch;
    Trustware.useWallet(solanaWallet(events));

    const reviewed = await Trustware.buildRouteForReview(SOLANA_REQUEST);
    const outcome = await Trustware.sendReviewedRoute(reviewed);

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build", "sign", "receipt"]
    );
    assert.deepEqual(events[1], events[0], "the same request, built again");
    assert.deepEqual(events[2], { kind: "sign", data: REBUILT_SOLANA_TX });
    assert.deepEqual(events[3], {
      kind: "receipt",
      intentId: "intent-rebuilt",
      txHash: "solana-signature-1",
    });
    assert.equal(outcome.kind, "sent");
    if (outcome.kind !== "sent") return;
    assert.deepEqual(outcome.receipt, {
      intentId: "intent-rebuilt",
      txHash: "solana-signature-1",
    });
  });

  it("hands a host a materially worse rebuild for review without signing", async () => {
    globalThis.fetch = stubBackend(events, [
      reviewedSolanaReply,
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: "985049" }),
    ]) as typeof fetch;
    Trustware.useWallet(solanaWallet(events));

    const reviewed = await Trustware.buildRouteForReview(SOLANA_REQUEST);
    const outcome = await Trustware.sendReviewedRoute(reviewed);

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"]
    );
    assert.equal(outcome.kind, "route_changed");
    if (outcome.kind !== "route_changed") return;
    assert.equal(outcome.change.kind, "output_below_accepted_slippage");
    assert.equal(outcome.rebuilt.result.intentId, "intent-rebuilt");
  });
});
