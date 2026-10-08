import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  describeTrackingFailure,
  TRACKING_NOT_CONFIRMED,
  TRACKING_RECEIPT_REJECTED,
  type TrackingFailure,
} from "../trackingFailure";
import { mapError } from "../mapError";
import { describeTransactionFailure } from "src/core/failure";
import type { Transaction } from "src/types";

const failedTx = {
  intentId: "intent-1",
  status: "failed",
  statusRaw: "OrderRefunded",
} as unknown as Transaction;

describe("describeTrackingFailure", () => {
  it("tells the user a rejected receipt left the transaction untracked", () => {
    assert.equal(
      describeTrackingFailure({
        kind: "receipt_rejected",
        httpStatus: 400,
        message: "payer address mismatch",
      }),
      "Your transaction was sent, but Trustware couldn't record it, so its progress can't be shown here. Check its status in your block explorer before trying again."
    );
  });

  it("tells the user an unrecorded timeout was never confirmed", () => {
    assert.equal(
      describeTrackingFailure({ kind: "timed_out", recorded: false }),
      "Your transaction was sent, but Trustware couldn't confirm it. Check its status in your block explorer before trying again."
    );
  });

  it("keeps the still-running message for a recorded timeout", () => {
    assert.equal(
      describeTrackingFailure({ kind: "timed_out", recorded: true }),
      "Transaction is taking longer than expected. Please check your block explorer."
    );
  });

  it("keeps the session-expired message for an unknown intent", () => {
    assert.equal(
      describeTrackingFailure({ kind: "intent_not_found" }),
      "Transaction session expired. Please try again."
    );
  });

  it("describes a failed transaction the way the failure module does", () => {
    assert.equal(
      describeTrackingFailure({ kind: "failed", transaction: failedTx }),
      describeTransactionFailure(failedTx)
    );
  });
});

// The widget stores these as strings and maps them again on the error
// screen. Unknown prose maps to "An unexpected error occurred. Please try
// again." — the one thing a user whose funds already moved must not read.
describe("mapError on tracking failures", () => {
  it("returns the authored error for a rejected receipt", () => {
    const outcome: TrackingFailure = {
      kind: "receipt_rejected",
      httpStatus: 409,
      message: "transaction hash already used",
    };
    assert.deepEqual(
      mapError(describeTrackingFailure(outcome)),
      TRACKING_RECEIPT_REJECTED
    );
  });

  it("returns the authored error for an unrecorded timeout", () => {
    assert.deepEqual(
      mapError(describeTrackingFailure({ kind: "timed_out", recorded: false })),
      TRACKING_NOT_CONFIRMED
    );
  });

  it("classifies a recorded timeout as a timeout", () => {
    assert.equal(
      mapError(describeTrackingFailure({ kind: "timed_out", recorded: true }))
        .category,
      "timeout"
    );
  });
});
