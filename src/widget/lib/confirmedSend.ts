import {
  routeForSigning,
  type BuiltRoute,
  type SigningDecision,
} from "src/core/signTimeRoute";

/**
 * The GA4 event a widget send reports when it starts. Its name is fixed by
 * the BI queries in quicklinks_v1/iluvatar/db/g4a_repo.go. ESLint allows the
 * literal only in this file, so the event can't be reported from anywhere
 * but `prepareConfirmedSend`.
 */
export const PAYMENT_INITIATED = "payment_initiated";

/**
 * The first step of every widget send: decide what to sign for the route
 * the user confirmed, and call `onSendStarting` only when something will be
 * sent.
 *
 * `onSendStarting` is where `payment_initiated` is reported. A confirm whose
 * Solana rebuild came back materially worse sends nothing and goes back to
 * review, so it reports nothing; the confirm that does send reports once.
 * A failed rebuild throws before `onSendStarting` runs.
 */
export async function prepareConfirmedSend(
  reviewed: BuiltRoute,
  onSendStarting: (event: typeof PAYMENT_INITIATED) => void
): Promise<SigningDecision> {
  const decision = await routeForSigning(reviewed);
  if (decision.kind === "ready") onSendStarting(PAYMENT_INITIATED);
  return decision;
}
