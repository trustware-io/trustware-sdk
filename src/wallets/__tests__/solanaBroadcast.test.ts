import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import bs58 from "bs58";
import {
  Keypair,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { SDKRPCError, SOLANA_ALREADY_PROCESSED_CODE } from "src/core/sdkRpc";
import {
  REBROADCAST_INTERVAL_MS,
  broadcastUntilSettled,
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
  | { kind: "status"; answer: SolanaTxStatus["status"] }
  | { kind: "valid"; answer: boolean }
  | { kind: "sleep"; ms: number };

/**
 * A scripted proxy. `statuses` and `validity` are consumed in order, and
 * every call lands in `log`, so a test reads the exact sequence. Running
 * out of script is a test bug and throws.
 */
function scriptedIO(
  statuses: SolanaTxStatus[],
  validity: boolean[],
  sendErrors: (unknown | null)[] = []
): { io: SolanaBroadcastIO; log: Step[] } {
  const log: Step[] = [];
  let sends = 0;
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
      log.push({ kind: "status", answer: answer.status });
      return answer;
    },
    async blockhashValid(blockhash) {
      assert.equal(blockhash, SIGNED.blockhash);
      const answer = validity.shift();
      if (answer === undefined) throw new Error("script ran out of validity");
      log.push({ kind: "valid", answer });
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

const alreadyProcessed = new SDKRPCError("Transaction already processed", {
  code: SOLANA_ALREADY_PROCESSED_CODE,
  status: 409,
});

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
    assert.deepEqual(kinds(log), ["send", "status:success"]);
  });

  it("treats an already-processed rebroadcast as a copy that landed", async () => {
    const { io, log } = scriptedIO(
      [notFound, pending, success],
      [true, true],
      [null, alreadyProcessed, alreadyProcessed]
    );
    assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
    assert.deepEqual(kinds(log), [
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
        [null, new SDKRPCError("Failed to broadcast Solana transaction")]
      );
      assert.equal(await broadcastUntilSettled(SIGNED, io), SIGNED.signature);
      assert.deepEqual(kinds(log), [
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
      `Rebroadcast of Solana transaction ${SIGNED.signature} failed: Failed to broadcast Solana transaction`,
    ]);
  });

  it("fails with the chain's error when the transaction lands with one, without retrying", async () => {
    const { io, log } = scriptedIO([notFound, failed], [true]);
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: `Solana transaction ${SIGNED.signature} failed on chain: {"InstructionError":[2,{"Custom":6001}]}.`,
    });
    assert.deepEqual(kinds(log), [
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
    assert.deepEqual(kinds(log), ["send"]);
  });

  it("fails naming the signature when a status read fails, since it may still land", async () => {
    const io: SolanaBroadcastIO = {
      ...scriptedIO([], []).io,
      status: async () => {
        throw new SDKRPCError("Failed to read Solana transaction status");
      },
    };
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: `Couldn't confirm Solana transaction ${SIGNED.signature}: Failed to read Solana transaction status. It may still land, so check a block explorer before trying again.`,
    });
  });

  it("fails naming the signature when a validity read fails", async () => {
    const io: SolanaBroadcastIO = {
      ...scriptedIO([notFound], []).io,
      blockhashValid: async () => {
        throw new SDKRPCError("HTTP 503: Service Unavailable");
      },
    };
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: `Couldn't confirm Solana transaction ${SIGNED.signature}: HTTP 503: Service Unavailable. It may still land, so check a block explorer before trying again.`,
    });
  });

  it("refuses a status it doesn't know", async () => {
    const { io } = scriptedIO(
      [{ status: "finalized" as SolanaTxStatus["status"] }],
      []
    );
    await assert.rejects(broadcastUntilSettled(SIGNED, io), {
      message: `tx-status answered an unknown status "finalized" for ${SIGNED.signature}.`,
    });
  });
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
  it("never sends after expiry, always rechecks status, and stops only on a settling fact", async () => {
    const random = seededRandom(0xb10c_4a54);
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
    const outcomes = { success: 0, failed: 0, expired: 0 };

    for (let run = 0; run < 3_000; run++) {
      // An unbounded-looking chain: random in-flight reads, then a fact.
      const statuses: SolanaTxStatus[] = [];
      const validity: boolean[] = [];
      const sendErrors: (unknown | null)[] = [null];
      const inFlight = Math.floor(random() * 12);
      for (let i = 0; i < inFlight; i++) {
        statuses.push(pick([notFound, pending]));
        validity.push(true);
        sendErrors.push(pick([null, null, alreadyProcessed]));
      }
      const ending = pick(["success", "failed", "expire"] as const);
      if (ending === "expire") {
        statuses.push(pick([notFound, pending]));
        validity.push(false);
        const lateReads = Math.floor(random() * 4);
        for (let i = 0; i < lateReads; i++) statuses.push(pending);
        statuses.push(pick([notFound, notFound, success, failed]));
      } else {
        statuses.push(ending === "success" ? success : failed);
      }
      const scriptLength = statuses.length + validity.length;

      const { io, log } = scriptedIO(statuses, validity, sendErrors);
      let result: "success" | "failed" | "expired";
      try {
        await broadcastUntilSettled(SIGNED, io);
        result = "success";
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
      assert.equal(reads.length, scriptLength, `run ${run}`);
      const last = log.at(-1);
      assert.ok(last?.kind === "status", `run ${run} ends on a status read`);
      const expected =
        last.answer === "success"
          ? "success"
          : last.answer === "failed"
            ? "failed"
            : "expired";
      assert.equal(result, expected, `run ${run}`);

      // Never sends after expiry, and always rechecks status after it.
      const expiry = log.findIndex((s) => s.kind === "valid" && !s.answer);
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
      assert.deepEqual(log[0], { kind: "send", skipPreflight: false });
      assert.ok(
        log.slice(1).every((s) => s.kind !== "send" || s.skipPreflight),
        `run ${run}`
      );
    }

    assert.ok(outcomes.success > 500, `${outcomes.success} successes`);
    assert.ok(outcomes.failed > 500, `${outcomes.failed} failures`);
    assert.ok(outcomes.expired > 300, `${outcomes.expired} expiries`);
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
    assert.deepEqual(order, ["sign", "send(skipPreflight=false)", "status"]);
  });
});
