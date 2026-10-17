import { TrustwareError } from "src/errors/TrustwareError";
import { TrustwareErrorCode } from "src/errors/errorCodes";

/** How often both modes refresh the review screen's quote when the host
 *  sets no `routes.options.routeRefreshMs`. */
export const DEFAULT_ROUTE_REFRESH_MS = 60_000;

/** The largest delay `setTimeout`/`setInterval` hold (a signed 32-bit
 *  count of ms). Browsers run a longer one at once, which would refresh
 *  the quote in a tight loop. */
export const MAX_ROUTE_REFRESH_MS = 2_147_483_647;

/**
 * The quote refresh interval, in ms, from the host's
 * `routes.options.routeRefreshMs`: the default when it's unset, the value
 * itself when it's a number from 1 to `MAX_ROUTE_REFRESH_MS`. Anything else
 * is a config error naming the value.
 */
export function resolveRouteRefreshMs(raw: unknown): number {
  if (raw === undefined) return DEFAULT_ROUTE_REFRESH_MS;
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    raw < 1 ||
    raw > MAX_ROUTE_REFRESH_MS
  ) {
    const shown = typeof raw === "number" ? String(raw) : JSON.stringify(raw);
    throw new TrustwareError({
      code: TrustwareErrorCode.INVALID_CONFIG,
      message:
        "TrustwareConfig: 'routes.options.routeRefreshMs' must be a number " +
        `of milliseconds from 1 to ${MAX_ROUTE_REFRESH_MS} (got ${shown}).`,
      userMessage: "The configured route refresh interval is invalid.",
    });
  }
  return raw;
}
