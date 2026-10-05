/* core/http.ts */
import { SDK_NAME, SDK_VERSION, API_ROOT, API_PREFIX } from "../constants";
import { TrustwareConfigStore } from "../config/";
import { RATE_LIMIT_WAIT_BUDGET_MS, type RateLimitInfo } from "../types/config";

export function apiBase() {
  return `${API_ROOT}${API_PREFIX}`;
}

export function jsonHeaders(extra?: Record<string, string>): HeadersInit {
  const cfg = TrustwareConfigStore.get();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": cfg.apiKey,
    "X-SDK-Name": SDK_NAME,
    "X-SDK-Version": SDK_VERSION,
    "X-API-Version": "2025-10-01",
  };
  return { ...h, ...(extra || {}) };
}

export async function assertOK(r: Response) {
  if (r.ok) return;
  let msg = r.statusText;
  try {
    const j = await r.json();
    if (j?.error) msg = j.error;
  } catch {
    // response body not JSON, use statusText
  }
  throw new Error(`HTTP ${r.status}: ${msg}`);
}

/**
 * True when err is an assertOK rejection for an HTTP 404. Status pollers use
 * this to stop immediately on "resource doesn't exist" — since the backend
 * returns 200 {"status":"pending"} for a pre-receipt intent, a 404 can never
 * resolve by retrying.
 */
export function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("HTTP 404");
}

/** GET /api/v1/sdk/validate */
export async function validateSdkAccess() {
  const r = await fetch(`${apiBase()}/v1/sdk/validate`, {
    method: "GET",
    headers: jsonHeaders(),
  });
  await assertOK(r);
  const j = await r.json();
  return j.data;
}

/** Parse rate limit headers from a response */
export function parseRateLimitHeaders(r: Response): RateLimitInfo | null {
  const limit = r.headers.get("X-RateLimit-Limit");
  const remaining = r.headers.get("X-RateLimit-Remaining");
  const reset = r.headers.get("X-RateLimit-Reset");

  if (!limit || !remaining || !reset) {
    return null;
  }

  const info: RateLimitInfo = {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: parseInt(reset, 10),
  };

  // Add retryAfter if present (only on 429 responses)
  const retryAfter = r.headers.get("Retry-After");
  if (retryAfter) {
    info.retryAfter = parseInt(retryAfter, 10);
  }

  return info;
}

/** Notify rate limit callbacks based on response */
function notifyRateLimitCallbacks(
  info: RateLimitInfo,
  isRateLimited: boolean,
  retryCount: number
) {
  const cfg = TrustwareConfigStore.get();
  const { retry } = cfg;

  // Always notify onRateLimitInfo if configured
  if (retry.onRateLimitInfo) {
    retry.onRateLimitInfo(info);
  }

  // Notify when rate limited
  if (isRateLimited && retry.onRateLimited) {
    retry.onRateLimited(info, retryCount);
  }

  // Notify when approaching limit
  if (
    !isRateLimited &&
    retry.onRateLimitApproaching &&
    info.remaining <= retry.approachingThreshold
  ) {
    retry.onRateLimitApproaching(info, retry.approachingThreshold);
  }
}

/**
 * How long the server is telling us to wait, in ms, or null when it hasn't
 * told us anything usable.
 *
 * Retry-After is the direct answer and comes back on every 429. X-RateLimit-Reset
 * is the fallback: it is the end of the current window, present on every
 * response, so it yields the same instant when a proxy drops Retry-After.
 *
 * There is deliberately no invented backoff behind these. The limit is a fixed
 * window, so any delay we make up either lands in the same window and fails
 * again, or overshoots one we could have read exactly. No guidance from the
 * server means we don't know when the window turns, and the honest move is to
 * hand the 429 to the caller rather than spend its requests guessing.
 */
function serverDirectedWaitMs(info: RateLimitInfo | null): number | null {
  if (!info) return null;

  if (typeof info.retryAfter === "number" && info.retryAfter > 0) {
    return info.retryAfter * 1000;
  }

  if (typeof info.reset === "number" && info.reset > 0) {
    const untilReset = info.reset * 1000 - Date.now();
    if (untilReset > 0) return untilReset;
  }

  return null;
}

/** Sleep for specified milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimitError extends Error {
  public readonly rateLimitInfo: RateLimitInfo;
  /**
   * true  — the response carried no usable Retry-After or X-RateLimit-Reset, so
   *         there was no schedule to retry against and the SDK stopped.
   * false — the wait is known and simply longer than the SDK will block for.
   *         `rateLimitInfo.retryAfter` holds it; show the user when to return.
   */
  public readonly retriesExhausted: boolean;

  constructor(info: RateLimitInfo, retriesExhausted: boolean) {
    const seconds =
      info.retryAfter ??
      (info.reset > 0
        ? Math.max(0, Math.ceil((info.reset * 1000 - Date.now()) / 1000))
        : null);
    const message =
      seconds === null
        ? "Rate limit exceeded. The server did not say when to retry."
        : `Rate limit exceeded. Try again in ${seconds} seconds.`;
    super(message);
    this.name = "RateLimitError";
    this.rateLimitInfo = info;
    this.retriesExhausted = retriesExhausted;
  }
}

type FetchOptions = RequestInit & {
  /** Skip rate limit handling for this request */
  skipRateLimit?: boolean;
};

/**
 * Runs `attempt`, waiting out 429s for as long as the server asks and the wait
 * budget allows.
 *
 * The schedule is the server's, not ours: the limit is per API key (and
 * settable per key), and every response reports that key's state, so the SDK
 * reads the wait off Retry-After — or X-RateLimit-Reset — instead of keeping a
 * second, guessed copy of the policy. The only number chosen here is
 * RATE_LIMIT_WAIT_BUDGET_MS, the total time we will block before handing the
 * wait back to the caller to display.
 *
 * The caller supplies the whole request as a thunk rather than a URL so each
 * attempt is genuinely fresh — `smart-account/client.ts` needs a new
 * AbortController timeout per try, which it could not get if this helper
 * reused one RequestInit (an aborted signal would poison every later attempt).
 */
export async function withRateLimitRetry(
  attempt: () => Promise<Response>
): Promise<Response> {
  let waitedMs = 0;
  let retryCount = 0;

  while (true) {
    const response = await attempt();
    const rateLimitInfo = parseRateLimitHeaders(response);

    if (response.status !== 429) {
      if (rateLimitInfo) {
        notifyRateLimitCallbacks(rateLimitInfo, false, 0);
      }
      return response;
    }

    if (rateLimitInfo) {
      notifyRateLimitCallbacks(rateLimitInfo, true, retryCount);
    }

    const waitMs = serverDirectedWaitMs(rateLimitInfo);
    const info = rateLimitInfo || { limit: 0, remaining: 0, reset: 0 };

    // No usable Retry-After or Reset — nothing to schedule against, so stop
    // rather than guess. In a browser this means the rate limit headers aren't
    // reaching us (see the backend's Access-Control-Expose-Headers); blind
    // retries there burned the caller's remaining budget and always failed.
    if (waitMs === null) {
      throw new RateLimitError(info, true);
    }

    // Past the budget, report the wait instead of blocking on it. The caller
    // gets retriesExhausted: false and retryAfter, so it can tell the user when
    // to come back. Waiting a shorter, made-up delay would be worse than both:
    // it spends a request that is guaranteed to come back 429.
    if (waitedMs + waitMs > RATE_LIMIT_WAIT_BUDGET_MS) {
      throw new RateLimitError(info, false);
    }

    await sleep(waitMs);
    waitedMs += waitMs;
    retryCount++;
  }
}

/**
 * Rate-limit-aware fetch wrapper.
 * Automatically handles 429 responses with exponential backoff retry.
 * Notifies callbacks on rate limit events.
 */
export async function rateLimitedFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipRateLimit, ...fetchOptions } = options;

  if (skipRateLimit) {
    return fetch(url, fetchOptions);
  }

  return withRateLimitRetry(() => fetch(url, fetchOptions));
}
