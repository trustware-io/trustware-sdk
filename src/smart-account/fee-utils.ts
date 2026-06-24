export type FeeRequirement = {
  minFee: bigint;
  minPriorityFee: bigint;
  // true  → -32602 replacement underpriced: bundler requires >110% of stuck op's fee
  // false → -32000 precheck floor: reported value IS the exact minimum
  isReplacement: boolean;
};

const CAUSE_CHAIN_LIMIT = 50;

function safeBigInt(value: string, fallback: bigint): bigint {
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

// Walks the cause chain looking for PAYMASTER_UNAVAILABLE, which means the backend's
// sign pipeline had a transient failure — distinct from NO_PAYMASTER (non-retryable).
export function isPaymasterUnavailable(err: unknown): boolean {
  let current = err;
  for (let depth = 0; depth < CAUSE_CHAIN_LIMIT; depth++) {
    if (!current || typeof current !== "object") return false;
    const e = current as { code?: unknown; cause?: unknown };
    if (e.code === "PAYMASTER_UNAVAILABLE") return true;
    current = e.cause;
  }
  return false;
}

// Account Kit wraps bundler errors inside SmartAccountUserOperationExecutionError.
// Walk the full cause chain to find a fee requirement from:
//   -32602 "replacement underpriced" — data.currentMaxFee / data.currentMaxPriorityFee
//   -32000 "precheck failed: maxFeePerGas must be at least Y" — parse Y from message
export function extractFeeRequirement(err: unknown): FeeRequirement | null {
  let current = err;
  for (let depth = 0; depth < CAUSE_CHAIN_LIMIT; depth++) {
    if (!current || typeof current !== "object") return null;
    const e = current as {
      code?: unknown;
      message?: unknown;
      data?: unknown;
      cause?: unknown;
    };

    if (e.code === -32602 && e.data && typeof e.data === "object") {
      const d = e.data as Record<string, unknown>;
      if (typeof d.currentMaxFee === "string") {
        try {
          const fee = BigInt(d.currentMaxFee);
          const priority =
            typeof d.currentMaxPriorityFee === "string"
              ? safeBigInt(d.currentMaxPriorityFee, fee)
              : fee;
          return { minFee: fee, minPriorityFee: priority, isReplacement: true };
        } catch {
          /* malformed fee string — fall through to cause chain */
        }
      }
    }

    if (e.code === -32000 && typeof e.message === "string") {
      const m = (e.message as string).match(/must be at least (\d+)/);
      if (m) {
        try {
          const fee = BigInt(m[1]);
          return { minFee: fee, minPriorityFee: fee, isReplacement: false };
        } catch {
          /* malformed fee string — fall through to cause chain */
        }
      }
    }

    current = e.cause;
  }
  return null;
}
