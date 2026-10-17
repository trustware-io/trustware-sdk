import {
  SDKRPCError,
  getSolanaBlockhashValid,
  getSolanaTxStatus,
  isSolanaAlreadyProcessed,
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
  const { serialized, signature, blockhash } = signed;

  // Preflighted, so a transaction that can't succeed fails here with the
  // simulation's error rather than being rebroadcast until it expires.
  try {
    await io.send(serialized, false);
  } catch (err) {
    if (!isSolanaAlreadyProcessed(err)) {
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

    const valid = await read(() => io.blockhashValid(blockhash), signature);
    if (!valid) return settleAfterExpiry(signed, io);

    await io.sleep(REBROADCAST_INTERVAL_MS);
    try {
      await io.send(serialized, true);
    } catch (err) {
      // The first send already reached the cluster, and the next status and
      // validity reads still bound the loop, so a failed rebroadcast only
      // costs one copy. "Already processed" means an earlier copy landed.
      if (!isSolanaAlreadyProcessed(err)) {
        console.warn(
          `Rebroadcast of Solana transaction ${signature} failed: ${describeRpcError(err)}`
        );
      }
    }
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
        throw new Error(
          `Solana transaction ${signature} expired before inclusion: its ` +
            `blockhash ${blockhash} is no longer valid and the network never ` +
            `included it.`
        );
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
    blockhashValid: (blockhash) => getSolanaBlockhashValid({ blockhash }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
