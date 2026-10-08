import { describeTransactionFailure } from "src/core/failure";
import type { IntentTrackingOutcome } from "src/core/intentTracking";
import type { MappedError } from "./mapError";

// The transaction behind both of these is on-chain. "Try again" would send it
// a second time, so the copy sends the user to the explorer first.

export const TRACKING_RECEIPT_REJECTED: MappedError = {
  category: "timeout",
  title: "Transaction Not Tracked",
  message:
    "Your transaction was sent, but Trustware couldn't record it, so its progress can't be shown here. Check its status in your block explorer before trying again.",
};

export const TRACKING_NOT_CONFIRMED: MappedError = {
  category: "timeout",
  title: "Transaction Not Confirmed",
  message:
    "Your transaction was sent, but Trustware couldn't confirm it. Check its status in your block explorer before trying again.",
};

const STILL_RUNNING =
  "Transaction is taking longer than expected. Please check your block explorer.";
const INTENT_NOT_FOUND = "Transaction session expired. Please try again.";

/** Tracking outcomes that end on the error screen. */
export type TrackingFailure = Exclude<
  IntentTrackingOutcome,
  { kind: "success" } | { kind: "aborted" }
>;

/**
 * The error-screen message for a tracking outcome. Stored as the widget's
 * error string; mapError recognizes the two TRACKING_* messages exactly.
 */
export function describeTrackingFailure(outcome: TrackingFailure): string {
  switch (outcome.kind) {
    case "failed":
      return describeTransactionFailure(outcome.transaction);
    case "intent_not_found":
      return INTENT_NOT_FOUND;
    case "receipt_rejected":
      return TRACKING_RECEIPT_REJECTED.message;
    case "timed_out":
      return outcome.recorded ? STILL_RUNNING : TRACKING_NOT_CONFIRMED.message;
    default: {
      const unhandled: never = outcome;
      throw new Error(
        `Unhandled tracking outcome: ${JSON.stringify(unhandled)}`
      );
    }
  }
}
