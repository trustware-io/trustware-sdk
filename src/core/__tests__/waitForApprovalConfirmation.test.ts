import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { waitForApprovalConfirmation } from "src/core/tx";

const HASH =
  "0x1edd338888a548c499c6aa61edc9003edfe1335e8e552c4097b08559fe77087e";
const PLUME = "98866";

/** Replays a fixed sequence of backend statuses, repeating the last one. */
function reader(statuses: string[]) {
  let i = 0;
  const calls = { count: 0 };
  return {
    calls,
    read: async () => {
      calls.count += 1;
      const s = statuses[Math.min(i, statuses.length - 1)];
      i += 1;
      return { status: s };
    },
  };
}

const FAST = { intervalMs: 0, notFoundGraceMs: 0, timeoutMs: 5_000 };

describe("waitForApprovalConfirmation", () => {
  it("resolves once the transaction succeeds", async () => {
    const r = reader(["pending", "pending", "success"]);
    await waitForApprovalConfirmation(PLUME, HASH, {
      ...FAST,
      readStatus: r.read,
    });
    assert.equal(r.calls.count, 3);
  });

  it("throws when the transaction reverted", async () => {
    const r = reader(["reverted"]);
    await assert.rejects(
      () =>
        waitForApprovalConfirmation(PLUME, HASH, {
          ...FAST,
          readStatus: r.read,
        }),
      /Approval transaction reverted/
    );
  });

  // The regression: the approve went out on Base, so on Plume the hash read
  // not_found forever. The old loop treated that as pending and burned the
  // full 120s before a generic timeout.
  it("gives up early and names the chain when the hash is absent", async () => {
    const r = reader(["not_found"]);
    await assert.rejects(
      () =>
        waitForApprovalConfirmation(PLUME, HASH, {
          ...FAST,
          readStatus: r.read,
        }),
      (e: unknown) => {
        const msg = (e as Error).message;
        assert.match(msg, /was not found on chain 98866/);
        assert.match(msg, /different network/);
        return true;
      }
    );
    // Bailed on the first read rather than polling out the timeout.
    assert.equal(r.calls.count, 1);
  });

  // Propagation lag is real: the wallet's RPC and the backend's are different
  // nodes, so a brand-new hash reads not_found for a moment.
  it("tolerates not_found inside the grace window", async () => {
    const r = reader(["not_found", "not_found", "success"]);
    await waitForApprovalConfirmation(PLUME, HASH, {
      intervalMs: 0,
      notFoundGraceMs: 60_000,
      timeoutMs: 5_000,
      readStatus: r.read,
    });
    assert.equal(r.calls.count, 3);
  });

  // Once seen in the mempool, a later disappearance restarts the window rather
  // than inheriting a stale one from before it was found.
  //
  // intervalMs must exceed notFoundGraceMs or this proves nothing: with a zero
  // interval every read lands in the same millisecond, so the elapsed check
  // passes whether or not the window was reset. At 15ms/10ms the third read is
  // ~30ms after the first, so inheriting the stale timestamp would throw.
  it("restarts the grace window after the tx has been seen", async () => {
    const r = reader(["not_found", "pending", "not_found", "success"]);
    await waitForApprovalConfirmation(PLUME, HASH, {
      intervalMs: 15,
      notFoundGraceMs: 10,
      timeoutMs: 5_000,
      readStatus: r.read,
    });
    assert.equal(r.calls.count, 4);
  });

  it("times out when the transaction never leaves pending", async () => {
    const r = reader(["pending"]);
    await assert.rejects(
      () =>
        waitForApprovalConfirmation(PLUME, HASH, {
          intervalMs: 0,
          notFoundGraceMs: 60_000,
          timeoutMs: 25,
          readStatus: r.read,
        }),
      /Timed out waiting for approval confirmation/
    );
  });
});
