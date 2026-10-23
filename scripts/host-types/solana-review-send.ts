// A host's review-then-send flow, typechecked against the built dist by
// `npm run check:host-types` (run `npm run build` first). It pins the
// signed-off host API (2026-10-16): buildRouteForReview, sendReviewedRoute
// and its onRetry option, and the types exported from @trustware/sdk/core.
// Each @ts-expect-error is a misuse the types must keep refusing.
import { Trustware } from "@trustware/sdk";
import type {
  BuiltRoute,
  MaterialRouteChange,
  ReviewedRouteSend,
  SendReviewedRouteOptions,
  SigningRetry,
} from "@trustware/sdk/core";
import { buildRouteForReview, sendReviewedRoute } from "@trustware/sdk/core";

declare function showNotice(message: string): void;

export async function reviewThenSend(): Promise<void> {
  const reviewed = await Trustware.buildRouteForReview({
    fromChain: "solana-mainnet-beta",
    fromToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    toChain: "8453",
    toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    fromAmount: "25000000",
    fromAddress: await Trustware.getAddress(),
    toAddress: "0xDestination...",
    slippage: 0.5,
  });
  const sent = await Trustware.sendReviewedRoute(reviewed, undefined, {
    onRetry: (retry) => showNotice(retry.message),
  });
  if (sent.kind === "route_changed") {
    const change: MaterialRouteChange = sent.change;
    const again: ReviewedRouteSend = await Trustware.sendReviewedRoute(
      sent.rebuilt
    );
    void change;
    void again;
  } else {
    // Already delivered by sendReviewedRoute: no submitReceipt.
    const status = await Trustware.pollStatus(sent.receipt.intentId);
    void status;
  }

  const onRetry = (retry: SigningRetry): void => {
    const reason:
      | "blockhash_expired_before_send"
      | "blockhash_not_found_on_send" = retry.reason;
    showNotice(`${retry.message} (${reason}, ${retry.route.intentId})`);
  };
  const options: SendReviewedRouteOptions = { approvalsEnsured: true, onRetry };
  const built: BuiltRoute = await buildRouteForReview(reviewed.request);
  await sendReviewedRoute(built, 1, options);
}

// @ts-expect-error the brand makes buildRouteForReview the only constructor
export const forged: BuiltRoute = { request: {} as BuiltRoute["request"], result: {} as BuiltRoute["result"] };

// @ts-expect-error onRetry takes a SigningRetry
export const wrongCallback: SendReviewedRouteOptions = { onRetry: (retry: string) => retry };

// @ts-expect-error the retry reason is a closed set
export const wrongReason: SigningRetry["reason"] = "timeout";
