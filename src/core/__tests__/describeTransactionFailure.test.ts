import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { describeTransactionFailure } from "src/core/failure";
import { mapError } from "src/widget/lib/mapError";
import type { Transaction } from "src/types";

const tx = (over: Partial<Transaction> = {}) =>
  ({
    status: "failed",
    fromChainBlock: 0,
    toChainBlock: 0,
    ...over,
  }) as Transaction;

describe("describeTransactionFailure", () => {
  // The payload from the ANSEM -> SOL failure: LiFi explains itself in
  // status_raw.substatusMessage, which nothing in the SDK used to read.
  it("surfaces the provider's own message when it can't classify it", () => {
    const message = describeTransactionFailure(
      tx({
        statusRaw: {
          status: "FAILED",
          substatus: "UNKNOWN_FAILED_ERROR",
          substatusMessage: "Instruction #5 failed on chain",
        },
      })
    );
    assert.match(message, /Instruction #5 failed on chain/);
  });

  it("classifies slippage from the substatus code alone", () => {
    assert.match(
      describeTransactionFailure(
        tx({ statusRaw: { substatus: "SLIPPAGE_EXCEEDED" } })
      ),
      /price movement/i
    );
  });

  it("classifies from the message when there is no code", () => {
    assert.match(
      describeTransactionFailure(
        tx({ statusRaw: { reason: "insufficient liquidity in pool" } })
      ),
      /liquidity/i
    );
    assert.match(
      describeTransactionFailure(
        tx({ statusRaw: { error: "quote expired before execution" } })
      ),
      /expired/i
    );
    assert.match(
      describeTransactionFailure(
        tx({ statusRaw: { substatus: "OUT_OF_GAS" } })
      ),
      /gas/i
    );
  });

  it("still honours gasStatus when status_raw says nothing", () => {
    assert.match(
      describeTransactionFailure(tx({ gasStatus: "insufficient" })),
      /gas/i
    );
  });

  it("falls back to the generic line with no detail at all", () => {
    assert.equal(
      describeTransactionFailure(tx()),
      "Transaction failed on-chain. Please try again."
    );
    assert.equal(
      describeTransactionFailure(tx({ statusRaw: "FAILED" })),
      "Transaction failed on-chain. Please try again."
    );
  });

  it("caps a runaway provider message instead of letting it wreck the card", () => {
    const message = describeTransactionFailure(
      tx({ statusRaw: { substatusMessage: "x".repeat(500) } })
    );
    assert.ok(message.length < 210, `too long: ${message.length}`);
    assert.match(message, /…$/);
  });

  it("collapses newlines so the error card stays one line", () => {
    assert.match(
      describeTransactionFailure(
        tx({ statusRaw: { substatusMessage: "line one\n\nline two" } })
      ),
      /line one line two/
    );
  });
});

describe("mapError + describeTransactionFailure", () => {
  // The reason has to survive the trip through the Error page's mapper, which
  // used to replace anything matching /transaction failed/ with boilerplate.
  it("keeps a specific reason instead of overwriting it", () => {
    const reason = describeTransactionFailure(
      tx({
        statusRaw: {
          substatus: "UNKNOWN_FAILED_ERROR",
          substatusMessage: "Instruction #5 failed on chain",
        },
      })
    );
    const mapped = mapError(reason);
    assert.equal(mapped.category, "transaction_failed");
    assert.match(mapped.message, /Instruction #5 failed on chain/);
  });

  it("still generalises a bare phrase", () => {
    assert.equal(
      mapError("Transaction failed").message,
      "The transaction could not be completed. Please try again."
    );
  });

  // "execution reverted" is claimed by an earlier branch; this is a dump that
  // reaches the transaction-failed branch and must still be generalised.
  it("still generalises a raw multi-line failure dump", () => {
    const dump = `Transaction failed\n\nRequest Arguments:\n  from: 0x…\n  to: 0x…`;
    assert.equal(
      mapError(dump).message,
      "The transaction could not be completed. Please try again."
    );
  });

  it("leaves an unrelated mapping alone", () => {
    assert.equal(
      mapError("execution reverted").title,
      "Transaction Would Fail"
    );
  });
});
