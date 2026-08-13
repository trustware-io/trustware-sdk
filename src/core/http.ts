/* core/http.ts */
import { SDK_NAME, SDK_VERSION, API_ROOT, API_PREFIX } from "../constants";
import { TrustwareConfigStore } from "../config/";
import { RETRY_POLICY, type RateLimitInfo } from "../types/config";

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

///sdk/validate
export async function validateSdkAccess() {
  const r = await fetch(`${apiBase()}/sdk/validate`, {
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

/** Calculate delay for exponential backoff */
function calculateBackoffDelay(
  baseDelayMs: number,
  retryCount: number,
  retryAfter?: number
): number {
  // If server specified retry-after, use that (in seconds, convert to ms)
  if (retryAfter && retryAfter > 0) {
    return retryAfter * 1000;
  }
  // Otherwise use exponential backoff: base * 2^retryCount
  return baseDelayMs * Math.pow(2, retryCount);
}

/** Sleep for specified milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimitError extends Error {
  public readonly rateLimitInfo: RateLimitInfo;
  public readonly retriesExhausted: boolean;

  constructor(info: RateLimitInfo, retriesExhausted: boolean) {
    const message = retriesExhausted
      ? `Rate limit exceeded after max retries. Try again in ${info.retryAfter ?? Math.ceil((info.reset * 1000 - Date.now()) / 1000)} seconds.`
      : `Rate limit exceeded. Try again in ${info.retryAfter} seconds.`;
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
 * Runs `attempt` and retries it on 429 until it succeeds, retries run out, or
 * the wait the server is asking for is longer than we're willing to block.
 *
 * The caller supplies the whole request as a thunk rather than a URL so each
 * attempt is genuinely fresh — `smart-account/client.ts` needs a new
 * AbortController timeout per try, which it could not get if this helper
 * reused one RequestInit (an aborted signal would poison every later attempt).
 *
 * The backend limits per SDK API key on a fixed 60s window, so once a key is
 * limited every request fails until the window rolls. Blind exponential
 * backoff (1s, 2s, 4s) lands all three retries inside that same window and
 * always fails; the server's Retry-After is the only value that actually
 * points at the next window, which is why it must reach us — see the backend's
 * Access-Control-Expose-Headers.
 */
export async function withRateLimitRetry(
  attempt: () => Promise<Response>
): Promise<Response> {
  const { MAX_RETRIES, BASE_DELAY_MS, MAX_DELAY_MS } = RETRY_POLICY;
  let retryCount = 0;

  while (true) {
    const response = await attempt();

    // Parse rate limit headers
    const rateLimitInfo = parseRateLimitHeaders(response);

    if (response.status === 429) {
      // Rate limited
      if (rateLimitInfo) {
        notifyRateLimitCallbacks(rateLimitInfo, true, retryCount);
      }

      // Check if we should retry
      if (retryCount >= MAX_RETRIES) {
        // Max retries exhausted
        throw new RateLimitError(
          rateLimitInfo || { limit: 0, remaining: 0, reset: 0 },
          true
        );
      }

      // Calculate delay and retry
      const delay = calculateBackoffDelay(
        BASE_DELAY_MS,
        retryCount,
        rateLimitInfo?.retryAfter
      );

      // Honouring a long Retry-After would park a payment UI on a spinner for
      // up to a minute per try. Past the ceiling, hand the caller the wait it
      // has to sit out (retriesExhausted: false, so the error reads "try again
      // in N seconds") and let it render that instead of hanging. Sleeping a
      // capped-but-still-too-short delay would be worse than both: it burns a
      // retry that is guaranteed to come back 429.
      if (delay > MAX_DELAY_MS) {
        throw new RateLimitError(
          rateLimitInfo || { limit: 0, remaining: 0, reset: 0 },
          false
        );
      }

      await sleep(delay);
      retryCount++;
      continue;
    }

    // Not rate limited - notify callbacks if we have info
    if (rateLimitInfo) {
      notifyRateLimitCallbacks(rateLimitInfo, false, 0);
    }

    return response;
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
