/* core/http.ts */
import { SDK_NAME, SDK_VERSION, API_ROOT, API_PREFIX } from "../constants";
import { TrustwareConfigStore } from "../config/";
import type { RateLimitInfo } from "../types/config";

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
  } catch {}
  throw new Error(`HTTP ${r.status}: ${msg}`);
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
  const { rateLimit } = cfg;

  // Always notify onRateLimitInfo if configured
  if (rateLimit.onRateLimitInfo) {
    rateLimit.onRateLimitInfo(info);
  }

  // Notify when rate limited
  if (isRateLimited && rateLimit.onRateLimited) {
    rateLimit.onRateLimited(info, retryCount);
  }

  // Notify when approaching limit
  if (
    !isRateLimited &&
    rateLimit.onRateLimitApproaching &&
    info.remaining <= rateLimit.approachingThreshold
  ) {
    rateLimit.onRateLimitApproaching(info, rateLimit.approachingThreshold);
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
 * Rate-limit-aware fetch wrapper.
 * Automatically handles 429 responses with exponential backoff retry.
 * Notifies callbacks on rate limit events.
 */
export async function rateLimitedFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipRateLimit, ...fetchOptions } = options;

  // If rate limiting is disabled or skipped, just do a normal fetch
  const cfg = TrustwareConfigStore.get();
  if (!cfg.rateLimit.enabled || skipRateLimit) {
    return fetch(url, fetchOptions);
  }

  const { maxRetries, baseDelayMs } = cfg.rateLimit;
  let retryCount = 0;

  while (true) {
    const response = await fetch(url, fetchOptions);

    // Parse rate limit headers
    const rateLimitInfo = parseRateLimitHeaders(response);

    if (response.status === 429) {
      // Rate limited
      if (rateLimitInfo) {
        notifyRateLimitCallbacks(rateLimitInfo, true, retryCount);
      }

      // Check if we should retry
      if (retryCount >= maxRetries) {
        // Max retries exhausted
        throw new RateLimitError(
          rateLimitInfo || { limit: 0, remaining: 0, reset: 0 },
          true
        );
      }

      // Calculate delay and retry
      const delay = calculateBackoffDelay(
        baseDelayMs,
        retryCount,
        rateLimitInfo?.retryAfter
      );
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
