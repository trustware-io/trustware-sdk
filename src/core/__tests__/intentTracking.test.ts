import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  runIntentTracking,
  TRACKING_TIMEOUT_MS,
  type IntentTrackingOutcome,
  type ReceiptReport,
  type TrackingClock,
} from "../intentTracking";
import { TrustwareConfigStore } from "../../config/store";
import type { Transaction } from "../../types";

const INTENT_ID = "b412c1c0-73a7-4186-9d06-0bb222043cb2";
const TX_HASH =
  "0x07d5000000000000000000000000000000000000000000000000000000004bb0";
const REPORT: ReceiptReport = { intentId: INTENT_ID, txHash: TX_HASH };

// ── Scripted backend ────────────────────────────────────────────────────────

/** One scripted answer. "network" rejects like fetch does offline; "hang"
 *  never settles; "bug" rejects with an error no transport produces. */
type Reply = (() => Response) | "network" | "hang" | "bug";

const ok = (data: unknown) => () =>
  new Response(JSON.stringify({ data }), { status: 200 });
const err = (status: number, message: string) => () =>
  new Response(JSON.stringify({ error: message }), { status });
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
});
const withStatus = (status: Transaction["status"]) =>
  ok({ intent_id: INTENT_ID, status, source_tx_hash: TX_HASH });

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
    }
    const reply = next(kind === "receipt" ? script.receipt : script.status);
    if (reply === "network") throw new TypeError("Failed to fetch");
    if (reply === "hang") return new Promise<Response>(() => {});
    if (reply === "bug") throw new RangeError("not a transport failure");
    return reply();
  }) as typeof fetch;

  return { calls, bodies };
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

async function track(
  script: { receipt: Reply[]; status: Reply[] },
  options: { report?: ReceiptReport; signal?: AbortSignal } = {}
) {
  const clock = virtualClock();
  const backend = installBackend(clock, script);
  const updates: Transaction["status"][] = [];
  const outcome: IntentTrackingOutcome = await clock.drive(
    runIntentTracking(
      options.report ?? REPORT,
      {
        signal: options.signal ?? new AbortController().signal,
        onUpdate: (tx) => updates.push(tx.status),
      },
      clock
    )
  );
  return { outcome, updates, clock, ...backend, settledAt: clock.now() };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("trackIntent: receipt delivered first time", () => {
  it("polls through submitted and bridging to success, sending the receipt once", async () => {
    const run = await track({
      receipt: [accepted],
      status: [
        withStatus("submitted"),
        withStatus("bridging"),
        withStatus("success"),
      ],
    });

    assert.equal(run.outcome.kind, "success");
    assert.equal(
      run.outcome.kind === "success" && run.outcome.transaction.sourceTxHash,
      TX_HASH
    );
    assert.deepEqual(run.updates, ["submitted", "bridging", "success"]);
    assert.deepEqual(receiptTimes(run.calls), [0]);
    assert.deepEqual(statusTimes(run.calls), [0, 1500, 3000]);
    // The receipt goes out before the first status read.
    assert.equal(run.calls[0].kind, "receipt");
    assert.deepEqual(run.bodies, [{ txHash: TX_HASH }]);
    assert.equal(run.clock.pendingTimers(), 0);
    assert.deepEqual(warnings, []);
    assert.deepEqual(errors, []);
  });

  it("reports a failed transaction as failed", async () => {
    const run = await track({
      receipt: [accepted],
      status: [withStatus("submitted"), withStatus("failed")],
    });

    assert.equal(run.outcome.kind, "failed");
    assert.deepEqual(run.updates, ["submitted", "failed"]);
  });

  it("sends the smart-account fields with the receipt", async () => {
    const run = await track(
      { receipt: [accepted], status: [withStatus("success")] },
      {
        report: {
          ...REPORT,
          sponsorshipRequestId: "8d1f1f39-2a9c-4f0e-9d55-7d6b1c0e2f11",
          eoaAddress: "0xb7e4cac65d6b9e66341b78fa94134c3b5869b1a6",
        },
      }
    );

    assert.deepEqual(run.bodies, [
      {
        txHash: TX_HASH,
        sponsorshipRequestId: "8d1f1f39-2a9c-4f0e-9d55-7d6b1c0e2f11",
        eoaAddress: "0xb7e4cac65d6b9e66341b78fa94134c3b5869b1a6",
      },
    ]);
  });

  it("switches from fast to slow polling after ten polls", async () => {
    const run = await track({
      receipt: [accepted],
      status: [
        ...Array.from({ length: 12 }, () => withStatus("submitted")),
        withStatus("success"),
      ],
    });

    const times = statusTimes(run.calls);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    assert.deepEqual(gaps, [
      ...Array.from({ length: 10 }, () => 1500),
      2500,
      2500,
    ]);
  });
});

describe("trackIntent: receipt lost to transient failures (BVT-261)", () => {
  // The July 16 incident: one receipt POST returned 500, nothing re-sent it,
  // and the intent read "pending" until the widget gave up.
  it("re-sends after 500s with backoff until accepted, then tracks to success", async () => {
    const run = await track({
      receipt: [
        err(500, "failed to submit receipt"),
        err(500, "failed to submit receipt"),
        accepted,
      ],
      status: [
        pending,
        pending,
        pending,
        pending,
        pending,
        pending,
        withStatus("submitted"),
        withStatus("success"),
      ],
    });

    assert.equal(run.outcome.kind, "success");
    // Fail at 0 → due at 2000, sent on the 3000 poll. Fail again → due at
    // 3000 + 4000, sent on the 7500 poll, accepted.
    assert.deepEqual(receiptTimes(run.calls), [0, 3000, 7500]);
    assert.equal(warnings.length, 2);
    assert.equal(
      warnings[0][0],
      "[Trustware] receipt delivery failed; will retry"
    );
    assert.deepEqual(
      { ...(warnings[1][1] as object), error: undefined },
      { intentId: INTENT_ID, txHash: TX_HASH, failures: 2, error: undefined }
    );
  });

  it("re-sends after network failures", async () => {
    const run = await track({
      receipt: ["network", accepted],
      status: [pending, pending, pending, withStatus("success")],
    });

    assert.equal(run.outcome.kind, "success");
    assert.deepEqual(receiptTimes(run.calls), [0, 3000]);
  });

  it("waits out the server's Retry-After before re-sending a rate-limited receipt", async () => {
    const run = await track({
      receipt: [rateLimited(60), accepted],
      status: [
        ...Array.from({ length: 30 }, () => pending),
        withStatus("submitted"),
        withStatus("success"),
      ],
    });

    assert.equal(run.outcome.kind, "success");
    const [first, second] = receiptTimes(run.calls);
    assert.equal(first, 0);
    // Due at 60000, which is itself a poll time: 15000 after the ten fast
    // polls, then 18 slow ones.
    assert.equal(second, 60000);
  });

  it("caps the backoff at 30s and times out unrecorded when every attempt fails", async () => {
    const run = await track({
      receipt: [err(503, "service unavailable")],
      status: [pending],
    });

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: false });
    assert.equal(run.settledAt, TRACKING_TIMEOUT_MS);
    const times = receiptTimes(run.calls);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    // Backoff 2s, 4s, 8s, 16s, then 30s; each send lands on the first poll
    // at or after it is due. Polls run at 0, 1500, ..., 15000, then every
    // 2500. Sends: 0 → due 2000 → 3000 → due 7000 → 7500 → due 15500 →
    // 17500 → due 33500 → 35000 → due 65000 → 65000.
    assert.deepEqual(gaps.slice(0, 5), [3000, 4500, 10000, 17500, 30000]);
    assert.ok(
      gaps.slice(4).every((g) => g >= 30000 && g < 32500),
      `gaps ${gaps}`
    );
    assert.equal(run.clock.pendingTimers(), 0);
  });

  it("keeps polling through status read failures", async () => {
    const run = await track({
      receipt: [accepted],
      status: [
        err(503, "upstream down"),
        "network",
        rateLimited(60),
        withStatus("success"),
      ],
    });

    assert.equal(run.outcome.kind, "success");
    assert.deepEqual(run.updates, ["success"]);
    assert.deepEqual(receiptTimes(run.calls), [0]);
  });
});

describe("trackIntent: receipt refused", () => {
  it("ends with receipt_rejected when a 400 leaves the intent pending", async () => {
    const message =
      "payer address mismatch: expected 0x14ab1ea44bd9a99d84523263eb88d56dc66acfb7 got 0x047f881cf6a3e7c931e55c60211fb89cd8446f9e";
    const run = await track({
      receipt: [err(400, message)],
      status: [pending],
    });

    assert.deepEqual(run.outcome, {
      kind: "receipt_rejected",
      httpStatus: 400,
      message,
    });
    assert.deepEqual(receiptTimes(run.calls), [0]);
    assert.deepEqual(statusTimes(run.calls), [0]);
    assert.equal(run.settledAt, 0);
    assert.deepEqual(errors, [
      [
        "[Trustware] receipt rejected",
        { intentId: INTENT_ID, txHash: TX_HASH, httpStatus: 400, message },
      ],
    ]);
  });

  it("keeps tracking when a 409 means the backend already holds the transaction", async () => {
    const run = await track({
      receipt: [err(409, "receipt already submitted for this intent")],
      status: [withStatus("submitted"), withStatus("success")],
    });

    assert.equal(run.outcome.kind, "success");
    assert.deepEqual(receiptTimes(run.calls), [0]);
  });

  it("ends with receipt_rejected when a 409 leaves the intent pending", async () => {
    const run = await track({
      receipt: [err(409, "transaction hash already used")],
      status: [pending],
    });

    assert.deepEqual(run.outcome, {
      kind: "receipt_rejected",
      httpStatus: 409,
      message: "transaction hash already used",
    });
  });

  it("waits for a readable status before deciding a rejection is final", async () => {
    const run = await track({
      receipt: [err(400, "invalid eoaAddress")],
      status: ["network", err(502, "bad gateway"), pending],
    });

    assert.equal(run.outcome.kind, "receipt_rejected");
    assert.deepEqual(statusTimes(run.calls), [0, 1500, 3000]);
    assert.deepEqual(receiptTimes(run.calls), [0]);
  });
});

describe("trackIntent: intent unknown", () => {
  it("stops on a receipt 404 without reading status", async () => {
    const run = await track({
      receipt: [err(404, "intent not found")],
      status: [pending],
    });

    assert.deepEqual(run.outcome, { kind: "intent_not_found" });
    assert.deepEqual(statusTimes(run.calls), []);
  });

  it("stops on a status 404", async () => {
    const run = await track({
      receipt: [err(500, "failed to submit receipt")],
      status: [err(404, "intent not found")],
    });

    assert.deepEqual(run.outcome, { kind: "intent_not_found" });
    assert.equal(run.settledAt, 0);
  });
});

describe("trackIntent: deadline and cancellation", () => {
  it("times out recorded when the backend holds the transaction but never finishes", async () => {
    const run = await track({
      receipt: [accepted],
      status: [withStatus("submitted")],
    });

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: true });
    assert.equal(run.settledAt, TRACKING_TIMEOUT_MS);
    assert.deepEqual(receiptTimes(run.calls), [0]);
  });

  it("counts a non-pending status as recorded even if no receipt was ever accepted", async () => {
    // Another tab or the smart-account one-shot may have delivered it.
    const run = await track({
      receipt: [err(500, "failed to submit receipt")],
      status: [withStatus("bridging")],
    });

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: true });
    assert.deepEqual(receiptTimes(run.calls), [0]);
  });

  it("times out on schedule when a request hangs", async () => {
    const run = await track({ receipt: [accepted], status: ["hang"] });

    assert.deepEqual(run.outcome, { kind: "timed_out", recorded: true });
    assert.equal(run.settledAt, TRACKING_TIMEOUT_MS);
  });

  it("returns aborted without any request when the signal already fired", async () => {
    const controller = new AbortController();
    controller.abort();
    const run = await track(
      { receipt: [accepted], status: [pending] },
      { signal: controller.signal }
    );

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
      { signal: controller.signal, onUpdate: () => {} },
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
  it("rejects when submitReceipt fails with an error no transport produces", async () => {
    const clock = virtualClock();
    installBackend(clock, { receipt: ["bug"], status: [pending] });

    await assert.rejects(
      clock.drive(
        runIntentTracking(
          REPORT,
          { signal: new AbortController().signal, onUpdate: () => {} },
          clock
        )
      ),
      { name: "RangeError", message: "not a transport failure" }
    );
    assert.equal(clock.pendingTimers(), 0);
  });

  it("rejects when a status read fails with an error no transport produces", async () => {
    const clock = virtualClock();
    installBackend(clock, { receipt: [accepted], status: ["bug"] });

    await assert.rejects(
      clock.drive(
        runIntentTracking(
          REPORT,
          { signal: new AbortController().signal, onUpdate: () => {} },
          clock
        )
      ),
      { name: "RangeError" }
    );
  });
});

// ── Properties ──────────────────────────────────────────────────────────────

/** Deterministic PRNG so a failing seed reproduces. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ReceiptChoice =
  "accepted" | "500" | "network" | "429" | "400" | "409" | "404";
type StatusChoice =
  | "pending"
  | "submitted"
  | "bridging"
  | "success"
  | "failed"
  | "503"
  | "network"
  | "404";

const receiptReply: Record<ReceiptChoice, Reply> = {
  accepted,
  "500": err(500, "failed to submit receipt"),
  network: "network",
  "429": rateLimited(45),
  "400": err(400, "invalid transaction hash format"),
  "409": err(409, "receipt already submitted for this intent"),
  "404": err(404, "intent not found"),
};
const statusReply: Record<StatusChoice, Reply> = {
  pending,
  submitted: withStatus("submitted"),
  bridging: withStatus("bridging"),
  success: withStatus("success"),
  failed: withStatus("failed"),
  "503": err(503, "unavailable"),
  network: "network",
  "404": err(404, "intent not found"),
};

function pick<T>(random: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [value, w] of weighted) {
    if ((r -= w) < 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

describe("trackIntent properties", () => {
  it("holds its invariants across generated backend behaviour", async () => {
    for (let seed = 1; seed <= 250; seed++) {
      const random = mulberry32(seed);
      const receiptScript = Array.from(
        { length: 1 + Math.floor(random() * 6) },
        () =>
          pick<ReceiptChoice>(random, [
            ["accepted", 3],
            ["500", 4],
            ["network", 3],
            ["429", 1],
            ["400", 1],
            ["409", 1],
            ["404", 0.3],
          ])
      );
      const statusScript = Array.from(
        { length: 1 + Math.floor(random() * 200) },
        () =>
          pick<StatusChoice>(random, [
            ["pending", 12],
            ["submitted", 3],
            ["bridging", 2],
            ["503", 2],
            ["network", 2],
            ["success", 0.4],
            ["failed", 0.2],
            ["404", 0.05],
          ])
      );

      // Mirror the scripts' consumption to know what each request answered.
      const receiptAnswers = [...receiptScript];
      const statusAnswers = [...statusScript];
      const nextAnswer = <T>(queue: T[]) =>
        queue.length > 1 ? queue.shift()! : queue[0];
      const answered: (
        | { kind: "receipt"; reply: ReceiptChoice }
        | { kind: "status"; reply: StatusChoice }
      )[] = [];

      const clock = virtualClock();
      installBackend(clock, {
        receipt: receiptScript.map((c) => receiptReply[c]),
        status: statusScript.map((c) => statusReply[c]),
      });
      const recordingFetch = globalThis.fetch;
      globalThis.fetch = ((url: string, init?: RequestInit) => {
        if (url.endsWith("/receipt")) {
          answered.push({ kind: "receipt", reply: nextAnswer(receiptAnswers) });
        } else {
          answered.push({ kind: "status", reply: nextAnswer(statusAnswers) });
        }
        return recordingFetch(url, init);
      }) as typeof fetch;

      const outcome = await clock.drive(
        runIntentTracking(
          REPORT,
          { signal: new AbortController().signal, onUpdate: () => {} },
          clock
        )
      );
      const context = `seed ${seed}: ${JSON.stringify(outcome)} after ${JSON.stringify(answered.map((a) => `${a.kind[0]}:${a.reply}`))}`;
      const settledAt = clock.now();
      const callsAtSettle = answered.length;

      // Always settles by the deadline, and leaves no timer behind.
      assert.ok(settledAt <= TRACKING_TIMEOUT_MS, context);
      assert.equal(clock.pendingTimers(), 0, context);

      // The receipt is never sent again once the backend holds a transaction
      // (accepted, or any non-pending status) or once it was refused.
      let receiptSettled = false;
      for (const a of answered) {
        if (a.kind === "receipt") {
          assert.ok(
            !receiptSettled,
            `receipt re-sent after it settled; ${context}`
          );
          if (["accepted", "400", "409"].includes(a.reply))
            receiptSettled = true;
        } else if (
          ["submitted", "bridging", "success", "failed"].includes(a.reply)
        ) {
          receiptSettled = true;
        }
      }

      const lastStatus = [...answered]
        .reverse()
        .find((a) => a.kind === "status");
      const lastReceipt = [...answered]
        .reverse()
        .find((a) => a.kind === "receipt");
      const everRecorded = answered.some(
        (a) =>
          (a.kind === "receipt" && a.reply === "accepted") ||
          (a.kind === "status" &&
            ["submitted", "bridging", "success", "failed"].includes(a.reply))
      );
      switch (outcome.kind) {
        case "success":
        case "failed":
          assert.equal(lastStatus?.reply, outcome.kind, context);
          break;
        case "receipt_rejected":
          assert.equal(lastStatus?.reply, "pending", context);
          assert.ok(["400", "409"].includes(lastReceipt?.reply ?? ""), context);
          assert.ok(!everRecorded, context);
          break;
        case "intent_not_found":
          assert.ok(
            lastStatus?.reply === "404" || lastReceipt?.reply === "404",
            context
          );
          break;
        case "timed_out":
          assert.equal(settledAt, TRACKING_TIMEOUT_MS, context);
          assert.equal(outcome.recorded, everRecorded, context);
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
