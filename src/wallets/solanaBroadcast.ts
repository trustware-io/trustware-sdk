import {
  SDKRPCError,
  getSolanaBlockhashValid,
  getSolanaTxStatus,
  hasSDKRPCCode,
  SDK_RPC_CODES,
  sendSolanaSerialized,
  type SolanaTxStatusResponse,
} from "../core/sdkRpc";
import { encodeBase58 } from "./base58";

/**
 * Sending a signed Solana transaction and rebroadcasting it until it settles
 * (CLAUDE.md, "Solana transactions: the SDK sends and rebroadcasts them").
 * `toSolanaWalletInterface` in `solana.ts` is the only caller. This lives in
 * its own module because `solana.ts` is re-exported whole by the public
 * `./wallet` entry.
 */

export const REBROADCAST_INTERVAL_MS = 2_000;

/** What the loop needs from a signed transaction, read from its bytes. */
export type SignedSolanaTransaction = {
  /** Base64, as the proxy takes it. */
  serialized: string;
  /** The first signature, base58: the transaction's id. */
  signature: string;
  /** The message's `recentBlockhash`, base58. */
  blockhash: string;
};

export type SolanaTxStatus = Pick<SolanaTxStatusResponse, "status" | "err">;

function expiredBeforeInclusion(signature: string, blockhash: string): string {
  return (
    `Solana transaction ${signature} expired before inclusion: its ` +
    `blockhash ${blockhash} is no longer valid and the network never ` +
    `included it.`
  );
}

/**
 * The signed transaction's blockhash expired before the first send, so
 * nothing was sent: signing took too long. The core send step catches this
 * once and rebuilds (`sendSignableRoute`); anything else reports its
 * message, the exact "expired before inclusion" error.
 */
export class SolanaExpiredBeforeSendError extends Error {
  readonly reason:
    "blockhash_expired_before_send" | "blockhash_not_found_on_send";
  readonly signature: string;
  readonly blockhash: string;

  constructor(
    reason: SolanaExpiredBeforeSendError["reason"],
    { signature, blockhash }: SignedSolanaTransaction
  ) {
    super(expiredBeforeInclusion(signature, blockhash));
    this.name = "SolanaExpiredBeforeSendError";
    this.reason = reason;
    this.signature = signature;
    this.blockhash = blockhash;
  }
}

/** The proxy calls the loop makes, as a seam for tests. */
export type SolanaBroadcastIO = {
  send(serialized: string, skipPreflight: boolean): Promise<void>;
  status(signature: string): Promise<SolanaTxStatus>;
  blockhashValid(blockhash: string): Promise<boolean>;
  sleep(ms: number): Promise<void>;
};

/**
 * Read the signature and blockhash out of signed transaction bytes. The
 * signature is never taken from an RPC answer: the bytes define it.
 */
export async function readSignedSolanaTransaction(
  bytes: Uint8Array,
  serialized: string
): Promise<SignedSolanaTransaction> {
  const { VersionedTransaction } = await import("@solana/web3.js");
  const transaction = VersionedTransaction.deserialize(bytes);
  const first = transaction.signatures[0];
  if (!first || first.every((byte) => byte === 0)) {
    throw new Error(
      "The Solana wallet returned a transaction without the fee payer's signature."
    );
  }
  return {
    serialized,
    signature: encodeBase58(first),
    blockhash: transaction.message.recentBlockhash,
  };
}

function describeRpcError(err: unknown): string {
  if (err instanceof SDKRPCError) {
    const detail = err.context?.error;
    return detail === undefined
      ? err.message
      : `${err.message}: ${String(detail)}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** A status or validity read failed, so the loop can't tell how the
 *  transaction ended. It may still land, so the error names it. */
function unknownOutcome(signature: string, err: unknown): Error {
  return new Error(
    `Couldn't confirm Solana transaction ${signature}: ${describeRpcError(err)}. ` +
      `It may still land, so check a block explorer before trying again.`
  );
}

function landedWithError(signature: string, status: SolanaTxStatus): Error {
  return new Error(
    `Solana transaction ${signature} failed on chain: ${JSON.stringify(status.err)}.`
  );
}

/**
 * Send `signed`, then rebroadcast the same bytes until it settles. Resolves
 * with the signature on success; throws when it lands with an error or
 * expires before inclusion. Its only stop conditions are those facts.
 */
export async function broadcastUntilSettled(
  signed: SignedSolanaTransaction,
  io: SolanaBroadcastIO
): Promise<string> {
  const { serialized, signature } = signed;

  // Signing can outlast the blockhash (about 31 s). Sending a transaction
  // already known to be expired only wastes the send.
  if ((await readValidity(io, signed, "before_send")) === "invalid") {
    throw new SolanaExpiredBeforeSendError(
      "blockhash_expired_before_send",
      signed
    );
  }

  // Preflighted, so a transaction that can't succeed fails here with the
  // simulation's error rather than being rebroadcast until it expires.
  try {
    await io.send(serialized, false);
  } catch (err) {
    if (hasSDKRPCCode(err, SDK_RPC_CODES.BLOCKHASH_NOT_FOUND)) {
      throw new SolanaExpiredBeforeSendError(
        "blockhash_not_found_on_send",
        signed
      );
    }
    if (!hasSDKRPCCode(err, SDK_RPC_CODES.ALREADY_PROCESSED)) {
      throw new Error(
        `Solana transaction ${signature} was not sent: ${describeRpcError(err)}.`
      );
    }
  }

  for (;;) {
    const status = await read(() => io.status(signature), signature);
    switch (status.status) {
      case "success":
        return signature;
      case "failed":
        throw landedWithError(signature, status);
      case "pending":
      case "not_found":
        break;
      default: {
        const unknown: never = status.status;
        throw new Error(
          `tx-status answered an unknown status ${JSON.stringify(unknown)} for ${signature}.`
        );
      }
    }

    const validity = await readValidity(io, signed, "in_flight");
    if (validity === "invalid") return settleAfterExpiry(signed, io);

    await io.sleep(REBROADCAST_INTERVAL_MS);
    await rebroadcast(io, signed);
  }
}

/**
 * Whether the blockhash can still be used. A failed RPC call (503
 * `RPC_CALL_FAILED`) says nothing about validity, so it is neither
 * "invalid" nor "expired": the next iteration checks again.
 */
async function readValidity(
  io: SolanaBroadcastIO,
  { signature, blockhash }: SignedSolanaTransaction,
  phase: "before_send" | "in_flight"
): Promise<"valid" | "invalid" | "unknown"> {
  try {
    return (await io.blockhashValid(blockhash)) ? "valid" : "invalid";
  } catch (err) {
    if (hasSDKRPCCode(err, SDK_RPC_CODES.RPC_CALL_FAILED)) {
      // Before the first send, an unknown answer sends anyway: the
      // preflight answers BLOCKHASH_NOT_FOUND for an expired blockhash.
      console.warn(
        `Couldn't check the blockhash of Solana transaction ${signature}, ` +
          (phase === "before_send"
            ? "sending anyway"
            : "checking again next round") +
          `: ${describeRpcError(err)}`
      );
      return "unknown";
    }
    if (phase === "before_send") {
      throw new Error(
        `Couldn't check the blockhash of Solana transaction ${signature} ` +
          `before sending it: ${describeRpcError(err)}. Nothing was sent.`
      );
    }
    throw unknownOutcome(signature, err);
  }
}

/**
 * Send the same bytes again. The first send already reached the cluster,
 * so neither of the proxy's expected refusals stops the loop:
 * `ALREADY_PROCESSED` means an earlier copy landed, and `BROADCAST_FAILED`
 * only costs this copy. Anything else is a fault and throws.
 */
async function rebroadcast(
  io: SolanaBroadcastIO,
  { serialized, signature }: SignedSolanaTransaction
): Promise<void> {
  try {
    await io.send(serialized, true);
  } catch (err) {
    if (hasSDKRPCCode(err, SDK_RPC_CODES.ALREADY_PROCESSED)) return;
    if (hasSDKRPCCode(err, SDK_RPC_CODES.BROADCAST_FAILED)) {
      console.warn(
        `Rebroadcast of Solana transaction ${signature} failed: ${describeRpcError(err)}`
      );
      return;
    }
    throw new Error(
      `Rebroadcast of Solana transaction ${signature} failed: ${describeRpcError(err)}. ` +
        `It may still land, so check a block explorer before trying again.`
    );
  }
}

/**
 * The blockhash has expired, so nothing more is sent. The transaction may
 * still have landed at the last moment: read status until it says.
 */
async function settleAfterExpiry(
  { signature, blockhash }: SignedSolanaTransaction,
  io: SolanaBroadcastIO
): Promise<string> {
  for (;;) {
    const status = await read(() => io.status(signature), signature);
    switch (status.status) {
      case "success":
        return signature;
      case "failed":
        throw landedWithError(signature, status);
      case "not_found":
        throw new Error(expiredBeforeInclusion(signature, blockhash));
      case "pending":
        await io.sleep(REBROADCAST_INTERVAL_MS);
        break;
      default: {
        const unknown: never = status.status;
        throw new Error(
          `tx-status answered an unknown status ${JSON.stringify(unknown)} for ${signature}.`
        );
      }
    }
  }
}

async function read<T>(call: () => Promise<T>, signature: string): Promise<T> {
  try {
    return await call();
  } catch (err) {
    throw unknownOutcome(signature, err);
  }
}

/** The proxy-backed IO the wallet adapter uses. */
export function proxyBroadcastIO(chainId: string): SolanaBroadcastIO {
  return {
    async send(serializedTransaction, skipPreflight) {
      await sendSolanaSerialized({
        chainId,
        serializedTransaction,
        skipPreflight,
      });
    },
    async status(signature) {
      const { status, err } = await getSolanaTxStatus({ chainId, signature });
      return { status, err };
    },
    blockhashValid: (blockhash) =>
      getSolanaBlockhashValid({ chainId, blockhash }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
