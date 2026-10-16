import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildRouteForReview,
  sendReviewedRoute,
  type BuiltRoute,
} from "src/core/signTimeRoute";
import type { BuildRouteBody } from "src/core/routes";
import { isRouteError } from "src/core/routeError";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import {
  Trustware,
  buildRouteForReview as coreBuildRouteForReview,
  sendReviewedRoute as coreSendReviewedRoute,
} from "src/core";
import type { RouteEstimate, WalletInterFaceAPI } from "src/types";

const SOLANA = "solana-mainnet-beta";
const SOL_OWNER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const EVM_OWNER = "0x1111111111111111111111111111111111111111";
const BASE_RECIPIENT = "0x2222222222222222222222222222222222222222";
const ROUTER = "0x3333333333333333333333333333333333333333";
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

/** Distinct payloads, so a test can tell which transaction the wallet got. */
const REVIEWED_SOLANA_TX = "UkVWSUVXRUQtdHg=";
const REBUILT_SOLANA_TX = "UkVCVUlMVC10eA==";
const REVIEWED_EVM_DATA = "0xaaaa";
const REBUILT_EVM_DATA = "0xbbbb";

const SOLANA_REQUEST: BuildRouteBody = {
  fromChain: SOLANA,
  toChain: "8453",
  fromToken: USDC_SOLANA,
  toToken: USDC_BASE,
  fromAmount: "1000000",
  fromAddress: SOL_OWNER,
  toAddress: BASE_RECIPIENT,
  slippage: 0.5,
};

const EVM_REQUEST: BuildRouteBody = {
  fromChain: "8453",
  toChain: "42161",
  fromToken: USDC_BASE,
  toToken: USDC_BASE,
  fromAmount: "1000000",
  fromAddress: EVM_OWNER,
  toAddress: EVM_OWNER,
  slippage: 0.5,
};

/** 0.5% of 990000, rounded up, is the lowest toAmount the review allows. */
const REVIEWED_ESTIMATE: RouteEstimate = {
  fromAmount: "1000000",
  toAmount: "990000",
  toAmountUsd: "0.99",
  totalFeesUsd: "0.01",
};
const FLOOR_TO_AMOUNT = "985050";

type Event =
  | { kind: "build"; body: Record<string, unknown> }
  | { kind: "sign"; data: string };

type RouteReply =
  | { status: 200; intentId: string; estimate: RouteEstimate; tx: TxShape }
  | { status: number; body: unknown };

type TxShape = { solana: string } | { evm: string };

function routeJson(intentId: string, estimate: RouteEstimate, tx: TxShape) {
  const transaction =
    "solana" in tx
      ? { data: tx.solana, chainId: SOLANA }
      : { to: ROUTER, data: tx.evm, value: "0", chainId: "8453" };
  return {
    data: {
      intentId,
      route: { provider: "mayan", estimate, execution: { transaction } },
    },
  };
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Serves /v1/routes/route from a queue (one reply per build, in order) and
 * the chain list sendRouteTransaction resolves a Solana chain id from.
 * Every build lands in `events` beside the wallet's signs, so a test can
 * read the order they happened in.
 */
function stubBackend(events: Event[], replies: RouteReply[]) {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/v1/routes/route")) {
      events.push({
        kind: "build",
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      const reply = replies.shift();
      if (!reply) throw new Error(`Unexpected extra route build: ${url}`);
      if ("body" in reply) return json(reply.status, reply.body);
      return json(200, routeJson(reply.intentId, reply.estimate, reply.tx));
    }
    if (url.endsWith("/v1/routes/chains")) {
      return json(200, {
        data: [
          {
            chainId: SOLANA,
            networkIdentifier: SOLANA,
            type: "solana",
            networkName: "Solana",
          },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
}

function solanaWallet(events: Event[]): WalletInterFaceAPI {
  return {
    ecosystem: "solana",
    type: "solana",
    getAddress: async () => SOL_OWNER,
    getChainKey: async () => SOLANA,
    sendSerializedTransaction: async (data: string) => {
      events.push({ kind: "sign", data });
      return "solana-signature-1";
    },
  } as unknown as WalletInterFaceAPI;
}

function evmWallet(events: Event[]): WalletInterFaceAPI {
  return {
    ecosystem: "evm",
    type: "eip1193",
    getAddress: async () => EVM_OWNER,
    getChainId: async () => 8453,
    switchChain: async () => {},
    request: async (args: { method: string; params?: unknown[] }) => {
      if (args.method !== "eth_sendTransaction") {
        throw new Error(`Unexpected wallet request: ${args.method}`);
      }
      const tx = (args.params as Record<string, string>[])[0];
      events.push({ kind: "sign", data: tx.data });
      return `0x${"e".repeat(64)}`;
    },
  } as unknown as WalletInterFaceAPI;
}

const reviewedSolanaReply: RouteReply = {
  status: 200,
  intentId: "intent-reviewed",
  estimate: REVIEWED_ESTIMATE,
  tx: { solana: REVIEWED_SOLANA_TX },
};

function rebuiltSolanaReply(estimate: RouteEstimate): RouteReply {
  return {
    status: 200,
    intentId: "intent-rebuilt",
    estimate,
    tx: { solana: REBUILT_SOLANA_TX },
  };
}

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

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build", "sign"]
    );
    const [reviewBuild, rebuild, sign] = events;
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
    assert.deepEqual(events.at(-1), { kind: "sign", data: REBUILT_SOLANA_TX });
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
    assert.deepEqual(events.at(-1), { kind: "sign", data: "QUdBSU4tdHg=" });
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
      ["build", "sign"]
    );
    assert.deepEqual(events[1], { kind: "sign", data: REVIEWED_EVM_DATA });
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
      ["build", "build", "sign"]
    );
    assert.deepEqual(events[1], events[0], "the same request, built again");
    assert.deepEqual(events[2], { kind: "sign", data: REBUILT_SOLANA_TX });
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
