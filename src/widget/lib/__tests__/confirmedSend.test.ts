import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildRouteForReview, sendSignableRoute } from "src/core/signTimeRoute";
import {
  PAYMENT_INITIATED,
  prepareConfirmedSend,
} from "src/widget/lib/confirmedSend";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import {
  EVM_REQUEST,
  REBUILT_SOLANA_TX,
  REVIEWED_ESTIMATE,
  REVIEWED_EVM_DATA,
  SOLANA,
  SOLANA_REQUEST,
  evmWallet,
  rebuiltSolanaReply,
  reviewedSolanaReply,
  solanaWallet,
  stubBackend,
  type Event,
} from "src/core/__tests__/routeBackendStub";

// `onSendStarting` is where both widget flows report payment_initiated.
// Each test logs it into the same list as builds and signs, so the order
// of all three is asserted together.
describe("prepareConfirmedSend", () => {
  const realFetch = globalThis.fetch;
  let events: (Event | { kind: "payment_initiated" })[];
  const announce = (event: typeof PAYMENT_INITIATED) =>
    events.push({ kind: event });

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

  // The BI queries in quicklinks_v1/iluvatar/db/g4a_repo.go read this name.
  it("reports the event the BI queries read", () => {
    assert.equal(PAYMENT_INITIATED, "payment_initiated");
  });

  it("reports once for a route change followed by a second confirm that sends", async () => {
    globalThis.fetch = stubBackend(events as Event[], [
      reviewedSolanaReply,
      rebuiltSolanaReply({ ...REVIEWED_ESTIMATE, toAmount: "900000" }),
      {
        status: 200,
        intentId: "intent-rebuilt-again",
        estimate: { ...REVIEWED_ESTIMATE, toAmount: "899000" },
        tx: { solana: "QUdBSU4tdHg=" },
      },
    ]) as typeof fetch;
    walletManager.attachWallet(solanaWallet(events as Event[]));
    const reviewed = await buildRouteForReview(SOLANA_REQUEST);

    const first = await prepareConfirmedSend(reviewed, announce);
    assert.equal(first.kind, "route_changed");
    if (first.kind !== "route_changed") return;
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"],
      "a confirm that goes back to review reports nothing"
    );

    const second = await prepareConfirmedSend(first.rebuilt, announce);
    assert.equal(second.kind, "ready");
    if (second.kind !== "ready") return;
    await sendSignableRoute(second.route, SOLANA);

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build", "build", "payment_initiated", "sign"]
    );
    assert.deepEqual(events.at(-1), { kind: "sign", data: "QUdBSU4tdHg=" });
  });

  it("reports after the rebuild and before the wallet signs", async () => {
    globalThis.fetch = stubBackend(events as Event[], [
      reviewedSolanaReply,
      rebuiltSolanaReply(REVIEWED_ESTIMATE),
    ]) as typeof fetch;
    walletManager.attachWallet(solanaWallet(events as Event[]));
    const reviewed = await buildRouteForReview(SOLANA_REQUEST);

    const decision = await prepareConfirmedSend(reviewed, announce);
    assert.equal(decision.kind, "ready");
    if (decision.kind !== "ready") return;
    await sendSignableRoute(decision.route, SOLANA);

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build", "payment_initiated", "sign"]
    );
    assert.deepEqual(events.at(-1), { kind: "sign", data: REBUILT_SOLANA_TX });
  });

  it("reports nothing when the rebuild fails", async () => {
    globalThis.fetch = stubBackend(events as Event[], [
      reviewedSolanaReply,
      { status: 503, body: { error: "Routing providers unavailable" } },
    ]) as typeof fetch;
    walletManager.attachWallet(solanaWallet(events as Event[]));
    const reviewed = await buildRouteForReview(SOLANA_REQUEST);

    await assert.rejects(prepareConfirmedSend(reviewed, announce), {
      message: "Routing providers unavailable",
    });
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"]
    );
  });

  it("reports an EVM confirm straight away, without rebuilding", async () => {
    globalThis.fetch = stubBackend(events as Event[], [
      {
        status: 200,
        intentId: "intent-evm",
        estimate: REVIEWED_ESTIMATE,
        tx: { evm: REVIEWED_EVM_DATA },
      },
    ]) as typeof fetch;
    walletManager.attachWallet(evmWallet(events as Event[]));
    const reviewed = await buildRouteForReview(EVM_REQUEST);

    const decision = await prepareConfirmedSend(reviewed, announce);
    assert.equal(decision.kind, "ready");
    if (decision.kind !== "ready") return;
    assert.equal(decision.route, reviewed.result);
    await sendSignableRoute(decision.route, 8453, { approvalsEnsured: true });

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "payment_initiated", "sign"]
    );
  });
});
