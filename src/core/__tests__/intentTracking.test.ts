import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  deliverReceipt,
  runIntentTracking,
  trackIntent,
  TRACKING_TIMEOUT_MS,
  type IntentTrackingOutcome,
  type ReceiptDeliveryOutcome,
  type TrackingClock,
} from "../intentTracking";
import { RETRYABLE_RECEIPT_CODES, type ReceiptReport } from "../receipt";
import { TrustwareConfigStore } from "../../config/store";
import { mulberry32 } from "../../__tests__/seededRandom";

const INTENT_ID = "b412c1c0-73a7-4186-9d06-0bb222043cb2";
const TX_HASH =
  "0x07d5000000000000000000000000000000000000000000000000000000004bb0";
const USER_OP_HASH =
  "0x9a3c000000000000000000000000000000000000000000000000000000001f2e";
const SPONSORSHIP_REQUEST_ID = "8d1f1f39-2a9c-4f0e-9d55-7d6b1c0e2f11";
const EOA = "0xb7e4cac65d6b9e66341b78fa94134c3b5869b1a6";
const REPORT: ReceiptReport = { intentId: INTENT_ID, txHash: TX_HASH };

// ── Scripted backend ────────────────────────────────────────────────────────

/** One scripted answer. "network" rejects like fetch does offline; "hang"
 *  never settles; "bug" rejects with an error no transport produces. */
type Reply = (() => Response) | "network" | "hang" | "bug";

const ok = (data: unknown) => () =>
  new Response(JSON.stringify({ data }), { status: 200 });
/** A refusal with no code: a 5xx, or the API-key middleware's 401/403. */
const err = (status: number, message: string) => () =>
  new Response(JSON.stringify({ error: message }), { status });
/** A commit refusal as the handler sends it: `error` and `code`. */
const refused = (status: number, code: string, message: string) => () =>
  new Response(JSON.stringify({ error: message, code }), { status });
/** A 429 asking for a wait longer than the SDK's 10s blocking budget, so
 *  rateLimitedFetch hands it straight back as a RateLimitError. */
const rateLimited = (retryAfterSeconds: number) => () =>
  new Response(JSON.stringify({ error: "rate limit exceeded" }), {
    status: 429,
    headers: {
      "X-RateLimit-Limit": "300",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 3600),
      "Retry-After": String(retryAfterSeconds),
    },
  });

const accepted = ok({ ok: true, transaction_id: "tx-row-1" });
const pending = ok({
  intent_id: INTENT_ID,
  status: "pending",
  intent_status: "created",
  create_date: "2026-07-16T05:18:10Z",
  expiresAt: "2026-07-16T05:48:10Z",
});
const withStatus = (status: string) =>
  ok({ intent_id: INTENT_ID, status, source_tx_hash: TX_HASH });

/** Every refusal code the commit handshake spec names, with the status the
 *  handler sends it with. */
const RETRYABLE: [string, number][] = [
  ["replacement_not_visible", 409],
  ["signature_still_valid", 409],
  ["tx_not_visible", 409],
  ["idempotency_key_in_flight", 409],
];
const FINAL: [string, number][] = [
  ["invalid_request", 400],
  ["invalid_tx_hash", 400],
  ["invalid_sponsorship_request_id", 400],
  ["invalid_origin_eoa", 400],
  ["payer_mismatch", 400],
  ["hash_required", 400],
  ["user_op_hash_requires_sponsorship", 400],
  ["idempotency_key_reused", 422],
  ["tx_hash_committed_elsewhere", 409],
  ["receipt_terminal", 409],
  ["not_a_replacement", 409],
  // The backend may add codes. Any code not listed as retryable is final.
  ["a_code_newer_than_this_sdk", 409],
];

type Call = { kind: "receipt" | "status"; at: number };

/**
 * Answers receipt POSTs and status GETs from separate scripts. The last entry
 * of each script repeats forever, so `[err(500, ...)]` means "always 500".
 */
function installBackend(
  clock: VirtualClock,
  script: { receipt: Reply[]; status: Reply[] }
) {
  const calls: Call[] = [];
  const bodies: unknown[] = [];
  const idempotencyKeys: string[] = [];
  const next = (queue: Reply[]): Reply =>
    queue.length > 1 ? queue.shift()! : queue[0];

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const kind = url.endsWith("/receipt") ? "receipt" : "status";
    assert.equal(
      url,
      `https://api.trustware.io/api/v1/route-intent/${INTENT_ID}/${kind}`
    );
    calls.push({ kind, at: clock.now() });
    if (kind === "receipt") {
      assert.equal(init?.method, "POST");
      bodies.push(JSON.parse(String(init?.body)));
      idempotencyKeys.push(
        (init?.headers as Record<string, string>)["Idempotency-Key"]
      );
    }
    const reply = next(kind === "receipt" ? script.receipt : script.status);
    if (reply === "network") throw new TypeError("Failed to fetch");
    if (reply === "hang") return new Promise<Response>(() => {});
    if (reply === "bug") throw new RangeError("not a transport failure");
    return reply();
  }) as typeof fetch;

  return { calls, bodies, idempotencyKeys };
}

const receiptTimes = (calls: Call[]) =>
  calls.filter((c) => c.kind === "receipt").map((c) => c.at);
const statusTimes = (calls: Call[]) =>
  calls.filter((c) => c.kind === "status").map((c) => c.at);

// ── Virtual clock ───────────────────────────────────────────────────────────

type VirtualClock = TrackingClock & {
  /** Runs `promise` to settlement, advancing virtual time only when every
   *  pending microtask and I/O callback has run. */
  drive<T>(promise: Promise<T>): Promise<T>;
  pendingTimers(): number;
};

async function drainTasks() {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
}

function virtualClock(): VirtualClock {
  let now = 0;
  let timers: { at: number; seq: number; fire: () => void }[] = [];
  let seq = 0;
  return {
    now: () => now,
    sleep(ms, signal) {
      return new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        const timer = { at: now + ms, seq: seq++, fire: resolve };
        timers.push(timer);
        signal.addEventListener(
          "abort",
          () => {
            timers = timers.filter((t) => t !== timer);
            resolve();
          },
          { once: true }
        );
      });
    },
    pendingTimers: () => timers.length,
    async drive<T>(promise: Promise<T>): Promise<T> {
      let settled = false;
      promise.then(
        () => (settled = true),
        () => (settled = true)
      );
      while (true) {
        await drainTasks();
        if (settled) return promise;
        if (timers.length === 0) {
          throw new Error(
            `tracking is idle at t=${now} with no timer pending and has not settled`
          );
        }
        timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
        const due = timers.shift()!;
        // Tracking promises to end by its deadline; past it, fail rather
        // than spin through virtual time forever.
        if (due.at > TRACKING_TIMEOUT_MS + 60_000) {
          throw new Error(
            `tracking still running at t=${due.at}, past its ${TRACKING_TIMEOUT_MS}ms deadline`
          );
        }
        now = due.at;
        due.fire();
      }
    },
  };
}

// ── Harness ─────────────────────────────────────────────────────────────────

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realError = console.error;
let warnings: unknown[][] = [];
let errors: unknown[][] = [];

beforeEach(() => {
  TrustwareConfigStore.init({
    apiKey: "test-key",
    routes: { toChain: "8453", toToken: "0xtoken" },
  });
  warnings = [];
  errors = [];
  console.warn = (...args: unknown[]) => void warnings.push(args);
  console.error = (...args: unknown[]) => void errors.push(args);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  console.error = realError;
});

/** A delivery that ends with `outcome` at virtual time `atMs`, or never. */
type ScriptedDelivery =
  { outcome: ReceiptDeliveryOutcome; atMs: number } | "never";

function scriptedDelivery(
  clock: VirtualClock,
  delivery: ScriptedDelivery
): Promise<ReceiptDeliveryOutcome> {
  if (delivery === "never") return new Promise(() => {});
  const { outcome, atMs } = delivery;
  if (atMs === 0) return Promise.resolve(outcome);
  return clock.sleep(atMs, new AbortController().signal).then(() => outcome);
}

const RECORDED: ScriptedDelivery = { outcome: { kind: "recorded" }, atMs: 0 };

async function track(
  status: Reply[],
  delivery: ScriptedDelivery,
  options: { signal?: AbortSignal } = {}
) {
  const clock = virtualClock();
  const backend = installBackend(clock, { receipt: [accepted], status });
  const updates: string[] = [];
  const outcome: IntentTrackingOutcome = await clock.drive(
    runIntentTracking(
      REPORT,
      {
        signal: options.signal ?? new AbortController().signal,
        onUpdate: (tx) => updates.push(tx.status),
        receiptDelivery: scriptedDelivery(clock, delivery),
      },
      clock
    )
  );
  return { outcome, updates, clock, ...backend, settledAt: clock.now() };
}

/** Status reads at 0, 1500, ... for ten fast polls, then every 2500. */
function pollTimesUntil(endMs: number): number[] {
  const times: number[] = [];
  let at = 0;
  for (let polls = 1; at < endMs; polls++) {
    times.push(at);
    at += polls <= 10 ? 1500 : 2500;
  }
  return times;
}

// ── Tracking ────────────────────────────────────────────────────────────────

describe("trackIntent: statuses", () => {
  it("polls through submitted and bridging to success, never posting the receipt itself", async () => {
    const run = await track(
      [withStatus("submitted"), withStatus("bridging"), withStatus("success")],
      RECORDED
    );

    assert.equal(run.outcome.kind, "success");
    assert.equal(
      run.outcome.kind === "success" && run.outcome.transaction.sourceTxHash,
      TX_HASH
    );
    assert.deepEqual(run.updates, ["submitted", "bridging", "success"]);
    assert.deepEqual(receiptTimes(run.calls), []);
    assert.deepEqual(statusTimes(run.calls), [0, 1500, 3000]);
    assert.equal(run.clock.pendingTimers(), 0);
    assert.deepEqual(warnings, []);
    assert.deepEqual(errors, []);
  });

  it("reports a failed transaction as failed", async () => {
    const run = await track(
      [withStatus("submitted"), withStatus("failed")],
      RECORDED
    );

    assert.equal(run.outcome.kind, "failed");
    assert.deepEqual(run.updates, ["submitted", "failed"]);
  });

  it("stops on expired: it is terminal", async () => {
    const run = await track([pending, withStatus("expired")], RECORDED);

    assert.equal(run.outcome.kind, "expired");
    assert.equal(
      run.outcome.kind === "expired" && run.outcome.transaction.status,
      "expired"
    );
    assert.deepEqual(run.updates, ["pending", "expired"]);
    assert.deepEqual(statusTimes(run.calls), [0, 1500]);
    assert.equal(run.settledAt, 1500);
    assert.equal(run.clock.pendingTimers(), 0);
  });

  it("keeps polling an unknown status until the deadline", async () => {
    const run = await track([withStatus("refunding")], RECORDED);

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: true });
    assert.equal(run.settledAt, TRACKING_TIMEOUT_MS);
    assert.deepEqual(
      statusTimes(run.calls),
      pollTimesUntil(TRACKING_TIMEOUT_MS)
    );
    assert.ok(run.updates.every((status) => status === "refunding"));
  });

  it("doesn't count an unknown status as the backend holding a transaction", async () => {
    const run = await track([withStatus("refunding")], "never");

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: false });
  });

  it("switches from fast to slow polling after ten polls", async () => {
    const run = await track(
      [
        ...Array.from({ length: 12 }, () => withStatus("submitted")),
        withStatus("success"),
      ],
      RECORDED
    );

    const times = statusTimes(run.calls);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    assert.deepEqual(gaps, [
      ...Array.from({ length: 10 }, () => 1500),
      2500,
      2500,
    ]);
  });

  it("keeps polling through status read failures", async () => {
    const run = await track(
      [
        err(503, "upstream down"),
        "network",
        rateLimited(60),
        withStatus("success"),
      ],
      RECORDED
    );

    assert.equal(run.outcome.kind, "success");
    assert.deepEqual(run.updates, ["success"]);
    assert.deepEqual(statusTimes(run.calls), [0, 1500, 3000, 4500]);
  });
});

describe("trackIntent: how delivery ended", () => {
  it("ends with receipt_rejected, code included, when the delivery was refused and the intent stays pending", async () => {
    const run = await track([pending], {
      outcome: {
        kind: "rejected",
        httpStatus: 409,
        code: "tx_hash_committed_elsewhere",
        message: "transaction hash already used",
      },
      atMs: 0,
    });

    assert.deepEqual(run.outcome, {
      kind: "receipt_rejected",
      httpStatus: 409,
      code: "tx_hash_committed_elsewhere",
      message: "transaction hash already used",
    });
    assert.deepEqual(statusTimes(run.calls), [0]);
    assert.equal(run.settledAt, 0);
  });

  it("waits for a readable status before deciding a refusal is final", async () => {
    const run = await track(["network", err(503, "unavailable"), pending], {
      outcome: {
        kind: "rejected",
        httpStatus: 400,
        code: "payer_mismatch",
        message: "payer address mismatch",
      },
      atMs: 0,
    });

    assert.equal(run.outcome.kind, "receipt_rejected");
    assert.deepEqual(statusTimes(run.calls), [0, 1500, 3000]);
  });

  it("keeps tracking a refused delivery when the backend holds a transaction anyway", async () => {
    const run = await track([withStatus("submitted"), withStatus("success")], {
      outcome: {
        kind: "rejected",
        httpStatus: 409,
        code: "receipt_terminal",
        message: "receipt already terminal",
      },
      atMs: 0,
    });

    assert.equal(run.outcome.kind, "success");
  });

  it("only polls while the delivery is in flight", async () => {
    const run = await track([pending, withStatus("success")], "never");

    assert.equal(run.outcome.kind, "success");
    assert.deepEqual(receiptTimes(run.calls), []);
  });

  it("ends as intent_not_found when the delivery found no intent", async () => {
    const run = await track([pending], {
      outcome: { kind: "intent_not_found" },
      atMs: 2000,
    });

    assert.deepEqual(run.outcome, { kind: "intent_not_found" });
    // The 0 and 1500 reads came first; the loop sees it before the 3000 read.
    assert.deepEqual(statusTimes(run.calls), [0, 1500]);
  });

  it("stops on a status 404", async () => {
    const run = await track([err(404, "intent not found")], "never");

    assert.deepEqual(run.outcome, { kind: "intent_not_found" });
    assert.equal(run.settledAt, 0);
  });

  it("times out unrecorded when the delivery gave up", async () => {
    const run = await track([pending], {
      outcome: { kind: "gave_up", failures: 14 },
      atMs: 0,
    });

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: false });
  });

  it("counts a non-pending status as recorded even when the delivery was lost", async () => {
    const run = await track([withStatus("bridging")], {
      outcome: { kind: "crashed", error: new Error("bug") },
      atMs: 0,
    });

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: true });
  });
});

describe("trackIntent: deadline and cancellation", () => {
  it("times out recorded when the backend holds the transaction but never finishes", async () => {
    const run = await track([withStatus("submitted")], RECORDED);

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: true });
    assert.equal(run.settledAt, TRACKING_TIMEOUT_MS);
  });

  it("times out on schedule when a request hangs", async () => {
    const run = await track(["hang"], RECORDED);

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: true });
    assert.equal(run.settledAt, TRACKING_TIMEOUT_MS);
  });

  it("returns aborted without any request when the signal already fired", async () => {
    const controller = new AbortController();
    controller.abort();
    const run = await track([pending], RECORDED, { signal: controller.signal });

    assert.deepEqual(run.outcome, { kind: "aborted" });
    assert.deepEqual(run.calls, []);
  });

  it("returns aborted and stops requesting when the signal fires mid-tracking", async () => {
    const controller = new AbortController();
    const clock = virtualClock();
    const backend = installBackend(clock, {
      receipt: [accepted],
      status: [withStatus("submitted")],
    });
    const tracking = runIntentTracking(
      REPORT,
      {
        signal: controller.signal,
        onUpdate: () => {},
        receiptDelivery: Promise.resolve({ kind: "recorded" }),
      },
      clock
    );
    const abortAt4000 = clock
      .sleep(4000, new AbortController().signal)
      .then(() => controller.abort());

    const outcome = await clock.drive(tracking);
    await abortAt4000;

    assert.deepEqual(outcome, { kind: "aborted" });
    assert.equal(clock.now(), 4000);
    assert.deepEqual(statusTimes(backend.calls), [0, 1500, 3000]);
    assert.equal(clock.pendingTimers(), 0);
  });
});

describe("trackIntent: bugs are not retried", () => {
  it("rejects when a status read fails with an error no transport produces", async () => {
    const clock = virtualClock();
    installBackend(clock, { receipt: [accepted], status: ["bug"] });

    await assert.rejects(
      clock.drive(
        runIntentTracking(
          REPORT,
          {
            signal: new AbortController().signal,
            onUpdate: () => {},
            receiptDelivery: Promise.resolve({ kind: "recorded" }),
          },
          clock
        )
      ),
      { name: "RangeError", message: "not a transport failure" }
    );
    assert.equal(clock.pendingTimers(), 0);
  });
});

// trackIntent runs on the real clock. Every case below crashes on the first
// request, before any timer could matter.
describe("trackIntent: a crash ends tracking instead of hanging it", () => {
  const recorded = () =>
    Promise.resolve<ReceiptDeliveryOutcome>({ kind: "recorded" });

  it("returns crashed when a status read fails with an error no transport produces", async () => {
    const backend = installBackend(virtualClock(), {
      receipt: [accepted],
      status: ["bug"],
    });

    const outcome = await trackIntent(REPORT, {
      signal: new AbortController().signal,
      onUpdate: () => {},
      receiptDelivery: recorded(),
    });

    assert.ok(outcome.kind === "crashed");
    assert.ok(outcome.error instanceof RangeError);
    assert.deepEqual(
      backend.calls.map((c) => c.kind),
      ["status"]
    );
    assert.deepEqual(errors, [
      [
        "[Trustware] intent tracking crashed",
        { intentId: INTENT_ID, txHash: TX_HASH, error: outcome.error },
      ],
    ]);
  });

  it("logs a userOp receipt's crash under its userOp hash", async () => {
    installBackend(virtualClock(), { receipt: [accepted], status: ["bug"] });

    const outcome = await trackIntent(
      {
        intentId: INTENT_ID,
        userOpHash: USER_OP_HASH,
        sponsorshipRequestId: SPONSORSHIP_REQUEST_ID,
      },
      {
        signal: new AbortController().signal,
        onUpdate: () => {},
        receiptDelivery: recorded(),
      }
    );

    assert.ok(outcome.kind === "crashed");
    assert.deepEqual(errors, [
      [
        "[Trustware] intent tracking crashed",
        { intentId: INTENT_ID, userOpHash: USER_OP_HASH, error: outcome.error },
      ],
    ]);
  });

  it("returns crashed when onUpdate throws", async () => {
    installBackend(virtualClock(), {
      receipt: [accepted],
      status: [withStatus("bridging")],
    });
    const thrown = new Error("setState after unmount");

    const outcome = await trackIntent(REPORT, {
      signal: new AbortController().signal,
      onUpdate: () => {
        throw thrown;
      },
      receiptDelivery: recorded(),
    });

    assert.deepEqual(outcome, { kind: "crashed", error: thrown });
  });

  // An abort and a throw in the same tick: the rejection wins the race, so
  // the caller that aborted must still read "aborted", not an error screen.
  it("returns aborted when the caller aborted as the crash surfaced", async () => {
    installBackend(virtualClock(), {
      receipt: [accepted],
      status: [withStatus("bridging")],
    });
    const controller = new AbortController();

    const outcome = await trackIntent(REPORT, {
      signal: controller.signal,
      onUpdate: () => {
        controller.abort();
        throw new Error("setState after unmount");
      },
      receiptDelivery: recorded(),
    });

    assert.deepEqual(outcome, { kind: "aborted" });
    // Still logged: an abort does not make the bug go away.
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "[Trustware] intent tracking crashed");
  });

  it("passes a run's own outcome through unchanged", async () => {
    installBackend(virtualClock(), {
      receipt: [accepted],
      status: [withStatus("success")],
    });

    const outcome = await trackIntent(REPORT, {
      signal: new AbortController().signal,
      onUpdate: () => {},
      receiptDelivery: recorded(),
    });

    assert.ok(outcome.kind === "success");
    assert.equal(outcome.transaction.status, "success");
    assert.equal(errors.length, 0);
  });
});

// ── deliverReceipt: the commit posted at acceptance ─────────────────────────

async function deliver(receipt: Reply[], report: ReceiptReport = REPORT) {
  const clock = virtualClock();
  const backend = installBackend(clock, { receipt, status: [] });
  const delivery = deliverReceipt(report, clock);
  // The first POST is out before deliverReceipt returns, so a caller that
  // starts it at acceptance orders the receipt ahead of what it does next.
  const dispatchedBeforeReturn = backend.calls.length;
  const outcome = await clock.drive(delivery);
  return { outcome, dispatchedBeforeReturn, clock, ...backend };
}

describe("deliverReceipt: what it commits", () => {
  it("commits a tx hash once, dispatched before it returns, keyed by the hash", async () => {
    const run = await deliver([accepted]);
    assert.equal(run.dispatchedBeforeReturn, 1);
    assert.deepEqual(run.outcome, { kind: "recorded" });
    assert.deepEqual(receiptTimes(run.calls), [0]);
    assert.deepEqual(statusTimes(run.calls), []);
    assert.deepEqual(run.bodies, [{ txHash: TX_HASH }]);
    assert.deepEqual(run.idempotencyKeys, [TX_HASH]);
    assert.deepEqual(warnings, []);
    assert.deepEqual(errors, []);
  });

  it("commits a userOp hash with its sponsorship request, keyed by the userOp hash", async () => {
    const run = await deliver([accepted], {
      intentId: INTENT_ID,
      userOpHash: USER_OP_HASH,
      sponsorshipRequestId: SPONSORSHIP_REQUEST_ID,
      eoaAddress: EOA,
    });
    assert.deepEqual(run.outcome, { kind: "recorded" });
    assert.deepEqual(run.bodies, [
      {
        userOpHash: USER_OP_HASH,
        sponsorshipRequestId: SPONSORSHIP_REQUEST_ID,
        eoaAddress: EOA,
      },
    ]);
    assert.deepEqual(run.idempotencyKeys, [USER_OP_HASH]);
  });

  it("commits a tx hash with the smart-account fields a host passes", async () => {
    const run = await deliver([accepted], {
      intentId: INTENT_ID,
      txHash: TX_HASH,
      sponsorshipRequestId: SPONSORSHIP_REQUEST_ID,
      eoaAddress: EOA,
    });
    assert.deepEqual(run.bodies, [
      {
        txHash: TX_HASH,
        sponsorshipRequestId: SPONSORSHIP_REQUEST_ID,
        eoaAddress: EOA,
      },
    ]);
  });

  it("logs a userOp receipt's refusal under its userOp hash", async () => {
    const run = await deliver(
      [refused(409, "not_a_replacement", "sponsored receipts never swap")],
      {
        intentId: INTENT_ID,
        userOpHash: USER_OP_HASH,
        sponsorshipRequestId: SPONSORSHIP_REQUEST_ID,
      }
    );
    assert.equal(run.outcome.kind, "rejected");
    assert.deepEqual(errors, [
      [
        "[Trustware] receipt rejected",
        {
          intentId: INTENT_ID,
          userOpHash: USER_OP_HASH,
          httpStatus: 409,
          code: "not_a_replacement",
          message: "sponsored receipts never swap",
        },
      ],
    ]);
  });
});

describe("deliverReceipt: retries only what the contract calls retryable", () => {
  it("names exactly the four retryable codes", () => {
    assert.deepEqual(
      [...RETRYABLE_RECEIPT_CODES],
      RETRYABLE.map(([code]) => code)
    );
  });

  for (const [code, status] of RETRYABLE) {
    it(`retries ${code} with backoff until the commit lands`, async () => {
      const run = await deliver([
        refused(status, code, `refused: ${code}`),
        refused(status, code, `refused: ${code}`),
        accepted,
      ]);
      assert.deepEqual(run.outcome, { kind: "recorded" });
      assert.deepEqual(receiptTimes(run.calls), [0, 2000, 6000]);
      assert.equal(warnings.length, 2);
      assert.equal(
        warnings[0][0],
        "[Trustware] receipt delivery failed; will retry"
      );
      assert.deepEqual(
        { ...(warnings[1][1] as object), error: undefined },
        { intentId: INTENT_ID, txHash: TX_HASH, failures: 2, error: undefined }
      );
      assert.deepEqual(errors, []);
    });
  }

  for (const [code, status] of FINAL) {
    it(`stops on ${code}: it is final`, async () => {
      const run = await deliver([
        refused(status, code, `refused: ${code}`),
        accepted,
      ]);
      assert.deepEqual(run.outcome, {
        kind: "rejected",
        httpStatus: status,
        code,
        message: `refused: ${code}`,
      });
      assert.deepEqual(receiptTimes(run.calls), [0]);
      assert.deepEqual(errors, [
        [
          "[Trustware] receipt rejected",
          {
            intentId: INTENT_ID,
            txHash: TX_HASH,
            httpStatus: status,
            code,
            message: `refused: ${code}`,
          },
        ],
      ]);
    });
  }

  it("stops on route_intent_not_found: the backend has no such intent", async () => {
    const run = await deliver([
      refused(404, "route_intent_not_found", "intent not found"),
      accepted,
    ]);
    assert.deepEqual(run.outcome, { kind: "intent_not_found" });
    assert.deepEqual(receiptTimes(run.calls), [0]);
    assert.deepEqual(errors, [
      [
        "[Trustware] receipt rejected: the backend has no such intent",
        { intentId: INTENT_ID, txHash: TX_HASH },
      ],
    ]);
  });

  for (const status of [401, 403]) {
    it(`stops on the API-key middleware's codeless ${status}`, async () => {
      const run = await deliver([err(status, "invalid API key"), accepted]);
      assert.deepEqual(run.outcome, {
        kind: "rejected",
        httpStatus: status,
        code: null,
        message: "invalid API key",
      });
      assert.deepEqual(receiptTimes(run.calls), [0]);
    });
  }

  it("treats any other codeless refusal as a contract violation, loudly", async () => {
    const run = await deliver([
      err(409, "receipt already submitted"),
      accepted,
    ]);
    assert.equal(run.outcome.kind, "crashed");
    const error =
      run.outcome.kind === "crashed" ? (run.outcome.error as Error) : null;
    assert.equal(
      error?.message,
      `The receipt for intent ${INTENT_ID} was refused with HTTP 409 and no ` +
        `code ("receipt already submitted"); every commit refusal must carry one.`
    );
    assert.deepEqual(receiptTimes(run.calls), [0]);
    assert.equal(errors[0][0], "[Trustware] receipt delivery crashed");
  });

  it("retries a 5xx whatever its body says", async () => {
    const run = await deliver([
      refused(503, "receipt_terminal", "upstream timeout"),
      err(500, "failed to submit receipt"),
      "network",
      accepted,
    ]);
    assert.deepEqual(run.outcome, { kind: "recorded" });
    assert.deepEqual(receiptTimes(run.calls), [0, 2000, 6000, 14000]);
  });

  it("waits out the server's Retry-After before re-sending a rate-limited commit", async () => {
    const run = await deliver([rateLimited(60), accepted]);
    assert.deepEqual(run.outcome, { kind: "recorded" });
    assert.deepEqual(receiptTimes(run.calls), [0, 60000]);
  });

  it("gives up at the tracking deadline, loudly, after a bounded number of attempts", async () => {
    const run = await deliver([refused(409, "tx_not_visible", "not visible")]);
    assert.deepEqual(run.outcome, { kind: "gave_up", failures: 14 });
    assert.deepEqual(
      receiptTimes(run.calls),
      [
        0, 2000, 6000, 14000, 30000, 60000, 90000, 120000, 150000, 180000,
        210000, 240000, 270000, 300000,
      ]
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "[Trustware] receipt delivery gave up");
  });

  it("never rejects, even on a failure no transport produces", async () => {
    const run = await deliver(["bug"]);
    assert.equal(run.outcome.kind, "crashed");
    assert.equal(errors[0][0], "[Trustware] receipt delivery crashed");
  });
});

// ── Properties ──────────────────────────────────────────────────────────────

function pick<T>(random: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [value, w] of weighted) {
    if ((r -= w) < 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

type CommitChoice =
  | { kind: "accepted" }
  | { kind: "transport"; reply: "500" | "network" | "429" }
  | { kind: "retryable"; code: string; status: number }
  | { kind: "final"; code: string; status: number }
  | { kind: "not_found" }
  | { kind: "middleware"; status: 401 | 403 };

function commitReply(choice: CommitChoice): Reply {
  switch (choice.kind) {
    case "accepted":
      return accepted;
    case "transport":
      return choice.reply === "500"
        ? err(500, "failed to submit receipt")
        : choice.reply === "network"
          ? "network"
          : rateLimited(45);
    case "retryable":
    case "final":
      return refused(choice.status, choice.code, `refused: ${choice.code}`);
    case "not_found":
      return refused(404, "route_intent_not_found", "intent not found");
    case "middleware":
      return err(choice.status, "invalid API key");
  }
}

function generateCommit(random: () => number): CommitChoice {
  const [code, status] = RETRYABLE[Math.floor(random() * RETRYABLE.length)];
  const [finalCode, finalStatus] = FINAL[Math.floor(random() * FINAL.length)];
  return pick<CommitChoice>(random, [
    [{ kind: "accepted" }, 2],
    [{ kind: "transport", reply: "500" }, 2],
    [{ kind: "transport", reply: "network" }, 2],
    [{ kind: "transport", reply: "429" }, 0.5],
    [{ kind: "retryable", code, status }, 6],
    [{ kind: "final", code: finalCode, status: finalStatus }, 1],
    [{ kind: "not_found" }, 0.3],
    [{ kind: "middleware", status: random() < 0.5 ? 401 : 403 }, 0.2],
  ]);
}

const isTransient = (choice: CommitChoice) =>
  choice.kind === "transport" || choice.kind === "retryable";

describe("deliverReceipt properties", () => {
  it("retries exactly the transient answers and ends on the first other one", async () => {
    for (let seed = 1; seed <= 300; seed++) {
      const random = mulberry32(seed);
      const script = Array.from({ length: 1 + Math.floor(random() * 20) }, () =>
        generateCommit(random)
      );
      const answers = [...script];
      const nextAnswer = () =>
        answers.length > 1 ? answers.shift()! : answers[0];
      const answered: CommitChoice[] = [];

      const clock = virtualClock();
      installBackend(clock, {
        receipt: script.map(commitReply),
        status: [],
      });
      const scriptedFetch = globalThis.fetch;
      globalThis.fetch = ((url: string, init?: RequestInit) => {
        answered.push(nextAnswer());
        return scriptedFetch(url, init);
      }) as typeof fetch;

      const outcome = await clock.drive(deliverReceipt(REPORT, clock));
      const context = `seed ${seed}: ${JSON.stringify(outcome)} after ${JSON.stringify(answered)}`;

      // Bounded by the deadline.
      assert.ok(clock.now() <= TRACKING_TIMEOUT_MS, context);
      // Every answer but the last was transient: nothing final is retried.
      assert.ok(answered.slice(0, -1).every(isTransient), context);
      const last = answered[answered.length - 1];
      switch (last.kind) {
        case "accepted":
          assert.deepEqual(outcome, { kind: "recorded" }, context);
          break;
        case "final":
          assert.deepEqual(
            outcome,
            {
              kind: "rejected",
              httpStatus: last.status,
              code: last.code,
              message: `refused: ${last.code}`,
            },
            context
          );
          break;
        case "not_found":
          assert.deepEqual(outcome, { kind: "intent_not_found" }, context);
          break;
        case "middleware":
          assert.deepEqual(
            outcome,
            {
              kind: "rejected",
              httpStatus: last.status,
              code: null,
              message: "invalid API key",
            },
            context
          );
          break;
        case "transport":
        case "retryable":
          // Transient to the end: it stopped only because the next try
          // would land past the deadline.
          assert.deepEqual(
            outcome,
            { kind: "gave_up", failures: answered.length },
            context
          );
          break;
      }
      await drainTasks();
    }
  });
});

type StatusChoice =
  | "pending"
  | "submitted"
  | "bridging"
  | "success"
  | "failed"
  | "expired"
  | "refunding"
  | "503"
  | "network"
  | "404";

const statusReply: Record<StatusChoice, Reply> = {
  pending,
  submitted: withStatus("submitted"),
  bridging: withStatus("bridging"),
  success: withStatus("success"),
  failed: withStatus("failed"),
  expired: withStatus("expired"),
  refunding: withStatus("refunding"),
  "503": err(503, "unavailable"),
  network: "network",
  "404": err(404, "intent not found"),
};

function generateDelivery(random: () => number): ScriptedDelivery {
  if (random() < 0.15) return "never";
  const outcome = pick<ReceiptDeliveryOutcome>(random, [
    [{ kind: "recorded" }, 4],
    [
      {
        kind: "rejected",
        httpStatus: 409,
        code: "tx_hash_committed_elsewhere",
        message: "used elsewhere",
      },
      2,
    ],
    [{ kind: "intent_not_found" }, 0.3],
    [{ kind: "gave_up", failures: 14 }, 1],
    [{ kind: "crashed", error: new Error("bug") }, 0.5],
  ]);
  // Strictly before the deadline, so the two never tie.
  const atMs =
    random() < 0.3 ? 0 : Math.floor(random() * (TRACKING_TIMEOUT_MS - 1));
  return { outcome, atMs };
}

describe("trackIntent properties", () => {
  it("holds its invariants across generated statuses and deliveries", async () => {
    for (let seed = 1; seed <= 250; seed++) {
      const random = mulberry32(seed);
      const statusScript = Array.from(
        { length: 1 + Math.floor(random() * 200) },
        () =>
          pick<StatusChoice>(random, [
            ["pending", 12],
            ["submitted", 3],
            ["bridging", 2],
            ["refunding", 2],
            ["503", 2],
            ["network", 2],
            ["success", 0.4],
            ["failed", 0.2],
            ["expired", 0.2],
            ["404", 0.05],
          ])
      );
      const delivery = generateDelivery(random);

      const answers = [...statusScript];
      const nextAnswer = () =>
        answers.length > 1 ? answers.shift()! : answers[0];
      const answered: StatusChoice[] = [];

      const clock = virtualClock();
      const backend = installBackend(clock, {
        receipt: [accepted],
        status: statusScript.map((c) => statusReply[c]),
      });
      const scriptedFetch = globalThis.fetch;
      globalThis.fetch = ((url: string, init?: RequestInit) => {
        answered.push(nextAnswer());
        return scriptedFetch(url, init);
      }) as typeof fetch;

      const outcome = await clock.drive(
        runIntentTracking(
          REPORT,
          {
            signal: new AbortController().signal,
            onUpdate: () => {},
            receiptDelivery: scriptedDelivery(clock, delivery),
          },
          clock
        )
      );
      const context = `seed ${seed}: ${JSON.stringify(outcome)} after ${JSON.stringify(answered)} with ${JSON.stringify(delivery)}`;
      const settledAt = clock.now();
      const callsAtSettle = answered.length;

      assert.ok(settledAt <= TRACKING_TIMEOUT_MS, context);
      // Tracking never posts the receipt: the send step's delivery does.
      assert.deepEqual(receiptTimes(backend.calls), [], context);

      const last = answered[answered.length - 1];
      const sawHeld = answered.some(
        (a) => a === "submitted" || a === "bridging"
      );
      const deliveryKind =
        delivery === "never" ? "never" : delivery.outcome.kind;
      switch (outcome.kind) {
        case "success":
        case "failed":
        case "expired":
          // Only these three end tracking, and only on their own read: an
          // unknown status never does.
          assert.equal(last, outcome.kind, context);
          break;
        case "receipt_rejected":
          assert.equal(last, "pending", context);
          assert.equal(deliveryKind, "rejected", context);
          assert.ok(!sawHeld, context);
          break;
        case "intent_not_found":
          assert.ok(
            last === "404" || deliveryKind === "intent_not_found",
            context
          );
          break;
        case "timed_out":
          assert.equal(settledAt, TRACKING_TIMEOUT_MS, context);
          // Recorded exactly when the delivery recorded it, or a status
          // said the backend holds a transaction. An unknown status says
          // nothing.
          assert.equal(
            outcome.recorded,
            deliveryKind === "recorded" || sawHeld,
            context
          );
          assert.ok(
            !answered.some(
              (a) => a === "success" || a === "failed" || a === "expired"
            ),
            context
          );
          break;
        case "aborted":
          assert.fail(`nothing aborted this run; ${context}`);
      }

      // Nothing is requested after tracking settles.
      await drainTasks();
      assert.equal(answered.length, callsAtSettle, context);
    }
  });
});
