/* core/intentTracking.ts */
import { getStatus } from "./routes";
import { HttpError, RateLimitError } from "./http";
import {
  commitReceipt,
  RECEIPT_CODE_ROUTE_INTENT_NOT_FOUND,
  ReceiptCommitError,
  receiptLogFields,
  type ReceiptReport,
} from "./receipt";
import type { Transaction } from "../types";

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
   * Nothing was committed for the intent within 24 hours of its expiry.
   * Terminal. A transaction sent for it may still be on-chain.
   */
  | { kind: "expired"; transaction: Transaction }
  /**
   * The backend refused the receipt with a final code and holds no
   * transaction for the intent, so nothing will ever move its status past
   * "pending". The transaction is still on-chain; only Trustware's view of
   * it is missing.
   */
  | ({ kind: "receipt_rejected" } & ReceiptRefusal)
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
   * The receipt's delivery, started when the send was accepted
   * (`deliverReceipt`). Tracking only polls, and reads this for how
   * delivery ended.
   */
  receiptDelivery: Promise<ReceiptDeliveryOutcome>;
};

/**
 * A final refusal of a commit. `code` is the backend's refusal code; it is
 * null only for a refusal from the API-key middleware in front of the
 * commit handler (401, 403), which carries none.
 */
export type ReceiptRefusal = {
  httpStatus: number;
  code: string | null;
  message: string;
};

/** How `deliverReceipt` ended. */
export type ReceiptDeliveryOutcome =
  | { kind: "recorded" }
  | ({ kind: "rejected" } & ReceiptRefusal)
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
 * failures with backoff until TRACKING_TIMEOUT_MS. Transient means a
 * network failure, a 5xx, a rate limit, or a refusal whose code is one of
 * `RETRYABLE_RECEIPT_CODES`; any other refusal code is final.
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
      ...receiptLogFields(report),
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
            code: result.code,
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
            ...receiptLogFields(report),
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
 * Polls the intent's status until it is terminal, the backend proves it
 * will never track the transaction, or TRACKING_TIMEOUT_MS passes.
 *
 * The receipt is delivered by `deliverReceipt`, started when the send was
 * accepted; tracking reads how that ended. The backend creates the
 * transaction it tracks only when a receipt arrives, so an intent whose
 * receipt was refused reads "pending" forever, and tracking stops there.
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
      ...receiptLogFields(report),
      error,
    });
    return options.signal.aborted
      ? { kind: "aborted" }
      : { kind: "crashed", error };
  }
}

type ReceiptState =
  /** `deliverReceipt` hasn't finished. */
  | { kind: "delivering" }
  /** `deliverReceipt` gave up or crashed: nothing will deliver it now. */
  | { kind: "lost" }
  | { kind: "recorded" }
  | ({ kind: "rejected" } & ReceiptRefusal);

type ReceiptAttempt =
  | { kind: "accepted" }
  | ({ kind: "rejected" } & ReceiptRefusal)
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

  let receipt: ReceiptState = { kind: "delivering" };
  let intentMissing = false;
  void receiptDelivery.then((outcome) => {
    if (receipt.kind !== "delivering") return;
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

      const transaction = await readStatus(report.intentId);
      if (stop.signal.aborted) return null;
      if (transaction === "not_found") return { kind: "intent_not_found" };
      if (transaction !== "unavailable") {
        onUpdate(transaction);
        switch (transaction.status) {
          case "success":
            return { kind: "success", transaction };
          case "failed":
            return { kind: "failed", transaction };
          case "expired":
            return { kind: "expired", transaction };
          case "submitted":
          case "bridging":
            // The backend holds a transaction, whoever reported it.
            receipt = { kind: "recorded" };
            break;
          case "pending":
            if (receipt.kind === "rejected") {
              return {
                kind: "receipt_rejected",
                httpStatus: receipt.httpStatus,
                code: receipt.code,
                message: receipt.message,
              };
            }
            break;
          default:
            // A status newer than this SDK. The contract says it means
            // "not finished", so it keeps polling and says nothing about
            // the receipt.
            break;
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

/**
 * One commit, classified by its refusal `code`, never by its message: a
 * retryable code, a 5xx, a rate limit or a network failure is transient,
 * and every other code is final.
 */
async function attemptReceipt(report: ReceiptReport): Promise<ReceiptAttempt> {
  try {
    await commitReceipt(report);
    return { kind: "accepted" };
  } catch (error) {
    if (error instanceof HttpError && error.status >= 500) {
      return { kind: "transient", error, serverWaitMs: 0 };
    }
    if (error instanceof ReceiptCommitError) {
      if (error.retryable) return { kind: "transient", error, serverWaitMs: 0 };
      if (error.code === RECEIPT_CODE_ROUTE_INTENT_NOT_FOUND) {
        return { kind: "intent_not_found" };
      }
      return {
        kind: "rejected",
        httpStatus: error.status,
        code: error.code,
        message: error.serverMessage,
      };
    }
    if (error instanceof HttpError) {
      // The API-key middleware answers before the commit handler, without a
      // code. Either refusal is final.
      if (error.status === 401 || error.status === 403) {
        return {
          kind: "rejected",
          httpStatus: error.status,
          code: null,
          message: error.serverMessage,
        };
      }
      throw new Error(
        `The receipt for intent ${report.intentId} was refused with HTTP ` +
          `${error.status} and no code ("${error.serverMessage}"); every ` +
          `commit refusal must carry one.`
      );
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
