import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import bs58 from "bs58";
import {
  Keypair,
  SystemProgram,
  Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { Trustware } from "src/core";
import { TrustwareConfigStore } from "src/config/store";
import { toSolanaWalletInterface } from "src/wallets/solana";
import type { SolanaProviderLike } from "src/types";
import {
  REVIEWED_ESTIMATE,
  SOLANA,
  SOLANA_REQUEST,
  stubBackend,
  type Event,
} from "./routeBackendStub";

const payer = Keypair.generate();

/** A real unsigned transaction with its own blockhash, base64. */
function unsignedTransaction(blockhash: string): string {
  const bytes = new Transaction({
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
  return Buffer.from(bytes).toString("base64");
}

const REVIEWED_BLOCKHASH = Keypair.generate().publicKey.toBase58();
const REBUILT_BLOCKHASH = Keypair.generate().publicKey.toBase58();

/** The proxy's exact envelopes (quicklinks_v1 7b9cc7cf). */
function envelope(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const ok = (data: unknown) => envelope(200, { success: true, data });
const fail = (
  status: number,
  code: string,
  message: string,
  context: Record<string, unknown>
) => envelope(status, { success: false, error: { code, message, context } });

// A host's whole Solana send, through the public API and the real wallet
// adapter, against the proxy's documented bodies: the wallet signs the
// rebuilt route, the SDK sends and rebroadcasts it through every refusal
// the proxy documents, and the one receipt names the bytes' signature.
describe("Solana send, end to end against the proxy contract", () => {
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    console.warn = () => {};
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  });

  it("signs the rebuilt route, rebroadcasts until confirmed, and posts one receipt with the signed bytes' signature", async () => {
    const events: Event[] = [];
    const routes = stubBackend(events, [
      {
        status: 200,
        intentId: "intent-reviewed",
        estimate: REVIEWED_ESTIMATE,
        tx: { solana: unsignedTransaction(REVIEWED_BLOCKHASH) },
      },
      {
        status: 200,
        intentId: "intent-rebuilt",
        estimate: REVIEWED_ESTIMATE,
        tx: { solana: unsignedTransaction(REBUILT_BLOCKHASH) },
      },
    ]);

    let signedBase64 = "";
    let bytesSignature = "";
    const order: string[] = [];
    const provider: SolanaProviderLike = {
      publicKey: { toString: () => payer.publicKey.toBase58() },
      signTransaction: async (transaction) => {
        const tx = transaction as VersionedTransaction;
        order.push(`sign:${tx.message.recentBlockhash}`);
        tx.sign([payer]);
        const bytes = tx.serialize();
        signedBase64 = Buffer.from(bytes).toString("base64");
        bytesSignature = bs58.encode(tx.signatures[0]);
        return { serialize: () => bytes };
      },
      signAndSendTransaction: async () => {
        throw new Error("signAndSendTransaction must not be used");
      },
    };

    // One scripted answer per proxy call, in order.
    const sends = [
      () => ok({ chainId: SOLANA, signature: "rpc-said", rpcHost: "rpc" }),
      () =>
        fail(
          409,
          "ALREADY_PROCESSED",
          "Solana transaction has already been processed",
          { signature: bytesSignature }
        ),
      () =>
        fail(
          503,
          "BROADCAST_FAILED",
          "Failed to broadcast Solana transaction",
          {
            error: "node is behind",
          }
        ),
    ];
    const statuses = ["not_found", "pending", "success"];
    const validity = [
      () =>
        fail(
          503,
          "RPC_CALL_FAILED",
          "Failed to check Solana blockhash validity",
          { error: "connection reset" }
        ),
      () =>
        ok({
          chainId: SOLANA,
          blockhash: REBUILT_BLOCKHASH,
          valid: true,
          rpcHost: "rpc",
        }),
    ];
    const receipts: { body: unknown; idempotencyKey: string | null }[] = [];

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const url = String(input);
      if (url.endsWith("/v1/sdk/rpc/solana/send-serialized")) {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.chainId, SOLANA);
        assert.equal(body.serializedTransaction, signedBase64);
        order.push(`send(skipPreflight=${body.skipPreflight})`);
        const next = sends.shift();
        assert.ok(next, "unexpected extra send");
        return next();
      }
      if (url.includes("/v1/sdk/rpc/solana/tx-status?")) {
        const query = new URL(url).searchParams;
        assert.equal(query.get("chainId"), SOLANA);
        assert.equal(query.get("signature"), bytesSignature);
        const status = statuses.shift();
        assert.ok(status, "unexpected extra status read");
        order.push(`status:${status}`);
        return ok({
          chainId: SOLANA,
          signature: bytesSignature,
          found: status !== "not_found",
          confirmed: status === "success",
          status,
        });
      }
      if (url.includes("/v1/sdk/rpc/solana/blockhash-valid?")) {
        const query = new URL(url).searchParams;
        assert.deepEqual(Object.fromEntries(query), {
          chainId: SOLANA,
          blockhash: REBUILT_BLOCKHASH,
        });
        const next = validity.shift();
        assert.ok(next, "unexpected extra validity read");
        const response = next();
        order.push(`valid:${response.status}`);
        return response;
      }
      if (url.endsWith("/v1/route-intent/intent-rebuilt/receipt")) {
        receipts.push({
          body: JSON.parse(String(init?.body)),
          idempotencyKey: new Headers(init?.headers).get("Idempotency-Key"),
        });
        return ok({ intentId: "intent-rebuilt" });
      }
      return routes(input, init);
    }) as typeof fetch;

    Trustware.useWallet(toSolanaWalletInterface(provider));
    const reviewed = await Trustware.buildRouteForReview(SOLANA_REQUEST);
    const sent = await Trustware.sendReviewedRoute(reviewed, SOLANA);
    assert.equal(sent.kind, "sent");
    if (sent.kind !== "sent") return;
    await Trustware.submitReceipt(sent.receipt.intentId, sent.receipt.txHash);

    assert.deepEqual(order, [
      `sign:${REBUILT_BLOCKHASH}`,
      "send(skipPreflight=false)",
      "status:not_found",
      "valid:503",
      "send(skipPreflight=true)",
      "status:pending",
      "valid:200",
      "send(skipPreflight=true)",
      "status:success",
    ]);
    assert.equal(sent.hash, bytesSignature);
    assert.notEqual(sent.hash, "rpc-said");
    assert.deepEqual(sent.receipt, {
      intentId: "intent-rebuilt",
      txHash: bytesSignature,
    });
    assert.deepEqual(receipts, [
      { body: { txHash: bytesSignature }, idempotencyKey: bytesSignature },
    ]);
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"],
      "the route was rebuilt once, before signing"
    );
  });
});
