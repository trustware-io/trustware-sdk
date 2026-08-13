import { apiBase, jsonHeaders, rateLimitedFetch } from "./http";

export type ForexRates = Record<string, number>;

/** Fetch all forex rates relative to `base` (default USD). */
export async function fetchForexRates(base = "USD"): Promise<ForexRates> {
  // /v1/forex is rate limited per API key like the rest of the SDK surface, so
  // it goes through the retrying fetch. Failure stays soft — callers fall back
  // to USD-only display rather than blocking on currency conversion — which
  // includes the RateLimitError that fetch throws once retries run out.
  let r: Response;
  try {
    r = await rateLimitedFetch(`${apiBase()}/v1/forex?base=${base}`, {
      headers: jsonHeaders(),
    });
  } catch {
    return {};
  }
  if (!r.ok) return {};
  const j = await r.json();
  // Normalise the two common response shapes:
  //   { data: { rates: { EUR: 0.92, ... } } }
  //   { rates: { EUR: 0.92, ... } }
  const rates: Record<string, unknown> =
    j?.data?.rates ?? j?.rates ?? j?.data ?? {};
  const result: ForexRates = { USD: 1 };
  for (const [k, v] of Object.entries(rates)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      result[k.toUpperCase()] = v;
    }
  }
  return result;
}
