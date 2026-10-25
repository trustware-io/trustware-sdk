// The README's "Expiry, commits and refusals" example, typechecked against
// the built dist by `npm run check:host-types` (run `npm run build` first).
// Each @ts-expect-error is a misuse the types must keep refusing.
import {
  ReceiptCommitError,
  RouteExpiredError,
  Trustware,
  type BuildRouteBody,
} from "@trustware/sdk";
import type { BuiltRoute } from "@trustware/sdk/core";

declare const request: BuildRouteBody;
declare const reviewed: BuiltRoute;

export async function sendOrRequote(): Promise<void> {
  try {
    await Trustware.sendReviewedRoute(reviewed);
  } catch (err) {
    if (err instanceof RouteExpiredError) {
      const when: Date = err.expiresAt;
      const intent: string = err.intentId;
      void when;
      void intent;
    }
  }
}

export async function commitYourself(): Promise<void> {
  const route = await Trustware.buildRoute(request);
  const expiresAt: Date = route.expiresAt;
  // @ts-expect-error expiresAt is parsed: it is a Date, not the wire string.
  const raw: string = route.expiresAt;
  void expiresAt;
  void raw;

  const hash = await Trustware.sendRouteTransaction(route);
  try {
    await Trustware.submitReceipt(route.intentId, hash);
  } catch (err) {
    if (err instanceof ReceiptCommitError && err.retryable) {
      const code: string = err.code;
      const status: number = err.status;
      void code;
      void status;
    }
  }
}

export async function pollToTheEnd(intentId: string): Promise<boolean> {
  const tx = await Trustware.pollStatus(intentId);
  return tx.status === "expired";
}
