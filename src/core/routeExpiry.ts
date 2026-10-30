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
 * A route response broke the contract: a field every route must carry is
 * missing or malformed. Nothing about the route can be trusted, so it is
 * refused rather than repaired.
 */
export class RouteResponseError extends Error {
  readonly intentId: string;
  /** The field at fault: the body's `expiresAt`, or the `Date` header. */
  readonly field: "expiresAt" | "Date";
  /** What arrived in its place. */
  readonly received: unknown;

  constructor(
    intentId: string,
    field: RouteResponseError["field"],
    received: unknown,
    message: string
  ) {
    super(message);
    this.name = "RouteResponseError";
    this.intentId = intentId;
    this.field = field;
    this.received = received;
  }
}

/**
 * Parse a route response's `expiresAt`. A missing or malformed value is a
 * contract violation and throws `RouteResponseError`, naming the intent and
 * the value.
 */
export function parseRouteExpiresAt(raw: unknown, intentId: string): Date {
  const fail = (why: string): never => {
    throw new RouteResponseError(
      intentId,
      "expiresAt",
      raw,
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

/** HTTP's IMF-fixdate, the form an origin server must send `Date` in
 *  (RFC 9110, section 5.6.7): `Sun, 06 Nov 1994 08:49:37 GMT`. */
const IMF_FIXDATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * How far the server's clock is ahead of this device's, in ms, read from a
 * route response's `Date` header at the moment it arrived. Expiry is judged
 * on the server's clock (`expiresAt` is its time), so a device clock that is
 * off neither expires a fresh route nor keeps an expired one alive. The
 * header's one-second truncation is allowed for where expiry is judged
 * (`serverNowMs`), not here.
 *
 * A missing or malformed `Date` is a contract violation (an origin server
 * must send one) and throws `RouteResponseError`; the device clock is never
 * used in its place.
 */
export function parseServerClockOffsetMs(
  dateHeader: string | null,
  receivedAtMs: number,
  intentId: string
): number {
  const ms = dateHeader === null ? Number.NaN : Date.parse(dateHeader);
  // The round trip rejects what the pattern can't: a wrong weekday, Feb 30.
  if (
    dateHeader === null ||
    !IMF_FIXDATE.test(dateHeader) ||
    !Number.isFinite(ms) ||
    new Date(ms).toUTCString() !== dateHeader
  ) {
    throw new RouteResponseError(
      intentId,
      "Date",
      dateHeader,
      `The route response for intent "${intentId}" has ` +
        `${dateHeader === null ? "no" : "a malformed"} Date header (got ` +
        `${JSON.stringify(dateHeader)}); expiry is judged on the server's ` +
        `clock, so every route response must carry an HTTP date.`
    );
  }
  return ms - receivedAtMs;
}

/** What judging a route's expiry needs: its expiry, in the server's time,
 *  and how far the server's clock was ahead of this device's. */
export type RouteExpiry = {
  intentId: string;
  expiresAt: Date;
  serverClockOffsetMs: number;
};

/**
 * `Date` is truncated to the second, so when the response left the server
 * its clock read somewhere in [Date, Date + 1 s). Expiry is judged with the
 * latest of those, so a route is refused up to 1 s early rather than sent
 * up to 1 s late.
 */
export const DATE_HEADER_TRUNCATION_MS = 999;

/**
 * The latest the server's clock can read now, by this device's clock and
 * the route's offset. Every expiry judgement goes through this.
 */
export function serverNowMs(route: RouteExpiry, nowMs: number): number {
  const serverNow =
    nowMs + route.serverClockOffsetMs + DATE_HEADER_TRUNCATION_MS;
  if (!Number.isFinite(serverNow)) {
    throw new Error(
      `Route intent ${route.intentId} has no usable server clock offset ` +
        `(got ${String(route.serverClockOffsetMs)}); a route must come from ` +
        `buildRoute or carry the offset its response's Date header gave.`
    );
  }
  return serverNow;
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
 * Throws `RouteExpiredError` once the server's time (`nowMs`, this device's
 * clock, plus the route's offset) reaches the route's expiry. Run right
 * before anything that would broadcast the route.
 */
export function assertRouteNotExpired(
  route: RouteExpiry,
  nowMs: number = Date.now()
): void {
  if (serverNowMs(route, nowMs) >= route.expiresAt.getTime()) {
    throw new RouteExpiredError(route.intentId, route.expiresAt);
  }
}
