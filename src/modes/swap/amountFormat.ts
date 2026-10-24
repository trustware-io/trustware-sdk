/**
 * Significant digits kept for an amount too small to show at the caller's
 * fraction-digit limit.
 */
const SMALL_AMOUNT_SIGNIFICANT_DIGITS = 2;

/**
 * Formats a token amount for display in the user's locale, with at most
 * `maxFractionDigits` decimals.
 *
 * An amount smaller than the smallest step those decimals can show is
 * formatted to its leading significant digits instead, so a nonzero amount
 * never displays as "0". A cheap token bridged in a small swap lands
 * amounts like 0.000033 ETH, which a fixed 4-decimal format rounds away.
 */
export function fmtAmount(n: number, maxFractionDigits = 6): string {
  if (!isFinite(n) || n === 0) return "0";
  if (Math.abs(n) < 10 ** -maxFractionDigits) {
    return n.toLocaleString(undefined, {
      maximumSignificantDigits: SMALL_AMOUNT_SIGNIFICANT_DIGITS,
    });
  }
  return n.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
  });
}
