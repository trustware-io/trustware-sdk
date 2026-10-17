/* core/intentTracking.ts */
import { getStatus, submitReceipt } from "./routes";
import { HttpError, RateLimitError } from "./http";
import type { Transaction } from "../types";

/**
 * Everything the backend needs to start tracking a sent transaction: the body
 * of POST /route-intent/{intentId}/receipt.
 */
export type ReceiptReport = {
  intentId: string;
  txHash: string;
  /** Set on the sponsored smart-account path. */
  sponsorshipRequestId?: string;
  /** The connected wallet, when the route executed from a smart account. */
  eoaAddress?: string;
};

/**
 * How tracking ended. Every kind needs its own handling, so callers switch
 * over `kind` exhaustively instead of reading flags.
 */
export type IntentTrackingOutcome =
  | { kind: "success"; transaction: Transaction }
  | { kind: "failed"; transaction: Transaction }
  /** The backend has never heard of the intent. Retrying cannot help. */
  | { kind: "intent_not_found" }
  /**
   * The backend refused the receipt and holds no transaction for the intent,
   * so nothing will ever move its status past "pending". The transaction is
   * still on-chain; only Trustware's view of it is missing.
   */
  | { kind: "receipt_rejected"; httpStatus: number; message: string }
  /**
   * No terminal status inside TRACKING_TIMEOUT_MS. `recorded` says whether
   * the backend holds a transaction for the intent: when false, every receipt
   * attempt failed transiently and the backend is not tracking the swap.
   */
  | { kind: "timed_out"; recorded: boolean }
  /**
   * Tracking threw an error no transport failure produces: a bug, or a
   * backend reply the SDK cannot parse. Only trackIntent returns this, after
   * logging the error. The transaction may still be on-chain.
   */
  | { kind: "crashed"; error: unknown }
  /** The caller's signal fired. */
  | { kind: "aborted" };

export const TRACKING_TIMEOUT_MS = 5 * 60_000;

const FAST_POLL_MS = 1_500;
const SLOW_POLL_MS = 2_500;
const FAST_POLL_COUNT = 10;
const RECEIPT_RETRY_BASE_MS = 2_000;
const RECEIPT_RETRY_MAX_MS = 30_000;

/** Time source for tracking; tests drive it virtually. */
export type TrackingClock = {
  now(): number;
  /** Resolves after `ms`, or as soon as `signal` aborts. Never rejects. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
};

const systemClock: TrackingClock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }),
};

export type TrackIntentOptions = {
  signal: AbortSignal;
  /** Every status payload read, terminal or not. */
  onUpdate: (transaction: Transaction) => void;
  /**
   * The receipt is already being delivered (`deliverReceipt`, started when
   * the send was accepted), so tracking only polls and reads this for how
   * delivery ended. Without it, tracking posts the receipt itself.
   */
  receiptDelivery?: Promise<ReceiptDeliveryOutcome>;
};

/** How `deliverReceipt` ended. */
export type ReceiptDeliveryOutcome =
  | { kind: "recorded" }
  | { kind: "rejected"; httpStatus: number; message: string }
  | { kind: "intent_not_found" }
  /** Every attempt failed transiently until TRACKING_TIMEOUT_MS. */
  | { kind: "gave_up"; failures: number }
  /** A failure no transport produces: a bug. Logged. */
  | { kind: "crashed"; error: unknown };

/** How long to wait before re-sending a receipt after `failures`
 *  consecutive transient failures, honouring a server-directed wait. */
function receiptRetryDelayMs(failures: number, serverWaitMs: number): number {
  const backoffMs = Math.min(
    RECEIPT_RETRY_BASE_MS * 2 ** (failures - 1),
    RECEIPT_RETRY_MAX_MS
  );
  return Math.max(backoffMs, serverWaitMs);
}

const neverAborted = new AbortController().signal;

/**
 * Post the receipt for a send the network accepted, retrying transient
 * failures with trackIntent's backoff until TRACKING_TIMEOUT_MS.
 *
 * The first POST is dispatched before this returns (nothing is awaited
 * before it), so calling this at acceptance orders the receipt ahead of
 * whatever the caller does next. It never rejects, and every ending other
 * than "recorded" is logged as an error, since it means the backend may
 * not be tracking a transaction that was sent.
 */
export function deliverReceipt(
  report: ReceiptReport,
  clock: TrackingClock = systemClock
): Promise<ReceiptDeliveryOutcome> {
  const deadline = clock.now() + TRACKING_TIMEOUT_MS;
  const first = attemptReceipt(report);
  const log = (what: string, detail: Record<string, unknown>) =>
    console.error(`[Trustware] receipt ${what}`, {
      intentId: report.intentId,
      txHash: report.txHash,
      ...detail,
    });

  const run = async (): Promise<ReceiptDeliveryOutcome> => {
    let attempt = first;
    let failures = 0;
    for (;;) {
      let result: ReceiptAttempt;
      try {
        result = await attempt;
      } catch (error) {
        log("delivery crashed", { error });
        return { kind: "crashed", error };
      }
      switch (result.kind) {
        case "accepted":
          return { kind: "recorded" };
        case "rejected":
          log("rejected", {
            httpStatus: result.httpStatus,
            message: result.message,
          });
          return result;
        case "intent_not_found":
          log("rejected: the backend has no such intent", {});
          return { kind: "intent_not_found" };
        case "transient": {
          failures += 1;
          const waitMs = receiptRetryDelayMs(failures, result.serverWaitMs);
          if (clock.now() + waitMs > deadline) {
            log("delivery gave up", { failures, error: result.error });
            return { kind: "gave_up", failures };
          }
          console.warn("[Trustware] receipt delivery failed; will retry", {
            intentId: report.intentId,
            txHash: report.txHash,
            failures,
            error: result.error,
          });
          await clock.sleep(waitMs, neverAborted);
          attempt = attemptReceipt(report);
          break;
        }
        default:
          assertNever(result);
      }
    }
  };
  return run();
}

/**
 * Delivers the receipt for a sent transaction and polls the intent's status
 * until it is terminal, the backend proves it will never track it, or
 * TRACKING_TIMEOUT_MS passes.
 *
 * Delivery and polling are one operation because polling alone cannot finish:
 * the backend creates the transaction it tracks only when a receipt arrives,
 * so an intent whose receipt was lost reads "pending" forever. While the
 * status still reads "pending", a receipt that failed transiently (network,
 * 5xx, rate limit) is re-sent with backoff. Re-sending is safe because
 * submitReceipt keys each request by tx hash and the backend answers 409 once
 * it holds a transaction for the intent.
 */
export async function trackIntent(
  report: ReceiptReport,
  options: TrackIntentOptions
): Promise<IntentTrackingOutcome> {
  // Callers run tracking detached from any await, so a rejection here would
  // reach nothing but the unhandled-rejection log while the progress screen
  // waits forever. As an outcome it goes through the same exhaustive switch
  // that routes every other ending to the error screen.
  try {
    return await runIntentTracking(report, options, systemClock);
  } catch (error) {
    console.error("[Trustware] intent tracking crashed", {
      intentId: report.intentId,
      txHash: report.txHash,
      error,
    });
    return options.signal.aborted
      ? { kind: "aborted" }
      : { kind: "crashed", error };
  }
}

type ReceiptState =
  | { kind: "due"; failures: number; dueAt: number }
  /** `deliverReceipt` owns delivery and hasn't finished. */
  | { kind: "delegated" }
  /** `deliverReceipt` gave up or crashed: nothing will deliver it now. */
  | { kind: "lost" }
  | { kind: "recorded" }
  | { kind: "rejected"; httpStatus: number; message: string };

type ReceiptAttempt =
  | { kind: "accepted" }
  | { kind: "rejected"; httpStatus: number; message: string }
  | { kind: "intent_not_found" }
  | { kind: "transient"; error: unknown; serverWaitMs: number };

/** runIntentTracking rejects on a crash; only trackIntent makes it an outcome. */
type TrackingRunOutcome = Exclude<IntentTrackingOutcome, { kind: "crashed" }>;

/** Exported for tests, which substitute a virtual clock. */
export async function runIntentTracking(
  report: ReceiptReport,
  { signal, onUpdate, receiptDelivery }: TrackIntentOptions,
  clock: TrackingClock
): Promise<TrackingRunOutcome> {
  if (signal.aborted) return { kind: "aborted" };

  // Ends the loop and every pending sleep however tracking finishes, so no
  // timer or request outlives the returned promise's settlement.
  const stop = new AbortController();
  const onCallerAbort = () => stop.abort();
  signal.addEventListener("abort", onCallerAbort, { once: true });

  let receipt: ReceiptState = receiptDelivery
    ? { kind: "delegated" }
    : { kind: "due", failures: 0, dueAt: clock.now() };
  let intentMissing = false;
  void receiptDelivery?.then((outcome) => {
    if (receipt.kind !== "delegated") return;
    switch (outcome.kind) {
      case "recorded":
        receipt = { kind: "recorded" };
        break;
      case "rejected":
        receipt = outcome;
        break;
      case "intent_not_found":
        intentMissing = true;
        break;
      case "gave_up":
      case "crashed":
        receipt = { kind: "lost" };
        break;
      default:
        assertNever(outcome);
    }
  });

  const loop = async (): Promise<TrackingRunOutcome | null> => {
    let polls = 0;
    while (!stop.signal.aborted) {
      if (intentMissing) return { kind: "intent_not_found" };
      if (receipt.kind === "due" && clock.now() >= receipt.dueAt) {
        const attempt = await attemptReceipt(report);
        if (stop.signal.aborted) return null;
        switch (attempt.kind) {
          case "accepted":
            receipt = { kind: "recorded" };
            break;
          case "rejected":
            receipt = attempt;
            console.error("[Trustware] receipt rejected", {
              intentId: report.intentId,
              txHash: report.txHash,
              httpStatus: attempt.httpStatus,
              message: attempt.message,
            });
            break;
          case "intent_not_found":
            return { kind: "intent_not_found" };
          case "transient": {
            const failures = receipt.failures + 1;
            receipt = {
              kind: "due",
              failures,
              dueAt:
                clock.now() +
                receiptRetryDelayMs(failures, attempt.serverWaitMs),
            };
            console.warn("[Trustware] receipt delivery failed; will retry", {
              intentId: report.intentId,
              txHash: report.txHash,
              failures,
              error: attempt.error,
            });
            break;
          }
          default:
            assertNever(attempt);
        }
      }

      const transaction = await readStatus(report.intentId);
      if (stop.signal.aborted) return null;
      if (transaction === "not_found") return { kind: "intent_not_found" };
      if (transaction !== "unavailable") {
        onUpdate(transaction);
        if (transaction.status === "success") {
          return { kind: "success", transaction };
        }
        if (transaction.status === "failed") {
          return { kind: "failed", transaction };
        }
        if (transaction.status !== "pending") {
          // The backend holds a transaction, whoever reported it.
          receipt = { kind: "recorded" };
        } else if (receipt.kind === "rejected") {
          return {
            kind: "receipt_rejected",
            httpStatus: receipt.httpStatus,
            message: receipt.message,
          };
        }
      }

      polls += 1;
      await clock.sleep(
        polls <= FAST_POLL_COUNT ? FAST_POLL_MS : SLOW_POLL_MS,
        stop.signal
      );
    }
    return null;
  };

  const timedOut = clock
    .sleep(TRACKING_TIMEOUT_MS, stop.signal)
    .then((): TrackingRunOutcome | null =>
      stop.signal.aborted
        ? null
        : { kind: "timed_out", recorded: receipt.kind === "recorded" }
    );

  try {
    // A request with no timeout can hang the loop, which is why the deadline
    // races it instead of being checked between iterations. Each racer
    // resolves null once `stop` fires, so the first non-null result wins.
    const outcome = await Promise.race([loop(), timedOut]);
    return outcome ?? { kind: "aborted" };
  } finally {
    stop.abort();
    signal.removeEventListener("abort", onCallerAbort);
  }
}

async function attemptReceipt(report: ReceiptReport): Promise<ReceiptAttempt> {
  try {
    await submitReceipt(
      report.intentId,
      report.txHash,
      report.sponsorshipRequestId,
      report.eoaAddress
    );
    return { kind: "accepted" };
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 404) return { kind: "intent_not_found" };
      if (error.status >= 500) {
        return { kind: "transient", error, serverWaitMs: 0 };
      }
      // 409 lands here too. It means either the backend already tracks a
      // transaction for this intent, which the next status read shows as
      // non-pending, or this hash is recorded against another intent, which
      // leaves this one pending for good. The status read tells them apart.
      return {
        kind: "rejected",
        httpStatus: error.status,
        message: error.serverMessage,
      };
    }
    if (error instanceof RateLimitError) {
      const retryAfterSeconds = error.rateLimitInfo.retryAfter;
      return {
        kind: "transient",
        error,
        serverWaitMs:
          typeof retryAfterSeconds === "number" ? retryAfterSeconds * 1000 : 0,
      };
    }
    // fetch rejects with a TypeError when the request never got a response.
    if (error instanceof TypeError) {
      return { kind: "transient", error, serverWaitMs: 0 };
    }
    throw error;
  }
}

/**
 * One status read. "unavailable" covers failures a later poll can outlast:
 * non-404 HTTP errors, rate limiting, and network errors.
 */
async function readStatus(
  intentId: string
): Promise<Transaction | "not_found" | "unavailable"> {
  try {
    return await getStatus(intentId);
  } catch (error) {
    if (error instanceof HttpError) {
      return error.status === 404 ? "not_found" : "unavailable";
    }
    if (error instanceof RateLimitError || error instanceof TypeError) {
      return "unavailable";
    }
    throw error;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled receipt attempt: ${JSON.stringify(value)}`);
}
