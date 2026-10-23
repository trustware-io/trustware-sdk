/** The warning colour shows for this last fraction of the interval: 10 s
 *  of the 60 s default, scaling with whatever interval the host sets. */
export const QUOTE_WARNING_FRACTION = 1 / 6;

export type QuoteCountdown = {
  /** 0 for a fresh quote, rising to 1 when it is due a refresh. */
  progress: number;
  /** In the last `QUOTE_WARNING_FRACTION` of the interval. */
  warning: boolean;
  /** The interval has run out. */
  expired: boolean;
};

/**
 * Where a quote stands in its refresh interval, `elapsedMs` after it was
 * built. `intervalMs` is the resolved `routes.options.routeRefreshMs`.
 */
export function quoteCountdown(
  elapsedMs: number,
  intervalMs: number
): QuoteCountdown {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(
      `A quote countdown needs a positive interval in ms (got ${intervalMs}).`
    );
  }
  if (Number.isNaN(elapsedMs)) {
    throw new Error("A quote countdown's elapsed time is NaN.");
  }
  // The wall clock can step backwards (NTP, a manual change); a quote is
  // never younger than fresh.
  const elapsed = Math.min(Math.max(elapsedMs, 0), intervalMs);
  return {
    progress: elapsed / intervalMs,
    warning: elapsed >= intervalMs * (1 - QUOTE_WARNING_FRACTION),
    expired: elapsed >= intervalMs,
  };
}

/**
 * Whether a countdown tick should refetch the quote. Never while a confirm
 * is in flight: the route the user confirmed is the one sent, and a refresh
 * landing then would replace it on screen mid-send.
 */
export function shouldRefreshQuote(
  countdown: QuoteCountdown,
  confirmInFlight: boolean
): boolean {
  return countdown.expired && !confirmInFlight;
}
