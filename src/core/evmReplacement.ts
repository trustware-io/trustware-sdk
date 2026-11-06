/* core/evmReplacement.ts */
import { createPublicClient, custom, type Hash } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import type { EIP1193 } from "../types";

/** Tests shorten these. Production callers pass only the deadline. */
export type ReplacementWatchTiming = {
  /** Stop watching after this long, whether or not the tx was mined. */
  timeoutMs: number;
  /** How often to poll for a new block. Defaults to viem's 4 s. */
  pollingIntervalMs?: number;
};

/**
 * Watch an accepted EVM transaction until it is mined. When the wallet
 * replaces it first (a speed-up, a cancel, or any other transaction from
 * the same sender with the same nonce), `onReplaced` gets the replacement's
 * hash once the replacement is mined. That is when Ilúvatar can see it and
 * accept it as the receipt's new hash.
 *
 * Reads go through the wallet's own EIP-1193 provider, because the SDK RPC
 * proxy has no block reads. A replacement on another chain (the wallet was
 * switched while it was watched) is not this payment's, so it is logged and
 * not reported.
 *
 * Never rejects. The receipt for the original hash is already committed, so
 * a watch that can't finish (an RPC failure, the deadline) only means a
 * replacement goes unreported; that ending is logged.
 */
export async function watchForReplacement(
  provider: EIP1193,
  {
    hash,
    chainId,
  }: {
    hash: string;
    chainId: number;
  },
  onReplaced: (replacementHash: string) => void,
  { timeoutMs, pollingIntervalMs }: ReplacementWatchTiming
): Promise<void> {
  const client = createPublicClient({
    transport: custom(provider),
    ...(pollingIntervalMs === undefined
      ? {}
      : { pollingInterval: pollingIntervalMs }),
  });
  try {
    // viem's block watcher drops a failed block read without a word, so a
    // provider that can't read blocks at all would watch silently for the
    // whole deadline. One read first makes that case end, logged.
    await client.getBlockNumber();
    await waitForTransactionReceipt(client, {
      hash: hash as Hash,
      timeout: timeoutMs,
      ...(pollingIntervalMs === undefined
        ? {}
        : { pollingInterval: pollingIntervalMs }),
      onReplaced: ({ reason, transaction }) => {
        if (transaction.chainId !== chainId) {
          console.warn("[Trustware] ignored a replacement on another chain", {
            hash,
            replacement: transaction.hash,
            reason,
            chainId,
            replacementChainId: transaction.chainId,
          });
          return;
        }
        onReplaced(transaction.hash);
      },
    });
  } catch (error) {
    console.warn("[Trustware] stopped watching for a replacement", {
      hash,
      chainId,
      error,
    });
  }
}
