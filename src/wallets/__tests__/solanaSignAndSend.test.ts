import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { toSolanaWalletInterface } from "src/wallets/solana";
import type { SolanaProviderLike } from "src/types";

/** A real serialized transaction, so the adapter's decode step runs. */
function serializedTransaction(): string {
  const payer = Keypair.generate().publicKey;
  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: "11111111111111111111111111111111",
  }).add(
    SystemProgram.transfer({ fromPubkey: payer, toPubkey: payer, lamports: 1 })
  );
  return Buffer.from(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  ).toString("base64");
}

type Calls = { signAndSend: number; sign: number };

function provider(
  calls: Calls,
  signAndSendResult: () => Promise<unknown>
): SolanaProviderLike {
  return {
    publicKey: {
      toString: () => "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    },
    signAndSendTransaction: (async () => {
      calls.signAndSend += 1;
      return signAndSendResult();
    }) as SolanaProviderLike["signAndSendTransaction"],
    signTransaction: async () => {
      calls.sign += 1;
      return { serialize: () => new Uint8Array() };
    },
  };
}

describe("sendSerializedTransaction via signAndSendTransaction", () => {
  it("returns the signature from an object result", async () => {
    const calls = { signAndSend: 0, sign: 0 };
    const wallet = toSolanaWalletInterface(
      provider(calls, async () => ({ signature: "sig-object" }))
    );
    assert.equal(
      await wallet.sendSerializedTransaction(serializedTransaction()),
      "sig-object"
    );
    assert.deepEqual(calls, { signAndSend: 1, sign: 0 });
  });

  it("returns a bare string signature", async () => {
    const calls = { signAndSend: 0, sign: 0 };
    const wallet = toSolanaWalletInterface(
      provider(calls, async () => "sig-string")
    );
    assert.equal(
      await wallet.sendSerializedTransaction(serializedTransaction()),
      "sig-string"
    );
    assert.deepEqual(calls, { signAndSend: 1, sign: 0 });
  });

  // A resolved signAndSend may already have broadcast. Asking the user to
  // sign again through signTransaction can send the same payment twice.
  for (const [label, result, shown] of [
    ["an object without a signature", {}, "{}"],
    ["an empty signature", { signature: "" }, '{"signature":""}'],
    ["an empty string", "", '""'],
    ["undefined", undefined, "undefined"],
    ["null", null, "null"],
  ] as const) {
    it(`fails loudly on ${label}, without a second signature prompt`, async () => {
      const calls = { signAndSend: 0, sign: 0 };
      const wallet = toSolanaWalletInterface(
        provider(calls, async () => result)
      );
      await assert.rejects(
        wallet.sendSerializedTransaction(serializedTransaction()),
        {
          message:
            `The Solana wallet's signAndSendTransaction returned no signature (got ${shown}). ` +
            "It may still have sent the transaction, so it was not signed again. " +
            "Check the wallet's activity before trying again.",
        }
      );
      assert.deepEqual(calls, { signAndSend: 1, sign: 0 });
    });
  }

  it("still retries the wallet's transient -32603 and then returns the signature", async () => {
    const calls = { signAndSend: 0, sign: 0 };
    const wallet = toSolanaWalletInterface(
      provider(calls, async () => {
        if (calls.signAndSend === 1) {
          throw Object.assign(new Error("Internal error"), { code: -32603 });
        }
        return { signature: "sig-after-retry" };
      })
    );
    assert.equal(
      await wallet.sendSerializedTransaction(serializedTransaction()),
      "sig-after-retry"
    );
    assert.deepEqual(calls, { signAndSend: 2, sign: 0 });
  });

  it("surfaces a user rejection immediately", async () => {
    const calls = { signAndSend: 0, sign: 0 };
    const rejection = Object.assign(new Error("User rejected the request."), {
      code: 4001,
    });
    const wallet = toSolanaWalletInterface(
      provider(calls, async () => {
        throw rejection;
      })
    );
    await assert.rejects(
      wallet.sendSerializedTransaction(serializedTransaction()),
      (err) => err === rejection
    );
    assert.deepEqual(calls, { signAndSend: 1, sign: 0 });
  });
});
