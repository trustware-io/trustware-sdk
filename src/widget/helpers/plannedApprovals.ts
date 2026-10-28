import { requiredApprovalAmount } from "../../core/tx";
import type { RouteApproval } from "../../types";
import { isEvmAddress } from "./chainHelpers";

/** One ERC20 allowance a route's plan says must be in place before its
 *  transaction is sent, resolved to what an allowance read and an
 *  approve() take. */
export type PlannedErc20Approval = {
  /** The entry's position in the plan's approvals array, which is the step
   *  index the backend seeded for it (approvals first, main step last). */
  stepIndex: number;
  chainId: string;
  token: `0x${string}`;
  spender: `0x${string}`;
  amountWei: bigint;
};

/**
 * The ERC20 allowances a route needs, read from its plan and from nowhere
 * else. A plan with no approvals needs none.
 *
 * The plan names the contract that will pull the tokens. The transaction's
 * own `to` is no stand-in for it: a Squid Intents deposit is a plain
 * `transfer()` to a deposit address, so its `to` is the token contract, and
 * approving that grants the token an allowance over itself that nothing ever
 * spends. That costs an extra wallet prompt and an approve() fee on every
 * ERC20 intent.
 *
 * An entry that does not name an EVM token and spender is not an ERC20
 * allowance and is left out; compare the result's length with the plan's to
 * tell whether every entry was covered.
 */
export function plannedErc20Approvals(
  approvals: RouteApproval[] | undefined,
  route: {
    /** Stands in for an entry that names no token. */
    fromTokenAddress: string | undefined;
    /** Stands in for an entry that names no chain. */
    chainId: string;
    /** Sizes an unlimited plan amount down to what the route pulls. */
    amountWei: bigint;
  }
): PlannedErc20Approval[] {
  return (approvals ?? []).flatMap((approval, stepIndex) => {
    const token = approval.tokenAddress ?? route.fromTokenAddress;
    const spender = approval.spender;
    if (!isEvmAddress(token) || !isEvmAddress(spender)) return [];
    return [
      {
        stepIndex,
        chainId: approval.chainId || route.chainId,
        token,
        spender,
        // A planned 0 is the reset-to-zero step USDT-style tokens need
        // before an existing allowance can change; it is kept as 0.
        amountWei: requiredApprovalAmount(
          BigInt(approval.amount || "0"),
          route.amountWei
        ),
      },
    ];
  });
}
