import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import bs58 from "bs58";
import {
  Keypair,
  SystemProgram,
  Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { Trustware } from "src/core";
import { SIGNING_RETRY_MESSAGE } from "src/core/signTimeRoute";
import type { SigningRetry } from "src/core/signTimeRoute";
import type { ReviewedRouteSend } from "src/core/signTimeRoute";
import { TrustwareConfigStore } from "src/config/store";
import { toSolanaWalletInterface } from "src/wallets/solana";
import type { RouteEstimate, SolanaProviderLike } from "src/types";
import {
  REVIEWED_ESTIMATE,
  SOLANA,
  SOLANA_REQUEST,
  stubBackend,
  type Event,
  type RouteReply,
} from "./routeBackendStub";

const payer = Keypair.generate();

/** A real unsigned transaction with its own blockhash, base64. */
function unsignedTransaction(blockhash: string): string {
  const bytes = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: blockhash,
  })
    .add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 1,
      })
    )
    .serialize({ requireAllSignatures: false, verifySignatures: false });
  return Buffer.from(bytes).toString("base64");
}

const freshBlockhash = () => Keypair.generate().publicKey.toBase58();

/** The proxy's exact envelopes (quicklinks_v1 7b9cc7cf and b43dbdeb). */
function envelope(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const ok = (data: unknown) => envelope(200, { success: true, data });
const fail = (
  status: number,
  code: string,
  message: string,
  context: Record<string, unknown>
) => envelope(status, { success: false, error: { code, message, context } });

type Signed = { blockhash: string; signature: string; base64: string };

/** One answer per proxy call, given what was signed. */
type Answer = (signed: Signed) => Response;

const valid: Answer = (s) =>
  ok({ chainId: SOLANA, blockhash: s.blockhash, valid: true, rpcHost: "rpc" });
const invalid: Answer = (s) =>
  ok({ chainId: SOLANA, blockhash: s.blockhash, valid: false, rpcHost: "rpc" });
const validity503: Answer = () =>
  fail(503, "RPC_CALL_FAILED", "Failed to check Solana blockhash validity", {
    error: "connection reset",
  });
const sent: Answer = (s) =>
  ok({ chainId: SOLANA, signature: s.signature, rpcHost: "rpc" });
const alreadyProcessed: Answer = (s) =>
  fail(
    409,
    "ALREADY_PROCESSED",
    "Solana transaction has already been processed",
    {
      signature: s.signature,
    }
  );
const blockhashNotFound: Answer = (s) =>
  fail(
    409,
    "BLOCKHASH_NOT_FOUND",
    "Solana transaction's blockhash is no longer valid; rebuild and sign again",
    {
      blockhash: s.blockhash,
      error: "Transaction simulation failed: Blockhash not found",
      signature: s.signature,
    }
  );
const broadcastFailed: Answer = () =>
  fail(503, "BROADCAST_FAILED", "Failed to broadcast Solana transaction", {
    error: "node is behind",
  });
const status =
  (value: "not_found" | "pending" | "success"): Answer =>
  (s) =>
    ok({
      chainId: SOLANA,
      signature: s.signature,
      found: value !== "not_found",
      confirmed: value === "success",
      status: value,
    });

const MATERIALLY_WORSE: RouteEstimate = {
  ...REVIEWED_ESTIMATE,
  toAmount: "900000",
};

function routeReply(
  intentId: string,
  blockhash: string,
  estimate = REVIEWED_ESTIMATE
): RouteReply {
  return {
    status: 200,
    intentId,
    estimate,
    tx: { solana: unsignedTransaction(blockhash) },
  };
}

/**
 * A host's whole Solana send: Trustware.buildRouteForReview, then
 * sendReviewedRoute through the real wallet adapter, against scripted
 * proxy answers. Everything lands in `order`, so a test reads it whole.
 */
async function hostSend(script: {
  /** Blockhashes of the routes built at review, at confirm, and on retry. */
  routes: { intentId: string; blockhash: string; estimate?: RouteEstimate }[];
  validity: Answer[];
  sends: Answer[];
  statuses: Answer[];
}) {
  const events: Event[] = [];
  const routes = stubBackend(
    events,
    script.routes.map((r) => routeReply(r.intentId, r.blockhash, r.estimate))
  );
  const order: string[] = [];
  const signed: Signed[] = [];
  const retries: SigningRetry[] = [];
  const receipts: { url: string; body: unknown }[] = [];
  const knownInvalid = new Set<string>();
  const current = () => {
    const last = signed.at(-1);
    assert.ok(last, "a proxy call before any signature");
    return last;
  };

  const provider: SolanaProviderLike = {
    publicKey: { toString: () => payer.publicKey.toBase58() },
    signTransaction: async (transaction) => {
      const tx = transaction as VersionedTransaction;
      tx.sign([payer]);
      const bytes = tx.serialize();
      signed.push({
        blockhash: tx.message.recentBlockhash,
        signature: bs58.encode(tx.signatures[0]),
        base64: Buffer.from(bytes).toString("base64"),
      });
      order.push(`sign:${tx.message.recentBlockhash}`);
      return { serialize: () => bytes };
    },
    signAndSendTransaction: async () => {
      throw new Error("signAndSendTransaction must not be used");
    },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/v1/sdk/rpc/solana/send-serialized")) {
      const body = JSON.parse(String(init?.body));
      const s = current();
      assert.equal(body.chainId, SOLANA);
      assert.equal(body.serializedTransaction, s.base64);
      assert.ok(
        !knownInvalid.has(s.blockhash),
        `sent ${s.blockhash} after it read invalid`
      );
      const next = script.sends.shift();
      assert.ok(next, "unexpected extra send");
      const response = next(s);
      order.push(`send(${body.skipPreflight}):${response.status}`);
      return response;
    }
    if (url.includes("/v1/sdk/rpc/solana/blockhash-valid?")) {
      const query = Object.fromEntries(new URL(url).searchParams);
      const s = current();
      assert.deepEqual(query, { chainId: SOLANA, blockhash: s.blockhash });
      const next = script.validity.shift();
      assert.ok(next, "unexpected extra validity read");
      const response = next(s);
      const answer =
        response.status === 200
          ? ((await response.clone().json()) as { data: { valid: boolean } })
              .data.valid
          : response.status;
      if (answer === false) knownInvalid.add(s.blockhash);
      order.push(`valid:${answer}`);
      return response;
    }
    if (url.includes("/v1/sdk/rpc/solana/tx-status?")) {
      const s = current();
      assert.equal(new URL(url).searchParams.get("signature"), s.signature);
      const next = script.statuses.shift();
      assert.ok(next, "unexpected extra status read");
      const response = next(s);
      const body = (await response.clone().json()) as {
        data: { status: string };
      };
      order.push(`status:${body.data.status}`);
      return response;
    }
    if (url.includes("/v1/route-intent/") && url.endsWith("/receipt")) {
      receipts.push({
        url: url.slice(url.indexOf("/v1/route-intent/")),
        body: JSON.parse(String(init?.body)),
      });
      return ok({});
    }
    if (url.endsWith("/v1/routes/route")) order.push("build");
    return routes(input, init);
  }) as typeof fetch;

  Trustware.useWallet(toSolanaWalletInterface(provider));
  const reviewed = await Trustware.buildRouteForReview(SOLANA_REQUEST);
  let outcome: ReviewedRouteSend | Error;
  try {
    outcome = await Trustware.sendReviewedRoute(reviewed, SOLANA, {
      onRetry: (retry) => {
        retries.push(retry);
        order.push(`onRetry:${retry.reason}`);
      },
    });
    if (outcome.kind === "sent") {
      // What a host does with the result: one receipt.
      await Trustware.submitReceipt(
        outcome.receipt.intentId,
        outcome.receipt.txHash
      );
    }
  } catch (err) {
    outcome = err as Error;
  }
  return { outcome, order, signed, retries, receipts, script };
}

const expiredMessage = (s: Signed) =>
  `Solana transaction ${s.signature} expired before inclusion: its blockhash ${s.blockhash} is no longer valid and the network never included it.`;

describe("Solana send, end to end against the proxy contract", () => {
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    console.warn = () => {};
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  });

  it("checks validity before the first send, rebroadcasts through every documented refusal, and posts one receipt with the bytes' signature", async () => {
    const [review, confirm] = [freshBlockhash(), freshBlockhash()];
    const run = await hostSend({
      routes: [
        { intentId: "intent-reviewed", blockhash: review },
        { intentId: "intent-rebuilt", blockhash: confirm },
      ],
      validity: [valid, validity503, valid],
      sends: [sent, alreadyProcessed, broadcastFailed],
      statuses: [status("not_found"), status("pending"), status("success")],
    });

    assert.deepEqual(run.order, [
      "build",
      "build",
      `sign:${confirm}`,
      "valid:true",
      "send(false):200",
      "status:not_found",
      "valid:503",
      "send(true):409",
      "status:pending",
      "valid:true",
      "send(true):503",
      "status:success",
    ]);
    const [only] = run.signed;
    assert.equal(run.signed.length, 1);
    const outcome = run.outcome as ReviewedRouteSend;
    assert.equal(outcome.kind, "sent");
    if (outcome.kind !== "sent") return;
    assert.equal(outcome.hash, only.signature);
    assert.deepEqual(outcome.receipt, {
      intentId: "intent-rebuilt",
      txHash: only.signature,
    });
    assert.deepEqual(run.receipts, [
      {
        url: "/v1/route-intent/intent-rebuilt/receipt",
        body: { txHash: only.signature },
      },
    ]);
    assert.deepEqual(run.retries, []);
  });

  it("rebuilds and asks once more when the blockhash expired while the wallet signed", async () => {
    const [review, confirm, retry] = [
      freshBlockhash(),
      freshBlockhash(),
      freshBlockhash(),
    ];
    const run = await hostSend({
      routes: [
        { intentId: "intent-reviewed", blockhash: review },
        { intentId: "intent-confirm", blockhash: confirm },
        { intentId: "intent-retry", blockhash: retry },
      ],
      validity: [invalid, valid],
      sends: [sent],
      statuses: [status("success")],
    });

    assert.deepEqual(run.order, [
      "build",
      "build",
      `sign:${confirm}`,
      "valid:false",
      "build",
      "onRetry:blockhash_expired_before_send",
      `sign:${retry}`,
      "valid:true",
      "send(false):200",
      "status:success",
    ]);
    const second = run.signed[1];
    assert.equal(run.retries.length, 1);
    assert.deepEqual(
      { reason: run.retries[0].reason, message: run.retries[0].message },
      {
        reason: "blockhash_expired_before_send",
        message:
          "That took a little long, so we refreshed the route. Please approve again.",
      }
    );
    assert.equal(SIGNING_RETRY_MESSAGE, run.retries[0].message);
    assert.equal(run.retries[0].route.intentId, "intent-retry");
    assert.equal(
      second.blockhash,
      retry,
      "the second prompt signs the rebuild"
    );
    assert.deepEqual(run.receipts, [
      {
        url: "/v1/route-intent/intent-retry/receipt",
        body: { txHash: second.signature },
      },
    ]);
  });

  it("rebuilds and asks once more when the first send answers BLOCKHASH_NOT_FOUND", async () => {
    const [review, confirm, retry] = [
      freshBlockhash(),
      freshBlockhash(),
      freshBlockhash(),
    ];
    const run = await hostSend({
      routes: [
        { intentId: "intent-reviewed", blockhash: review },
        { intentId: "intent-confirm", blockhash: confirm },
        { intentId: "intent-retry", blockhash: retry },
      ],
      validity: [validity503, valid],
      sends: [blockhashNotFound, sent],
      statuses: [status("success")],
    });

    assert.deepEqual(run.order, [
      "build",
      "build",
      `sign:${confirm}`,
      "valid:503",
      "send(false):409",
      "build",
      "onRetry:blockhash_not_found_on_send",
      `sign:${retry}`,
      "valid:true",
      "send(false):200",
      "status:success",
    ]);
    assert.equal(run.retries.length, 1);
    assert.equal(run.retries[0].route.intentId, "intent-retry");
    assert.deepEqual(run.receipts, [
      {
        url: "/v1/route-intent/intent-retry/receipt",
        body: { txHash: run.signed[1].signature },
      },
    ]);
  });

  it("goes back to review when the retry's rebuild is materially worse, without asking again", async () => {
    const [review, confirm, retry] = [
      freshBlockhash(),
      freshBlockhash(),
      freshBlockhash(),
    ];
    const run = await hostSend({
      routes: [
        { intentId: "intent-reviewed", blockhash: review },
        { intentId: "intent-confirm", blockhash: confirm },
        {
          intentId: "intent-retry",
          blockhash: retry,
          estimate: MATERIALLY_WORSE,
        },
      ],
      validity: [invalid],
      sends: [],
      statuses: [],
    });

    assert.deepEqual(run.order, [
      "build",
      "build",
      `sign:${confirm}`,
      "valid:false",
      "build",
    ]);
    const outcome = run.outcome as ReviewedRouteSend;
    assert.equal(outcome.kind, "route_changed");
    if (outcome.kind !== "route_changed") return;
    assert.equal(outcome.rebuilt.result.intentId, "intent-retry");
    assert.equal(outcome.change.kind, "output_below_accepted_slippage");
    assert.deepEqual(run.retries, []);
    assert.deepEqual(run.receipts, []);
  });

  it("fails with the exact expiry error when the second signature also expired, with no third prompt", async () => {
    const [review, confirm, retry] = [
      freshBlockhash(),
      freshBlockhash(),
      freshBlockhash(),
    ];
    const run = await hostSend({
      routes: [
        { intentId: "intent-reviewed", blockhash: review },
        { intentId: "intent-confirm", blockhash: confirm },
        { intentId: "intent-retry", blockhash: retry },
      ],
      validity: [invalid, valid],
      sends: [blockhashNotFound],
      statuses: [],
    });

    assert.deepEqual(run.order, [
      "build",
      "build",
      `sign:${confirm}`,
      "valid:false",
      "build",
      "onRetry:blockhash_expired_before_send",
      `sign:${retry}`,
      "valid:true",
      "send(false):409",
    ]);
    assert.ok(run.outcome instanceof Error);
    assert.equal(run.outcome.message, expiredMessage(run.signed[1]));
    assert.equal(run.signed.length, 2);
    assert.equal(run.retries.length, 1);
    assert.deepEqual(run.receipts, []);
  });
});

/** mulberry32: a fixed seed makes every run test the same scripts. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Solana re-sign, over generated outcomes", () => {
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    console.warn = () => {};
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  });

  // The claims: at most two wallet prompts per confirm, never a send with a
  // blockhash already read invalid (asserted inside hostSend's proxy), one
  // onRetry exactly when a second prompt happens and before it, and one
  // receipt exactly when something was sent, for that signature.
  it("prompts at most twice and never sends a blockhash known to be invalid", async () => {
    const random = seededRandom(0x7e51_9e00);
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
    const seen = { sent: 0, expired: 0, changed: 0, notSent: 0 };

    for (let run = 0; run < 300; run++) {
      // One attempt's script: its precheck answer and, if it sends, the
      // first send's answer.
      const attempt = () => {
        const precheck = pick([valid, valid, invalid, validity503]);
        const first =
          precheck === invalid
            ? null
            : pick([
                sent,
                sent,
                alreadyProcessed,
                blockhashNotFound,
                broadcastFailed,
              ]);
        return { precheck, first };
      };
      const one = attempt();
      const two = attempt();
      const retryWorse = random() < 0.2;
      const expiresFirst =
        one.precheck === invalid || one.first === blockhashNotFound;
      const expiresSecond =
        two.precheck === invalid || two.first === blockhashNotFound;

      const validity = [one.precheck];
      const sends = one.first ? [one.first] : [];
      if (expiresFirst && !retryWorse) {
        validity.push(two.precheck);
        if (two.first) sends.push(two.first);
      }
      const finalFirst = expiresFirst
        ? retryWorse
          ? null
          : two.first
        : one.first;
      const statuses =
        finalFirst === sent || finalFirst === alreadyProcessed
          ? [status("success")]
          : [];

      const result = await hostSend({
        routes: [
          { intentId: "intent-reviewed", blockhash: freshBlockhash() },
          { intentId: "intent-confirm", blockhash: freshBlockhash() },
          {
            intentId: "intent-retry",
            blockhash: freshBlockhash(),
            estimate: retryWorse ? MATERIALLY_WORSE : REVIEWED_ESTIMATE,
          },
        ],
        validity,
        sends,
        statuses,
      });
      const { outcome, order, signed, retries, receipts } = result;
      const label = `run ${run}`;

      // The whole script was used: nothing stopped early, nothing extra ran.
      assert.equal(validity.length + sends.length + statuses.length, 0, label);

      const prompts = order.filter((o) => o.startsWith("sign:")).length;
      assert.ok(prompts <= 2, `${label}: ${prompts} prompts`);
      assert.equal(prompts, signed.length, label);
      assert.equal(retries.length, prompts === 2 ? 1 : 0, label);
      if (prompts === 2) {
        const retryAt = order.findIndex((o) => o.startsWith("onRetry:"));
        const secondSign = order.lastIndexOf(`sign:${signed[1].blockhash}`);
        assert.ok(retryAt >= 0 && retryAt < secondSign, label);
        assert.equal(retries[0].route.intentId, "intent-retry", label);
      }

      if (outcome instanceof Error) {
        assert.deepEqual(receipts, [], label);
        if (expiresFirst && !retryWorse && expiresSecond) {
          assert.equal(outcome.message, expiredMessage(signed[1]), label);
          seen.expired++;
        } else {
          assert.match(
            outcome.message,
            /was not sent: Failed to broadcast/,
            label
          );
          seen.notSent++;
        }
      } else if (outcome.kind === "route_changed") {
        assert.ok(expiresFirst && retryWorse, label);
        assert.deepEqual(receipts, [], label);
        seen.changed++;
      } else {
        const last = signed.at(-1) as Signed;
        assert.equal(outcome.receipt.txHash, last.signature, label);
        assert.equal(receipts.length, 1, label);
        assert.deepEqual(receipts[0].body, { txHash: last.signature }, label);
        assert.equal(
          outcome.receipt.intentId,
          prompts === 2 ? "intent-retry" : "intent-confirm",
          label
        );
        seen.sent++;
      }
    }

    assert.ok(seen.sent > 50, `${seen.sent} sent`);
    assert.ok(seen.expired > 10, `${seen.expired} expired twice`);
    assert.ok(seen.changed > 5, `${seen.changed} changed`);
    assert.ok(seen.notSent > 20, `${seen.notSent} refused`);
  });
});
