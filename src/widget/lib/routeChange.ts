import type { MaterialRouteChange } from "src/core/signTimeRoute";

/** Short enough for the deposit swipe label. */
export const ROUTE_CHANGED_TITLE = "Quote changed. Check it and confirm again";

/**
 * Why a confirmed route went back to review. Nothing was sent, and the
 * screen it's shown on already displays the rebuilt route's amounts.
 */
export function describeRouteChange(change: MaterialRouteChange): string {
  switch (change.kind) {
    case "output_below_accepted_slippage":
      return (
        `The quote changed after you confirmed: you'd now receive less than ` +
        `your ${change.slippageBps / 100}% slippage allows. Nothing was sent. ` +
        `Check the new amounts and confirm again.`
      );
    case "input_increased":
      return (
        `The quote changed after you confirmed: it now spends more than ` +
        `the amount you reviewed. Nothing was sent. ` +
        `Check the new amounts and confirm again.`
      );
    default: {
      const unhandled: never = change;
      throw new Error(
        `Unhandled route change: ${JSON.stringify(unhandled, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )}`
      );
    }
  }
}
