export type FeeRequirement = {
  minFee: bigint;
  minPriorityFee: bigint;
  // true  → -32602 replacement underpriced: bundler requires >110% of stuck op's fee
  // false → -32000 precheck floor: reported value IS the exact minimum
  isReplacement: boolean;
};

// Walks the cause chain looking for PAYMASTER_UNAVAILABLE, which means the backend's
// sign pipeline had a transient failure — distinct from NO_PAYMASTER (non-retryable).
export function isPaymasterUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (e.code === "PAYMASTER_UNAVAILABLE") return true;
  return isPaymasterUnavailable(e.cause);
}

// Account Kit wraps bundler errors inside SmartAccountUserOperationExecutionError.
// Walk the full cause chain to find a fee requirement from:
//   -32602 "replacement underpriced" — data.currentMaxFee / data.currentMaxPriorityFee
//   -32000 "precheck failed: maxFeePerGas must be at least Y" — parse Y from message
export function extractFeeRequirement(err: unknown): FeeRequirement | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; message?: unknown; data?: unknown; cause?: unknown };

  if (e.code === -32602 && e.data && typeof e.data === "object") {
    const d = e.data as Record<string, unknown>;
    if (typeof d.currentMaxFee === "string") {
      const fee = BigInt(d.currentMaxFee);
      const priority =
        typeof d.currentMaxPriorityFee === "string" ? BigInt(d.currentMaxPriorityFee) : fee;
      return { minFee: fee, minPriorityFee: priority, isReplacement: true };
    }
  }

  if (e.code === -32000 && typeof e.message === "string") {
    const m = (e.message as string).match(/must be at least (\d+)/);
    if (m) {
      const fee = BigInt(m[1]);
      return { minFee: fee, minPriorityFee: fee, isReplacement: false };
    }
  }

  return extractFeeRequirement(e.cause);
}
