import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  commitAcceptedUserOperation,
  USER_OP_INCLUSION_WAIT_MS,
  type InclusionClock,
} from "src/smart-account/send";
import type { UserOpReceiptReport } from "src/core/receipt";
import { TrustwareConfigStore } from "src/config/store";

const INTENT = "intent-sponsored";
const USER_OP_HASH = `0x${"5".repeat(64)}`;
const BUNDLE_TX = `0x${"6".repeat(64)}`;
const RECEIPT: UserOpReceiptReport = {
  intentId: INTENT,
  userOpHash: USER_OP_HASH,
  sponsorshipRequestId: "8d1f1f39-2a9c-4f0e-9d55-7d6b1c0e2f11",
  eoaAddress: "0xb7e4cac65d6b9e66341b78fa94134c3b5869b1a6",
};

/** Virtual time: a sleep advances it at once. */
function steppingClock(): InclusionClock & { at: () => number } {
  let now = 0;
  return {
    now: () => now,
    at: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
}

const realFetch = globalThis.fetch;
const realDebug = console.debug;

describe("commitAcceptedUserOperation", () => {
  let order: string[];
  let bodies: unknown[];

  function serveReceipt(response: () => Response) {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      assert.equal(
        url,
        `https://api.trustware.io/api/v1/route-intent/${INTENT}/receipt`
      );
      order.push("commit");
      bodies.push(JSON.parse(String(init.body)));
      assert.equal(
        (init.headers as Record<string, string>)["Idempotency-Key"],
        USER_OP_HASH
      );
      return response();
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
    order = [];
    bodies = [];
    console.debug = () => {};
    serveReceipt(
      () =>
        new Response(
          JSON.stringify({ data: { ok: true, transaction_id: "tx-1" } }),
          { status: 200 }
        )
    );
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    console.debug = realDebug;
  });

  it("commits the userOp hash before polling for inclusion, then returns the bundle tx", async () => {
    const clock = steppingClock();
    const polls: number[] = [];
    const result = await commitAcceptedUserOperation(
      RECEIPT,
      async (method, params) => {
        assert.equal(method, "eth_getUserOperationReceipt");
        assert.deepEqual(params, [USER_OP_HASH]);
        order.push("poll");
        polls.push(clock.at());
        return polls.length < 2
          ? null
          : { receipt: { transactionHash: BUNDLE_TX } };
      },
      clock
    );

    assert.equal(result.txHash, BUNDLE_TX);
    assert.deepEqual(order, ["commit", "poll", "poll"]);
    assert.deepEqual(polls, [0, 3000]);
    assert.deepEqual(bodies, [
      {
        userOpHash: USER_OP_HASH,
        sponsorshipRequestId: RECEIPT.sponsorshipRequestId,
        eoaAddress: RECEIPT.eoaAddress,
      },
    ]);
    assert.deepEqual(await result.receiptDelivery, { kind: "recorded" });
  });

  it("returns without a bundle tx, and without throwing, when inclusion isn't seen in the wait", async () => {
    const clock = steppingClock();
    const polls: number[] = [];
    const result = await commitAcceptedUserOperation(
      RECEIPT,
      async () => {
        polls.push(clock.at());
        return null;
      },
      clock
    );

    assert.equal(result.txHash, undefined);
    assert.equal(clock.at(), USER_OP_INCLUSION_WAIT_MS);
    assert.deepEqual(
      polls,
      Array.from({ length: 15 }, (_, i) => i * 3000)
    );
    // The userOp was committed regardless.
    assert.deepEqual(await result.receiptDelivery, { kind: "recorded" });
    assert.deepEqual(order, ["commit"]);
  });

  it("keeps polling through bundler failures", async () => {
    const clock = steppingClock();
    let calls = 0;
    const result = await commitAcceptedUserOperation(
      RECEIPT,
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("bundler hiccup");
        return { receipt: { transactionHash: BUNDLE_TX } };
      },
      clock
    );
    assert.equal(result.txHash, BUNDLE_TX);
    assert.equal(calls, 3);
  });

  it("never throws for a refused commit: the delivery reports it", async () => {
    const realError = console.error;
    console.error = () => {};
    try {
      serveReceipt(
        () =>
          new Response(
            JSON.stringify({
              error: "userOpHash requires sponsorshipRequestId",
              code: "user_op_hash_requires_sponsorship",
            }),
            { status: 400 }
          )
      );
      const result = await commitAcceptedUserOperation(
        RECEIPT,
        async () => ({ receipt: { transactionHash: BUNDLE_TX } }),
        steppingClock()
      );
      assert.equal(result.txHash, BUNDLE_TX);
      assert.deepEqual(await result.receiptDelivery, {
        kind: "rejected",
        httpStatus: 400,
        code: "user_op_hash_requires_sponsorship",
        message: "userOpHash requires sponsorshipRequestId",
      });
    } finally {
      console.error = realError;
    }
  });
});
