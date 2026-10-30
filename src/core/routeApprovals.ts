import type { RouteApproval } from "src/types";

const DECIMAL_INTEGER = /^\d+$/;

/**
 * The amount a route's approval at `stepIndex` grants, in base units.
 *
 * Every backend provider sets it, so a missing or non-integer amount is a
 * broken response, never a default. Reading a missing amount as 0 would turn
 * the entry into a reset-to-zero step and leave the spender with nothing.
 */
export function approvalAmountWei(
  approval: RouteApproval,
  stepIndex: number
): bigint {
  const { amount } = approval;
  if (amount === undefined || amount === "") {
    throw new Error(
      `Route approval ${stepIndex} (spender ${String(approval.spender)}) has no amount.`
    );
  }
  if (!DECIMAL_INTEGER.test(amount)) {
    throw new Error(
      `Route approval ${stepIndex} (spender ${String(approval.spender)}) has an invalid amount "${amount}".`
    );
  }
  return BigInt(amount);
}

/** Refuses a route whose plan holds an approval with no usable amount, so
 *  nothing downstream ever reads one. */
export function assertValidRouteApprovals(
  approvals: RouteApproval[] | undefined
): void {
  (approvals ?? []).forEach(approvalAmountWei);
}
