import type { BuildRouteResult } from "../types";
import type { TxReceiptReport } from "./receipt";
import {
  buildRoute,
  isSerializedSolanaTxRequest,
  requestSlippageBps,
  type BuildRouteBody,
} from "./routes";
import {
  sendRouteTransactionReporting,
  type SendRouteTransactionOptions,
} from "./tx";
import type { ReceiptDeliveryOutcome } from "./intentTracking";
import { SolanaExpiredBeforeSendError } from "../wallets/solanaBroadcast";

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
      /** The receipt the SDK already delivered, as soon as the network
       *  accepted the transaction: don't post it again. It names the route
       *  that was signed, which for a Solana route is the rebuilt one and
       *  never the one the user reviewed. */
      receipt: TxReceiptReport;
      route: BuildRouteResult;
    }
  | {
      /** Nothing was sent. The caller shows `rebuilt` for review. */
      kind: "route_changed";
      rebuilt: BuiltRoute;
      change: MaterialRouteChange;
    };

/**
 * A route cleared for signing: the reviewed route on EVM, a fresh rebuild
 * within the reviewed bounds on Solana. The brand makes `routeForSigning`
 * the only way to get one, so `sendSignableRoute` can't be handed a stale
 * Solana route.
 */
export type SignableRoute = BuildRouteResult & {
  readonly [signableRouteBrand]: true;
};
declare const signableRouteBrand: unique symbol;

export type SigningDecision =
  | { kind: "ready"; route: SignableRoute }
  | {
      /** Nothing may be sent. The caller shows `rebuilt` for review. */
      kind: "route_changed";
      rebuilt: BuiltRoute;
      change: MaterialRouteChange;
    };

/**
 * Decide what to sign for a route the user just confirmed.
 *
 * An EVM route is signed as reviewed. A Solana route is rebuilt from its own
 * request first, because the reviewed transaction's blockhash may already
 * have expired; a failed rebuild throws. A materially worse rebuild comes
 * back as `route_changed`.
 */
export async function routeForSigning(
  reviewed: BuiltRoute
): Promise<SigningDecision> {
  if (!isSerializedSolanaTxRequest(reviewed.result.txReq)) {
    // The brand exists only in the type system; this and the Solana branch
    // below are its only constructors.
    return { kind: "ready", route: reviewed.result as SignableRoute };
  }
  const slippageBps = acceptedSlippageBps(reviewed.request);
  const rebuilt = await buildRouteForReview(reviewed.request);
  const change = findMaterialRouteChange(
    reviewed.result,
    rebuilt.result,
    slippageBps
  );
  if (change) return { kind: "route_changed", rebuilt, change };
  return { kind: "ready", route: rebuilt.result as SignableRoute };
}

/** What `onRetry` hands a host just before the second wallet prompt. */
export type SigningRetry = {
  reason: "blockhash_expired_before_send" | "blockhash_not_found_on_send";
  message: string;
  /** The rebuilt route about to be signed. */
  route: BuildRouteResult;
};

export type SendReviewedRouteOptions = SendRouteTransactionOptions & {
  /** Called once, after the route was rebuilt and before the wallet is
   *  asked to sign it again. Show `message` with the second prompt. */
  onRetry?: (retry: SigningRetry) => void;
};

/** The text every flow shows with the second prompt. */
export const SIGNING_RETRY_MESSAGE =
  "That took a little long, so we refreshed the route. Please approve again.";

/** A send the network accepted. Its receipt delivery has already started:
 *  the first POST went out before this was handed over. */
export type AcceptedSend = Extract<ReviewedRouteSend, { kind: "sent" }> & {
  receiptDelivery: Promise<ReceiptDeliveryOutcome>;
};

/**
 * Sign and send a route `routeForSigning` cleared for `reviewed`, and
 * deliver its receipt the moment the network accepts it, before any
 * confirmation (CLAUDE.md, "never lose the receipt"). `onAccepted` is
 * told then, so the widget can start tracking; it runs once per send.
 * A route whose `expiresAt` has passed throws `RouteExpiredError` and
 * sends nothing.
 *
 * If signing outlasted the Solana blockhash, nothing was sent, so the route
 * is rebuilt from `reviewed`'s request, checked for a material change
 * against what the user reviewed, and signed once more after `onRetry`.
 * Exactly once: a second expiry throws its "expired before inclusion"
 * error, and the wallet is never asked a third time.
 */
export async function sendSignableRoute(
  reviewed: BuiltRoute,
  route: SignableRoute,
  fallbackChainId?: number | string,
  options: SendReviewedRouteOptions = {},
  onAccepted?: (accepted: AcceptedSend) => void
): Promise<ReviewedRouteSend> {
  const { onRetry, ...sendOptions } = options;
  const acceptance: { sent?: AcceptedSend } = {};
  const send = (signing: SignableRoute) =>
    sendRouteTransactionReporting(
      signing,
      fallbackChainId,
      sendOptions,
      ({ hash, receipt, receiptDelivery }) => {
        const sent: AcceptedSend = {
          kind: "sent",
          hash,
          receipt,
          route: signing,
          receiptDelivery,
        };
        acceptance.sent = sent;
        onAccepted?.(sent);
      }
    );

  try {
    await send(route);
  } catch (err) {
    if (!(err instanceof SolanaExpiredBeforeSendError)) throw err;
    const decision = await routeForSigning(reviewed);
    if (decision.kind === "route_changed") return decision;
    onRetry?.({
      reason: err.reason,
      message: SIGNING_RETRY_MESSAGE,
      route: decision.route,
    });
    await send(decision.route);
  }
  const { sent } = acceptance;
  if (!sent) {
    throw new Error(
      `Intent ${route.intentId} was sent without being reported as accepted.`
    );
  }
  return {
    kind: "sent",
    hash: sent.hash,
    receipt: sent.receipt,
    route: sent.route,
  };
}

/**
 * Send the route the user confirmed: `routeForSigning`, then
 * `sendSignableRoute`. The public form of what the widget does. It delivers
 * the receipt itself, and the replacement's when the wallet speeds up or
 * replaces an EVM transaction, so callers don't call `submitReceipt`.
 * Throws `RouteExpiredError`, sending nothing, when the route expired:
 * build a new one.
 */
export async function sendReviewedRoute(
  reviewed: BuiltRoute,
  fallbackChainId?: number | string,
  options?: SendReviewedRouteOptions
): Promise<ReviewedRouteSend> {
  const decision = await routeForSigning(reviewed);
  if (decision.kind === "route_changed") return decision;
  return sendSignableRoute(reviewed, decision.route, fallbackChainId, options);
}
