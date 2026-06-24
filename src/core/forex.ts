import { apiBase, jsonHeaders } from "./http";

export type ForexRates = Record<string, number>;

/** Fetch all forex rates relative to `base` (default USD). */
export async function fetchForexRates(base = "USD"): Promise<ForexRates> {
  const r = await fetch(`${apiBase()}/v1/forex?base=${base}`, {
    headers: jsonHeaders(),
  });
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
