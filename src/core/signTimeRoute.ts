import type { BuildRouteResult } from "../types";
import type { ReceiptReport } from "./intentTracking";
import {
  buildRoute,
  isSerializedSolanaTxRequest,
  requestSlippageBps,
  type BuildRouteBody,
} from "./routes";
import { sendRouteTransaction, type SendRouteTransactionOptions } from "./tx";

/**
 * A route together with the exact request that built it.
 *
 * A Solana route's transaction expires about a minute after the backend
 * builds it, so it is rebuilt from this request right before signing (see
 * CLAUDE.md, "Solana routes are built at sign time"). Keeping the two in one
 * object means the rebuild can only ever repeat the request the user
 * reviewed. The brand makes `buildRouteForReview` the only way to get one,
 * so a result can't be paired with a request that didn't build it.
 */
export type BuiltRoute = {
  readonly request: BuildRouteBody;
  readonly result: BuildRouteResult;
  readonly [builtRouteBrand]: true;
};
declare const builtRouteBrand: unique symbol;

export async function buildRouteForReview(
  request: BuildRouteBody
): Promise<BuiltRoute> {
  const result = await buildRoute(request);
  // The brand exists only in the type system; this is its one constructor.
  return { request, result } as BuiltRoute;
}

/**
 * Why a rebuilt route can't be sent on the strength of the review the user
 * gave the original. Amounts are in the token's smallest unit.
 */
export type MaterialRouteChange =
  | {
      kind: "output_below_accepted_slippage";
      reviewedToAmount: bigint;
      /** The lowest `toAmount` the accepted slippage allows, rounded up. */
      floorToAmount: bigint;
      rebuiltToAmount: bigint;
      slippageBps: number;
    }
  | {
      kind: "input_increased";
      reviewedFromAmount: bigint;
      rebuiltFromAmount: bigint;
    };

const BPS_DENOMINATOR = 10_000n;

function estimateAmount(
  route: BuildRouteResult,
  field: "fromAmount" | "toAmount",
  role: "reviewed" | "rebuilt"
): bigint {
  const raw = route.route?.estimate?.[field];
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new Error(
      `Can't compare the ${role} route (intent "${route.intentId}") with ` +
        `the other one: its estimate.${field} is ${JSON.stringify(raw)}, ` +
        `not an integer amount.`
    );
  }
  return BigInt(raw);
}

/**
 * Whether `rebuilt` differs from `reviewed` by more than the user agreed to.
 *
 * Material means the rebuilt route delivers less than the reviewed `toAmount`
 * less the accepted slippage, or pulls more than the reviewed `fromAmount`.
 * The input is checked first: paying more is a change whatever the output.
 * Throws when either estimate lacks an amount, since the change can't be
 * judged without it.
 */
export function findMaterialRouteChange(
  reviewed: BuildRouteResult,
  rebuilt: BuildRouteResult,
  slippageBps: number
): MaterialRouteChange | null {
  if (
    !Number.isSafeInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > Number(BPS_DENOMINATOR)
  ) {
    throw new Error(
      `Slippage must be a whole number of basis points from 0 to 10000 (got ${slippageBps}).`
    );
  }

  const reviewedFromAmount = estimateAmount(reviewed, "fromAmount", "reviewed");
  const rebuiltFromAmount = estimateAmount(rebuilt, "fromAmount", "rebuilt");
  if (rebuiltFromAmount > reviewedFromAmount) {
    return { kind: "input_increased", reviewedFromAmount, rebuiltFromAmount };
  }

  const reviewedToAmount = estimateAmount(reviewed, "toAmount", "reviewed");
  const rebuiltToAmount = estimateAmount(rebuilt, "toAmount", "rebuilt");
  const keptBps = BPS_DENOMINATOR - BigInt(slippageBps);
  // Rounded up, so `rebuilt < floor` is exactly
  // `rebuilt * 10000 < reviewed * (10000 - bps)` for integer amounts.
  const floorToAmount =
    (reviewedToAmount * keptBps + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
  if (rebuiltToAmount < floorToAmount) {
    return {
      kind: "output_below_accepted_slippage",
      reviewedToAmount,
      floorToAmount,
      rebuiltToAmount,
      slippageBps,
    };
  }
  return null;
}

/** The slippage the user accepted when they reviewed this request. */
function acceptedSlippageBps(request: BuildRouteBody): number {
  const bps = requestSlippageBps(request);
  if (bps === undefined) {
    throw new Error(
      "Can't judge a rebuilt Solana route: its request names no slippage, " +
        "so the tolerance the user accepted is unknown."
    );
  }
  return bps;
}

export type ReviewedRouteSend =
  | {
      kind: "sent";
      hash: string;
      /** Names the route that was signed, which for a Solana route is the
       *  rebuilt one and never the one the user reviewed. */
      receipt: ReceiptReport;
      route: BuildRouteResult;
    }
  | {
      /** Nothing was sent. The caller shows `rebuilt` for review. */
      kind: "route_changed";
      rebuilt: BuiltRoute;
      change: MaterialRouteChange;
    };

/**
 * Send the route the user confirmed. Every widget send goes through here.
 *
 * An EVM route is sent as reviewed. A Solana route is rebuilt from its own
 * request first, because the reviewed transaction's blockhash may already
 * have expired. A failed rebuild throws and nothing is sent. A materially
 * worse rebuild comes back as `route_changed`, unsent. Otherwise the rebuilt
 * route is signed straight away.
 */
export async function sendReviewedRoute(
  reviewed: BuiltRoute,
  fallbackChainId?: number | string,
  options?: SendRouteTransactionOptions
): Promise<ReviewedRouteSend> {
  let route = reviewed.result;
  if (isSerializedSolanaTxRequest(reviewed.result.txReq)) {
    const slippageBps = acceptedSlippageBps(reviewed.request);
    const rebuilt = await buildRouteForReview(reviewed.request);
    const change = findMaterialRouteChange(
      reviewed.result,
      rebuilt.result,
      slippageBps
    );
    if (change) return { kind: "route_changed", rebuilt, change };
    route = rebuilt.result;
  }

  const hash = await sendRouteTransaction(route, fallbackChainId, options);
  return {
    kind: "sent",
    hash,
    receipt: { intentId: route.intentId, txHash: hash },
    route,
  };
}
