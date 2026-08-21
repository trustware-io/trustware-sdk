import type { RouteEstimate } from "src/types";

/**
 * Whether a route is worth executing at all, in plain USD terms.
 *
 * The backend scores routes on `net_usd` = output value minus fees and will
 * still return the best of a bad set — a Plume→ETH quote once won with
 * net_usd −0.036990: $0.088 of fees against $0.051 of output. Executing that
 * is strictly value-destroying, and the widget surfaced only a price-impact
 * badge, which reads as "expensive" rather than "you will end up with less
 * than you paid in fees".
 *
 * `net_usd` itself is a scoring field the SDK never receives, but the two
 * numbers behind it ride along on the estimate, so it is recomputed here.
 */

/** Below this the USD figures are noise, not signal, and comparing them
 *  produces false positives on dust-sized trades. */
const USD_NOISE_FLOOR = 0.005;

function parseUsd(value: string | undefined): number | null {
  if (value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Output value minus total fees, or null when the provider didn't price both
 * sides. Null means "unknown", never "fine" — callers must not treat a missing
 * estimate as a passing check.
 */
export function routeNetUsd(
  estimate: RouteEstimate | undefined
): number | null {
  if (!estimate) return null;
  const toUsd = parseUsd(estimate.toAmountUsd);
  const feesUsd = parseUsd(estimate.totalFeesUsd);
  if (toUsd == null || feesUsd == null) return null;
  return toUsd - feesUsd;
}

/**
 * True when fees exceed everything the route delivers, i.e. `net_usd < 0`.
 *
 * Returns false when the numbers are missing or too small to compare: a route
 * that cannot be shown to be value-destroying is not blocked, so an
 * unpriced-but-fine route still executes.
 */
export function isValueDestroying(
  estimate: RouteEstimate | undefined
): boolean {
  const net = routeNetUsd(estimate);
  if (net == null) return false;

  const toUsd = parseUsd(estimate?.toAmountUsd) ?? 0;
  const feesUsd = parseUsd(estimate?.totalFeesUsd) ?? 0;
  if (toUsd < USD_NOISE_FLOOR && feesUsd < USD_NOISE_FLOOR) return false;

  return net < 0;
}
