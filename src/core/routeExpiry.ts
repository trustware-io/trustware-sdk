/* core/routeExpiry.ts */

/**
 * Every route the backend builds carries `expiresAt`: past it the routing
 * provider may revert, refund, or fill the old calldata at a worse price,
 * so the route must be rebuilt rather than sent (commit handshake spec,
 * "Expiry").
 */

/**
 * RFC 3339 as Go's `time.RFC3339` and `time.RFC3339Nano` emit it: upper-case
 * `T` and `Z`, optional fractional seconds, `Z` or a `±hh:mm` offset.
 */
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parse a route response's `expiresAt`. A missing or malformed value is a
 * contract violation and throws, naming the intent and the value.
 */
export function parseRouteExpiresAt(raw: unknown, intentId: string): Date {
  const fail = (why: string): never => {
    throw new Error(
      `The route for intent "${intentId}" has ${why} expiresAt ` +
        `(got ${JSON.stringify(raw)}); every route must carry an RFC 3339 expiry.`
    );
  };
  if (typeof raw !== "string") return fail("no");
  const match = RFC3339.exec(raw);
  if (!match) return fail("a malformed");
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const [offsetHour, offsetMinute] = match.slice(8, 10);
  // Absent for a `Z` offset.
  const offsetValid =
    offsetHour === undefined ||
    (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !offsetValid
  ) {
    return fail("an out-of-range");
  }
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return fail("an unparseable");
  return new Date(ms);
}

/**
 * Refused to send a route whose expiry has passed: nothing was sent. Build
 * a new route and send that instead.
 */
export class RouteExpiredError extends Error {
  readonly intentId: string;
  readonly expiresAt: Date;

  constructor(intentId: string, expiresAt: Date) {
    super(
      `Route intent ${intentId} expired at ${expiresAt.toISOString()}, so ` +
        `it was not sent. Build a new route and send that instead.`
    );
    this.name = "RouteExpiredError";
    this.intentId = intentId;
    this.expiresAt = expiresAt;
  }
}

/**
 * Throws `RouteExpiredError` once `nowMs` reaches the route's expiry. Run
 * right before anything that would broadcast the route.
 */
export function assertRouteNotExpired(
  route: { intentId: string; expiresAt: Date },
  nowMs: number = Date.now()
): void {
  if (nowMs >= route.expiresAt.getTime()) {
    throw new RouteExpiredError(route.intentId, route.expiresAt);
  }
}
