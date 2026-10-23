import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import bs58 from "bs58";
import {
  Keypair,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { SDKRPCError, SDK_RPC_CODES } from "src/core/sdkRpc";
import {
  REBROADCAST_INTERVAL_MS,
  broadcastUntilSettled,
  SolanaExpiredBeforeSendError,
  readSignedSolanaTransaction,
  type SignedSolanaTransaction,
  type SolanaBroadcastIO,
  type SolanaTxStatus,
} from "src/wallets/solanaBroadcast";
import { toSolanaWalletInterface } from "src/wallets/solana";
import { TrustwareConfigStore } from "src/config/store";
import type { SolanaProviderLike } from "src/types";

const SIGNED: SignedSolanaTransaction = {
  serialized: "U0lHTkVELXR4",
  signature: "sig-from-bytes",
  blockhash: "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi",
};

type Step =
  | { kind: "send"; skipPreflight: boolean }
  | { kind: "status"; answer: SolanaTxStatus["status"] | "rpc_call_failed" }
  | { kind: "valid"; answer: Validity }
  | { kind: "precheck"; answer: Validity }
  | { kind: "sleep"; ms: number };

/** A validity read: the proxy's answer, or its 503 RPC_CALL_FAILED. */
type Validity = boolean | "rpc_call_failed";

const rpcCallFailed = () =>
  new SDKRPCError("Failed to check Solana blockhash validity", {
    code: SDK_RPC_CODES.RPC_CALL_FAILED,
    status: 503,
    context: { error: "connection reset" },
  });

/**
 * A scripted proxy. `statuses` and `validity` are consumed in order, and
 * every call lands in `log`, so a test reads the exact sequence. Running
 * out of script is a test bug and throws. The first validity read is the
 * check before the first send, answered by `precheck`.
 */
/** A status read: the proxy's answer, or its 503 RPC_CALL_FAILED. */
type StatusRead = SolanaTxStatus | "rpc_call_failed";

const statusRpcCallFailed = () =>
  new SDKRPCError("Failed to read Solana transaction status", {
    code: SDK_RPC_CODES.RPC_CALL_FAILED,
    status: 503,
    context: { error: "dRPC refused the request" },
  });

function scriptedIO(
  statuses: StatusRead[],
  validity: Validity[],
  sendErrors: (unknown | null)[] = [],
  precheck: Validity = true
): { io: SolanaBroadcastIO; log: Step[] } {
  const log: Step[] = [];
  let sends = 0;
  let prechecked = false;
  const io: SolanaBroadcastIO = {
    async send(serialized, skipPreflight) {
      assert.equal(serialized, SIGNED.serialized, "same bytes every send");
      log.push({ kind: "send", skipPreflight });
      const error = sendErrors[sends++] ?? null;
      if (error !== null) throw error;
    },
    async status(signature) {
      assert.equal(signature, SIGNED.signature);
      const answer = statuses.shift();
      if (!answer) throw new Error("script ran out of statuses");
      if (answer === "rpc_call_failed") {
        log.push({ kind: "status", answer });
        throw statusRpcCallFailed();
      }
      log.push({ kind: "status", answer: answer.status });
      return answer;
    },
    async blockhashValid(blockhash) {
      assert.equal(blockhash, SIGNED.blockhash);
      if (!prechecked) {
        prechecked = true;
        log.push({ kind: "precheck", answer: precheck });
        if (precheck === "rpc_call_failed") throw rpcCallFailed();
        return precheck;
      }
      const answer = validity.shift();
      if (answer === undefined) throw new Error("script ran out of validity");
      log.push({ kind: "valid", answer });
      if (answer === "rpc_call_failed") throw rpcCallFailed();
      return answer;
    },
    async sleep(ms) {
      log.push({ kind: "sleep", ms });
    },
  };
  return { io, log };
}

const notFound: SolanaTxStatus = { status: "not_found" };
const pending: SolanaTxStatus = { status: "pending" };
const success: SolanaTxStatus = { status: "success" };
const failed: SolanaTxStatus = {
  status: "failed",
  err: { InstructionError: [2, { Custom: 6001 }] },
};

// The proxy's exact refusals (quicklinks_v1 7b9cc7cf).
const alreadyProcessed = new SDKRPCError(
  "Solana transaction has already been processed",
  {
    code: SDK_RPC_CODES.ALREADY_PROCESSED,
    status: 409,
    context: { signature: "sig-from-bytes" },
  }
);
const broadcastFailed = new SDKRPCError(
  "Failed to broadcast Solana transaction",
  {
    code: SDK_RPC_CODES.BROADCAST_FAILED,
    status: 503,
    context: { error: "node is behind" },
  }
);

const EXPIRED = `Solana transaction ${SIGNED.signature} expired before inclusion: its blockhash ${SIGNED.blockhash} is no longer valid and the network never included it.`;

function kinds(log: Step[]) {
  return log.map((step) =>
    step.kind === "send"
      ? step.skipPreflight
        ? "rebroadcast"
        : "send"
      : step.kind === "status"
        ? `status:${step.answer}`
        : step.kind === "valid"
          ? `valid:${step.answer}`
          : step.kind === "precheck"
            ? `precheck:${step.answer}`
            : "sleep"
  );
}

describe("broadcastUntilSettled", () => {
  it("sends with preflight, then polls and rebroadcasts until confirmed", async () => {
    const { io, log } = scriptedIO(
      [notFound, notFound, pending, success],
      [true, true, true]
    );

    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);

    assert.deepEqual(kinds(log), [
      "precheck:true",
      "send",
      "status:not_found",
      "valid:true",
      "sleep",
      "rebroadcast",
      "status:not_found",
      "valid:true",
      "sleep",
      "rebroadcast",
      "status:pending",
      "valid:true",
      "sleep",
      "rebroadcast",
      "status:success",
    ]);
    assert.equal(
      log.filter((s) => s.kind === "send" && s.skipPreflight).length,
      3,
      "exactly three rebroadcasts"
    );
    assert.ok(
      log
        .filter((s) => s.kind === "sleep")
        .every((s) => s.kind === "sleep" && s.ms === REBROADCAST_INTERVAL_MS)
    );
    assert.equal(REBROADCAST_INTERVAL_MS, 2_000);
  });

  it("returns without rebroadcasting when the first status is a success", async () => {
    const { io, log } = scriptedIO([success], []);
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(kinds(log), ["precheck:true", "send", "status:success"]);
  });

  it("treats an already-processed rebroadcast as a copy that landed", async () => {
    const { io, log } = scriptedIO(
      [notFound, pending, success],
      [true, true],
      [null, alreadyProcessed, alreadyProcessed]
    );
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(kinds(log), [
      "precheck:true",
      "send",
      "status:not_found",
      "valid:true",
      "sleep",
      "rebroadcast",
      "status:pending",
      "valid:true",
      "sleep",
      "rebroadcast",
      "status:success",
    ]);
  });

  it("keeps going after a failed rebroadcast, which only costs one copy", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const { io, log } = scriptedIO(
        [notFound, success],
        [true],
        [null, broadcastFailed]
      );
      assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
      assert.deepEqual(kinds(log), [
        "precheck:true",
        "send",
        "status:not_found",
        "valid:true",
        "sleep",
        "rebroadcast",
        "status:success",
      ]);
    } finally {
      console.warn = originalWarn;
    }
    assert.deepEqual(warnings, [
      `Rebroadcast of Solana transaction ${SIGNED.signature} failed: Failed to broadcast Solana transaction: node is behind`,
    ]);
  });

  it("reports an accepted send as submitted when a rebroadcast is refused with an undocumented code", async (t) => {
    const errorLog = t.mock.method(console, "error", () => {});
    const { io } = scriptedIO(
      [notFound],
      [true],
      [
        null,
        new SDKRPCError("Invalid serialized Solana transaction", {
          code: "SERIALIZATION_ERROR",
          status: 400,
        }),
      ]
    );
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(
      errorLog.mock.calls.map((c) => c.arguments[0]),
      [
        `Rebroadcast of Solana transaction ${SIGNED.signature} failed: Invalid serialized Solana transaction. It was accepted, so it's reported as submitted and still confirming; the backend tracks it from its receipt.`,
      ]
    );
  });

  it("checks validity again next round after a 503 RPC_CALL_FAILED, never calling it expired", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const { io, log } = scriptedIO(
        [notFound, notFound, notFound, success],
        ["rpc_call_failed", "rpc_call_failed", true]
      );
      assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
      assert.deepEqual(kinds(log), [
        "precheck:true",
        "send",
        "status:not_found",
        "valid:rpc_call_failed",
        "sleep",
        "rebroadcast",
        "status:not_found",
        "valid:rpc_call_failed",
        "sleep",
        "rebroadcast",
        "status:not_found",
        "valid:true",
        "sleep",
        "rebroadcast",
        "status:success",
      ]);
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(warnings.length, 2);
    assert.equal(
      warnings[0],
      `Couldn't check the blockhash of Solana transaction ${SIGNED.signature}, checking again next round: Failed to check Solana blockhash validity: connection reset`
    );
  });

  it("fails with the chain's error when the transaction lands with one, without retrying", async () => {
    const { io, log } = scriptedIO([notFound, failed], [true]);
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: `Solana transaction ${SIGNED.signature} failed on chain: {"InstructionError":[2,{"Custom":6001}]}.`,
    });
    assert.deepEqual(kinds(log), [
      "precheck:true",
      "send",
      "status:not_found",
      "valid:true",
      "sleep",
      "rebroadcast",
      "status:failed",
    ]);
  });

  it("checks status once more after the blockhash expires, then fails as expired", async () => {
    const { io, log } = scriptedIO([notFound, notFound], [false]);
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: EXPIRED,
    });
    assert.deepEqual(kinds(log), [
      "precheck:true",
      "send",
      "status:not_found",
      "valid:false",
      "status:not_found",
    ]);
  });

  it("succeeds when the transaction landed in the last moments before expiry", async () => {
    const { io, log } = scriptedIO([notFound, success], [false]);
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(kinds(log), [
      "precheck:true",
      "send",
      "status:not_found",
      "valid:false",
      "status:success",
    ]);
  });

  it("waits out a pending transaction after expiry without sending again", async () => {
    const { io, log } = scriptedIO(
      [pending, pending, pending, success],
      [false]
    );
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(kinds(log), [
      "precheck:true",
      "send",
      "status:pending",
      "valid:false",
      "status:pending",
      "sleep",
      "status:pending",
      "sleep",
      "status:success",
    ]);
  });

  it("fails as expired when a pending transaction drops out after expiry", async () => {
    const { io } = scriptedIO([pending, pending, notFound], [false]);
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: EXPIRED,
    });
  });

  it("fails without polling when the preflighted first send is refused", async () => {
    const refusal = new SDKRPCError("Failed to broadcast Solana transaction", {
      code: "BROADCAST_FAILED",
      status: 503,
      context: {
        error:
          "Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.",
      },
    });
    const { io, log } = scriptedIO([], [], [refusal]);
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: `Solana transaction ${SIGNED.signature} was not sent: Failed to broadcast Solana transaction: Transaction simulation failed: Attempt to debit an account but found no record of a prior credit..`,
    });
    assert.deepEqual(kinds(log), ["precheck:true", "send"]);
  });

  // After acceptance the receipt is already on its way, so no read failure
  // can turn into an error that loses track of the transaction.
  for (const [label, failure, shown] of [
    [
      "an undocumented code",
      new SDKRPCError("Failed to read Solana transaction status"),
      "Failed to read Solana transaction status",
    ],
    ["a fetch TypeError", new TypeError("fetch failed"), "fetch failed"],
  ] as const) {
    it(`reports an accepted send as submitted when a status read fails with ${label}`, async (t) => {
      const errorLog = t.mock.method(console, "error", () => {});
      const io: SolanaBroadcastIO = {
        ...scriptedIO([], []).io,
        status: async () => {
          throw failure;
        },
      };
      assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
      assert.deepEqual(
        errorLog.mock.calls.map((c) => c.arguments[0]),
        [
          `Couldn't confirm Solana transaction ${SIGNED.signature}: ${shown}. It was accepted, so it's reported as submitted and still confirming; the backend tracks it from its receipt.`,
        ]
      );
    });
  }

  it("reports an accepted send as submitted when a validity read fails without a documented code", async (t) => {
    const errorLog = t.mock.method(console, "error", () => {});
    const io: SolanaBroadcastIO = {
      ...scriptedIO([notFound], []).io,
      blockhashValid: (() => {
        let calls = 0;
        return async () => {
          if (calls++ === 0) return true;
          throw new SDKRPCError("HTTP 503: Service Unavailable");
        };
      })(),
    };
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(
      errorLog.mock.calls.map((c) => c.arguments[0]),
      [
        `Couldn't confirm Solana transaction ${SIGNED.signature}: HTTP 503: Service Unavailable. It was accepted, so it's reported as submitted and still confirming; the backend tracks it from its receipt.`,
      ]
    );
  });

  it("checks the blockhash before the first send, and sends nothing when it has expired", async () => {
    const { io, log } = scriptedIO([], [], [], false);
    await assert.rejects(broadcastUntilSettled(SIGNED, io), (err) => {
      assert.ok(err instanceof SolanaExpiredBeforeSendError);
      assert.equal(err.reason, "blockhash_expired_before_send");
      assert.equal(err.signature, SIGNED.signature);
      assert.equal(err.blockhash, SIGNED.blockhash);
      assert.equal(err.message, EXPIRED);
      return true;
    });
    assert.deepEqual(kinds(log), ["precheck:false"]);
  });

  it("reports BLOCKHASH_NOT_FOUND on the first send as expired before sending", async () => {
    const blockhashNotFound = new SDKRPCError(
      "Solana transaction's blockhash is no longer valid; rebuild and sign again",
      {
        code: SDK_RPC_CODES.BLOCKHASH_NOT_FOUND,
        status: 409,
        context: {
          blockhash: SIGNED.blockhash,
          error: "Blockhash not found",
          signature: SIGNED.signature,
        },
      }
    );
    const { io, log } = scriptedIO([], [], [blockhashNotFound]);
    await assert.rejects(broadcastUntilSettled(SIGNED, io), (err) => {
      assert.ok(err instanceof SolanaExpiredBeforeSendError);
      assert.equal(err.reason, "blockhash_not_found_on_send");
      assert.equal(err.message, EXPIRED);
      return true;
    });
    assert.deepEqual(kinds(log), ["precheck:true", "send"]);
  });

  it("sends anyway when the check before sending answers 503 RPC_CALL_FAILED", async () => {
    const { io, log } = scriptedIO([success], [], [], "rpc_call_failed");
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(kinds(log), [
      "precheck:rpc_call_failed",
      "send",
      "status:success",
    ]);
  });

  it("sends nothing when the check before sending fails without a documented code", async () => {
    const io: SolanaBroadcastIO = {
      ...scriptedIO([], []).io,
      blockhashValid: async () => {
        throw new SDKRPCError("HTTP 500: Internal Server Error");
      },
    };
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: `Couldn't check the blockhash of Solana transaction ${SIGNED.signature} before sending it: HTTP 500: Internal Server Error. Nothing was sent.`,
    });
  });

  // The 2026-10-16 incident: the first status read answered 503, and the
  // transaction landed while the SDK reported a failure.
  it("keeps looping through a tx-status 503 RPC_CALL_FAILED", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const { io, log } = scriptedIO(
        ["rpc_call_failed", "rpc_call_failed", success],
        [true, true]
      );
      assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
      assert.deepEqual(kinds(log), [
        "precheck:true",
        "send",
        "status:rpc_call_failed",
        "valid:true",
        "sleep",
        "rebroadcast",
        "status:rpc_call_failed",
        "valid:true",
        "sleep",
        "rebroadcast",
        "status:success",
      ]);
    } finally {
      console.warn = originalWarn;
    }
    assert.deepEqual(warnings, [
      `Couldn't read the status of Solana transaction ${SIGNED.signature}, reading again next round: Failed to read Solana transaction status: dRPC refused the request`,
      `Couldn't read the status of Solana transaction ${SIGNED.signature}, reading again next round: Failed to read Solana transaction status: dRPC refused the request`,
    ]);
  });

  it("returns a sent transaction as submitted when its final status after expiry can't be read", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const { io, log } = scriptedIO([notFound, "rpc_call_failed"], [false]);
      assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
      assert.deepEqual(kinds(log), [
        "precheck:true",
        "send",
        "status:not_found",
        "valid:false",
        "status:rpc_call_failed",
      ]);
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(
      warnings.at(-1),
      `Solana transaction ${SIGNED.signature} was sent, but its final status couldn't be read after its blockhash expired. Reporting it as submitted and still confirming.`
    );
  });

  it("reports an accepted send as submitted when tx-status answers a status it doesn't know", async (t) => {
    const errorLog = t.mock.method(console, "error", () => {});
    const { io } = scriptedIO(
      [{ status: "finalized" as SolanaTxStatus["status"] }],
      []
    );
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(
      errorLog.mock.calls.map((c) => c.arguments[0]),
      [
        `tx-status answered an unknown status "finalized" for ${SIGNED.signature}. It was accepted, so it's reported as submitted and still confirming; the backend tracks it from its receipt.`,
      ]
    );
  });

  it("reports acceptance once, right after the first accepted send and before any status read", async () => {
    const { io, log } = scriptedIO([notFound, success], [true]);
    const accepted: string[] = [];
    const signature = await broadcastUntilSettled(SIGNED, io, (sig) => {
      accepted.push(sig);
      log.push({ kind: "sleep", ms: -1 });
    });
    assert.equal(signature, SIGNED.signature);
    assert.deepEqual(accepted, [SIGNED.signature]);
    // The marker (a sleep of -1) sits right after the first send.
    assert.deepEqual(log.slice(0, 4), [
      { kind: "precheck", answer: true },
      { kind: "send", skipPreflight: false },
      { kind: "sleep", ms: -1 },
      { kind: "status", answer: "not_found" },
    ]);
  });

  it("counts a 409 ALREADY_PROCESSED first send as accepted", async () => {
    const { io } = scriptedIO([success], [], [alreadyProcessed]);
    const accepted: string[] = [];
    await broadcastUntilSettled(SIGNED, io, (sig) => accepted.push(sig));
    assert.deepEqual(accepted, [SIGNED.signature]);
  });

  it("reports acceptance, then the chain's error, for a transaction that lands with one", async () => {
    const { io } = scriptedIO([failed], []);
    const accepted: string[] = [];
    await assert.rejects(
      broadcastUntilSettled(SIGNED, io, (sig) => accepted.push(sig)),
      {
        message: `Solana transaction ${SIGNED.signature} failed on chain: {"InstructionError":[2,{"Custom":6001}]}.`,
      }
    );
    assert.deepEqual(accepted, [SIGNED.signature]);
  });

  for (const [label, script] of [
    [
      "the blockhash expired before sending",
      () => scriptedIO([], [], [], false),
    ],
    [
      "the first send answers BLOCKHASH_NOT_FOUND",
      () =>
        scriptedIO(
          [],
          [],
          [
            new SDKRPCError("expired", {
              code: SDK_RPC_CODES.BLOCKHASH_NOT_FOUND,
              status: 409,
            }),
          ]
        ),
    ],
    ["the first send is refused", () => scriptedIO([], [], [broadcastFailed])],
  ] as const) {
    it(`never reports acceptance when ${label}`, async () => {
      const { io } = script();
      const accepted: string[] = [];
      await assert.rejects(
        broadcastUntilSettled(SIGNED, io, (sig) => accepted.push(sig))
      );
      assert.deepEqual(accepted, []);
    });
  }
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

describe("broadcastUntilSettled, over generated chains", () => {
  // The claims: nothing is sent after the blockhash reads invalid, a final
  // status read always follows that, and the loop stops only on success,
  // failed, or (after expiry) not_found.
  it("never sends after expiry, always rechecks status, and stops only on a settling fact", async (t) => {
    // Every rebroadcast 503 and validity 503 warns; the claims are about
    // the log, not the console.
    t.mock.method(console, "warn", () => {});
    const random = seededRandom(0xb10c_4a54);
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
    const outcomes = { success: 0, failed: 0, expired: 0, submitted: 0 };

    for (let run = 0; run < 3_000; run++) {
      // An unbounded-looking chain: random in-flight reads, then a fact.
      const statuses: StatusRead[] = [];
      const validity: Validity[] = [];
      const sendErrors: (unknown | null)[] = [null];
      const inFlight = Math.floor(random() * 12);
      for (let i = 0; i < inFlight; i++) {
        statuses.push(pick<StatusRead>([notFound, pending, "rpc_call_failed"]));
        validity.push(pick<Validity>([true, true, true, "rpc_call_failed"]));
        sendErrors.push(pick([null, null, alreadyProcessed, broadcastFailed]));
      }
      const ending = pick(["success", "failed", "expire"] as const);
      if (ending === "expire") {
        statuses.push(pick([notFound, pending]));
        validity.push(false);
        const lateReads = Math.floor(random() * 4);
        for (let i = 0; i < lateReads; i++) statuses.push(pending);
        statuses.push(
          pick<StatusRead>([
            notFound,
            notFound,
            success,
            failed,
            "rpc_call_failed",
          ])
        );
      } else {
        statuses.push(ending === "success" ? success : failed);
      }
      const scriptLength = statuses.length + validity.length;

      const { io, log } = scriptedIO(statuses, validity, sendErrors);
      let result: "success" | "failed" | "expired" | "submitted";
      try {
        await broadcastUntilSettled(SIGNED, io);
        result =
          log.at(-1)?.kind === "status" &&
          (log.at(-1) as { answer: string }).answer === "rpc_call_failed"
            ? "submitted"
            : "success";
      } catch (err) {
        const message = (err as Error).message;
        result = message === EXPIRED ? "expired" : "failed";
        if (result === "failed") {
          assert.equal(
            message,
            `Solana transaction ${SIGNED.signature} failed on chain: {"InstructionError":[2,{"Custom":6001}]}.`
          );
        }
      }
      outcomes[result]++;

      // Stops only on a settling fact: the whole script was consumed, and
      // the last read is what decided.
      assert.equal(statuses.length + validity.length, 0, `run ${run}`);
      const reads = log.filter((s) => s.kind !== "send" && s.kind !== "sleep");
      assert.equal(reads.length, scriptLength + 1, `run ${run} (+1 precheck)`);
      const last = log.at(-1);
      assert.ok(last?.kind === "status", `run ${run} ends on a status read`);
      const expected =
        last.answer === "success"
          ? "success"
          : last.answer === "failed"
            ? "failed"
            : last.answer === "rpc_call_failed"
              ? "submitted"
              : "expired";
      assert.equal(result, expected, `run ${run}`);
      // A 503 status read only ends the loop as the final read after
      // expiry, and then as "submitted", never as expired or failed.
      if (last.answer === "rpc_call_failed") {
        const expiryAt = log.findIndex(
          (s) => s.kind === "valid" && s.answer === false
        );
        assert.ok(expiryAt >= 0, `run ${run}: 503 ended a live loop`);
      }

      // Never sends after expiry, and always rechecks status after it.
      const expiry = log.findIndex(
        (s) => s.kind === "valid" && s.answer === false
      );
      if (expiry >= 0) {
        assert.ok(
          log.slice(expiry).every((s) => s.kind !== "send"),
          `run ${run} sent after expiry`
        );
        assert.equal(log[expiry + 1]?.kind, "status", `run ${run}`);
      } else {
        assert.notEqual(result, "expired", `run ${run}`);
      }
      // Exactly one preflighted send, first; every other send skips it.
      assert.deepEqual(log[0], { kind: "precheck", answer: true });
      assert.deepEqual(log[1], { kind: "send", skipPreflight: false });
      assert.ok(
        log.slice(2).every((s) => s.kind !== "send" || s.skipPreflight),
        `run ${run}`
      );
    }

    assert.ok(outcomes.success > 500, `${outcomes.success} successes`);
    assert.ok(outcomes.failed > 500, `${outcomes.failed} failures`);
    assert.ok(outcomes.expired > 300, `${outcomes.expired} expiries`);
    assert.ok(outcomes.submitted > 100, `${outcomes.submitted} submitted`);
  });
});

describe("readSignedSolanaTransaction", () => {
  it("reads the first signature and the blockhash from the signed bytes", async () => {
    const payer = Keypair.generate();
    const blockhash = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 1,
      })
    );
    tx.sign(payer);
    const bytes = tx.serialize();

    const signed = await readSignedSolanaTransaction(bytes, "AAAA");

    assert.equal(signed.signature, bs58.encode(tx.signature as Uint8Array));
    assert.equal(signed.blockhash, blockhash);
    assert.equal(signed.serialized, "AAAA");
  });

  it("refuses bytes the fee payer hasn't signed", async () => {
    const payer = Keypair.generate();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi",
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 1,
      })
    );
    const unsigned = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    await assert.rejects(readSignedSolanaTransaction(unsigned, "AAAA"), {
      message:
        "The Solana wallet returned a transaction without the fee payer's signature.",
    });
  });
});

// The adapter end to end against a stubbed proxy: the wallet signs, the
// SDK sends, and the signature it returns is the one in the bytes, not the
// one the proxy answers with.
describe("toSolanaWalletInterface with signTransaction", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("signs with signTransaction, sends the signed bytes, and returns their signature", async () => {
    const payer = Keypair.generate();
    const blockhash = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";
    const unsigned = new Transaction({
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

    const order: string[] = [];
    let signedBase64 = "";
    let bytesSignature = "";
    const provider: SolanaProviderLike = {
      publicKey: { toString: () => payer.publicKey.toBase58() },
      signTransaction: async (transaction) => {
        order.push("sign");
        const tx = transaction as VersionedTransaction;
        tx.sign([payer]);
        const bytes = tx.serialize();
        signedBase64 = Buffer.from(bytes).toString("base64");
        bytesSignature = bs58.encode(tx.signatures[0]);
        return { serialize: () => bytes };
      },
      signAndSendTransaction: async () => {
        order.push("signAndSend");
        return { signature: "never" };
      },
    };

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const url = String(input);
      const reply = (data: unknown) =>
        new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/v1/sdk/rpc/solana/send-serialized")) {
        const body = JSON.parse(String(init?.body));
        order.push(`send(skipPreflight=${body.skipPreflight})`);
        assert.deepEqual(body, {
          chainId: "solana-mainnet-beta",
          serializedTransaction: signedBase64,
          skipPreflight: false,
        });
        // A proxy's own answer is not what the SDK reports.
        return reply({ chainId: "solana-mainnet-beta", signature: "rpc-said" });
      }
      if (url.includes("/v1/sdk/rpc/solana/blockhash-valid?")) {
        const query = new URL(url).searchParams;
        order.push("precheck");
        assert.deepEqual(Object.fromEntries(query), {
          chainId: "solana-mainnet-beta",
          blockhash,
        });
        return reply({
          chainId: "solana-mainnet-beta",
          blockhash,
          valid: true,
          rpcHost: "rpc",
        });
      }
      if (url.includes("/v1/sdk/rpc/solana/tx-status?")) {
        const query = new URL(url).searchParams;
        order.push("status");
        assert.equal(query.get("signature"), bytesSignature);
        return reply({
          chainId: "solana-mainnet-beta",
          signature: bytesSignature,
          found: true,
          confirmed: true,
          status: "success",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const wallet = toSolanaWalletInterface(provider);
    const signature = await wallet.sendSerializedTransaction(
      Buffer.from(unsigned).toString("base64"),
      "solana-mainnet-beta"
    );

    assert.equal(signature, bytesSignature);
    assert.notEqual(signature, "rpc-said");
    assert.deepEqual(order, [
      "sign",
      "precheck",
      "send(skipPreflight=false)",
      "status",
    ]);
  });
});
