/**
 * The routing API's structured verdict, and the one place in the SDK that knows
 * its vocabulary.
 *
 * A failed /v1/routes/* call carries more than a sentence. The backend runs
 * every provider, judges each answer, and returns why each one is out:
 *
 *   {
 *     "error": "no route available for this pair",
 *     "code": "no_route_available",
 *     "providers": [
 *       { "name": "squid", "outcome": "declined", "code": "amount_too_low",
 *         "message": "Minimum swap amount for this route is 20.0 USDC" },
 *       { "name": "relay", "outcome": "declined", "code": "no_routes", "message": "…" }
 *     ]
 *   }
 *
 * The SDK used to reduce all of that to `throw new Error(json.error)` and then
 * re-derive a category by substring-matching the sentence in three separate
 * places. That is fragile in exactly the way it sounds: the backend added
 * "Minimum swap amount…" as a recognized decline in August 2026 and no matcher
 * knew about it, so an amount below a provider's minimum rendered as "No Route
 * Found — try a different token", when the provider had said the amount was the
 * problem and named the figure.
 */

/** One provider's answer, as the routing API reports it. */
export type RouteProviderOutcome = {
  name: string;
  /** "declined" — this provider cannot route the pair; "failed" — it errored. */
  outcome: "declined" | "failed" | (string & {});
  /** Stable machine code; see RouteDeclineCode / RouteFailureCode. */
  code: string;
  message: string;
};

/**
 * Codes for a provider that answered and said no. These are negative results,
 * not faults — the pair, the amount or the liquidity is the problem.
 */
export const RouteDeclineCode = {
  ChainUnsupported: "chain_unsupported",
  PairUnsupported: "pair_unsupported",
  ActionUnsupported: "action_unsupported",
  NoRoutes: "no_routes",
  AmountTooLow: "amount_too_low",
  InsufficientLiquidity: "insufficient_liquidity",
  DestinationCallFailed: "destination_call_failed",
  RouteUnsupported: "route_unsupported",
  /** The SDK's own verdict, not a provider's: the winning route's fees exceed
   *  what it delivers. See assertRouteDeliversValue. */
  FeesExceedOutput: "fees_exceed_output",
} as const;

/** Codes for a provider that did not answer properly. These are faults. */
export const RouteFailureCode = {
  NotConfigured: "not_configured",
  Timeout: "timeout",
  ProviderError: "provider_error",
} as const;

/** Top-level verdict for the request as a whole. */
export const RouteErrorCode = {
  /** Every provider declined: a negative result, returned as 404. */
  NoRouteAvailable: "no_route_available",
  /** At least one provider failed, so "unroutable" cannot be claimed: 502. */
  ProvidersFailed: "providers_failed",
  /** A route came back but the SDK refused it: its fees exceed its output.
   *  Reached client-side, so `status` is 0. */
  FeesExceedOutput: "fees_exceed_output",
} as const;

const ALL_PROVIDER_CODES: readonly string[] = [
  ...Object.values(RouteDeclineCode),
  ...Object.values(RouteFailureCode),
];

/**
 * A routing request that produced no route.
 *
 * `message` is unchanged from what the SDK has always thrown (the API's `error`
 * string), so every existing caller that reads `err.message` keeps working —
 * the structure is added alongside, never in place of it.
 *
 * Extends Error rather than TrustwareError to match RateLimitError, the other
 * transport-level error this package throws. TrustwareError is the
 * configuration/lifecycle error surfaced through `onError`.
 */
export class RouteError extends Error {
  /** HTTP status: 404 when every provider declined, 502 when one failed,
   *  0 when the SDK reached the verdict itself without a response. */
  readonly status: number;
  /** Top-level verdict — see RouteErrorCode. Empty when the API sent none. */
  readonly code: string;
  /** Per-provider answers, in the order the API reported them. */
  readonly providers: readonly RouteProviderOutcome[];

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    providers?: readonly RouteProviderOutcome[];
  }) {
    super(params.message);
    this.name = "RouteError";
    this.status = params.status;
    this.code = params.code ?? "";
    this.providers = params.providers ?? [];
  }

  /** True when every provider declined — nobody failed, so the pair is the problem. */
  get isNoRouteAvailable(): boolean {
    return this.code === RouteErrorCode.NoRouteAvailable || this.status === 404;
  }

  /** The distinct provider codes, e.g. ["amount_too_low", "no_routes"]. */
  get providerCodes(): string[] {
    return providerCodes(this.providers);
  }
}

function providerCodes(providers: readonly RouteProviderOutcome[]): string[] {
  return [...new Set(providers.map((p) => p.code).filter(Boolean))];
}

/** Narrowing helper that also works across bundle/realm boundaries. */
export function isRouteError(err: unknown): err is RouteError {
  return (
    err instanceof RouteError ||
    (err !== null &&
      typeof err === "object" &&
      (err as { name?: unknown }).name === "RouteError" &&
      Array.isArray((err as RouteError).providers))
  );
}

type RouteErrorBody = {
  error?: string;
  message?: string;
  code?: string;
  providers?: unknown[];
};

/**
 * Longest route-error text that is parsed for codes or a minimum. The API's
 * summaries are a few hundred bytes; anything larger is not one of them, and
 * skipping it keeps the parsers below from ever working on a large input.
 */
const MAX_ROUTE_ERROR_TEXT = 4_096;

/**
 * Accepts a provider entry only when its identifying fields are strings, and
 * returns a fresh object so a `message` of the wrong type can never reach the
 * text parsers. An omitted message is kept as "".
 */
function toProviderOutcome(value: unknown): RouteProviderOutcome | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (
    typeof p.name !== "string" ||
    typeof p.outcome !== "string" ||
    typeof p.code !== "string"
  ) {
    return null;
  }
  return {
    name: p.name,
    outcome: p.outcome,
    code: p.code,
    message: typeof p.message === "string" ? p.message : "",
  };
}

/**
 * Builds the error to throw for a non-2xx /v1/routes/* response.
 *
 * `fallbackMessage` is used only when the body carries no text at all, which is
 * what happens when the response never reached us as JSON.
 */
export function routeErrorFromResponse(
  status: number,
  body: unknown,
  fallbackMessage: string
): RouteError {
  const parsed = (body ?? {}) as RouteErrorBody;
  const providers = Array.isArray(parsed.providers)
    ? parsed.providers
        .map(toProviderOutcome)
        .filter((p): p is RouteProviderOutcome => p !== null)
    : [];
  return new RouteError({
    message: parsed.error || parsed.message || fallbackMessage,
    status,
    code: typeof parsed.code === "string" ? parsed.code : "",
    providers,
  });
}

/** What a caller needs to explain a failed route, however the error reached us. */
export type RouteErrorFacts = {
  /** Distinct provider codes, deduplicated. */
  codes: string[];
  /** Per-provider outcomes, empty when only the message survived. */
  providers: readonly RouteProviderOutcome[];
  /** True when no provider failed — every one of them declined. */
  allDeclined: boolean;
  /**
   * The smallest amount a provider said it would accept, when one said so.
   * Both spellings are covered: Squid's own "Minimum swap amount for this route
   * is 20.0 USDC" and the backend's "requires at least $20.00 USD".
   */
  minimum?: { amount: string; symbol: string };
};

/**
 * Recovers the routing verdict from anything the widget might be holding.
 *
 * A RouteError gives it directly, and that is the path that matters: the
 * widget classifies while it still has the error object, before flattening
 * the result to a string for component state (see useSwapRoute, and
 * mapError's memory of its own output for the render pass).
 *
 * A bare string or Error is still read for a summary that spells the codes
 * out — "no route available for this pair (squid: amount_too_low; …)" — which
 * is what the API rendered before the verdict moved into `providers` alone.
 * Kept so the widget behaves the same against a backend from before that
 * change; against the current API the string carries no codes and this
 * returns null.
 *
 * Returns null when the value carries no routing verdict at all, so callers can
 * fall through to their existing handling.
 */
export function parseRouteError(raw: unknown): RouteErrorFacts | null {
  // Read the fields, not the getter: a RouteError from another realm is a
  // plain object with the same shape and no prototype of ours.
  if (isRouteError(raw) && raw.providers.length > 0) {
    return {
      codes: providerCodes(raw.providers),
      providers: raw.providers,
      allDeclined: raw.providers.every((p) => p.outcome !== "failed"),
      minimum: firstMinimum(raw.providers.map((p) => p.message)),
    };
  }

  const text =
    typeof raw === "string"
      ? raw
      : raw instanceof Error
        ? raw.message
        : raw != null && typeof raw === "object" && "message" in raw
          ? String((raw as { message: unknown }).message)
          : "";
  if (!text || text.length > MAX_ROUTE_ERROR_TEXT) return null;

  // Only our own routing summaries are read this way. Scanning arbitrary text
  // for bare code words would misread ordinary prose — "connection timeout"
  // is not the provider outcome `timeout` — so the text has to be one of the
  // two summaries the routing API renders before its "provider: code" pairs
  // are trusted.
  const lower = text.toLowerCase();
  if (!ROUTE_SUMMARIES.some((summary) => lower.includes(summary))) return null;

  const codes = summaryCodes(lower);
  if (codes.length === 0) return null;

  const failureCodes: readonly string[] = Object.values(RouteFailureCode);
  return {
    codes,
    providers: [],
    allDeclined: !codes.some((code) => failureCodes.includes(code)),
    minimum: firstMinimum([text]),
  };
}

/**
 * The two summaries the routing API renders — see returnProviderOutcomes. Only
 * consulted on the legacy string path above; the current API's summary has no
 * codes after it.
 */
const ROUTE_SUMMARIES = [
  "no route available",
  "routing providers failed to answer",
] as const;

/**
 * Reads the codes out of the summary's parenthetical — "(squid: amount_too_low;
 * relay: no_routes)" — with plain string operations. The text is a response
 * body, so the parse has to stay linear in its length: a pattern that could
 * re-scan from each character would make an oversized body a way to stall
 * the widget's error path.
 */
function summaryCodes(lowerText: string): string[] {
  const open = lowerText.indexOf("(");
  const close = lowerText.lastIndexOf(")");
  if (open < 0 || close <= open) return [];

  const codes: string[] = [];
  for (const entry of lowerText.slice(open + 1, close).split(";")) {
    const colon = entry.indexOf(":");
    if (colon < 0) continue;
    const code = entry.slice(colon + 1).trim();
    if (ALL_PROVIDER_CODES.includes(code) && !codes.includes(code)) {
      codes.push(code);
    }
  }
  return codes;
}

/**
 * Pulls "20.0 USDC" out of a provider's refusal.
 *
 * Two wordings exist and neither is ours to choose: the provider's own
 * ("Minimum swap amount for this route is 20.0 USDC") and the backend's
 * pre-flight one ("requires at least $20.00 USD for this Solana route").
 */
function firstMinimum(
  messages: readonly string[]
): { amount: string; symbol: string } | undefined {
  for (const message of messages) {
    if (!message || message.length > MAX_ROUTE_ERROR_TEXT) continue;
    const named = message.match(
      /minimum(?:\s+swap)?\s+amount[^\d]*([\d,]+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9]*)?/i
    );
    if (named) {
      return { amount: trimAmount(named[1]), symbol: named[2] || "" };
    }
    const dollars = message.match(/at least \$\s*([\d,]+(?:\.\d+)?)/i);
    if (dollars) {
      return { amount: trimAmount(dollars[1]), symbol: "USD" };
    }
  }
  return undefined;
}

/** "20.00" -> "20", "20.50" -> "20.5" — a minimum reads better without padding. */
function trimAmount(value: string): string {
  const cleaned = value.split(",").join("");
  const point = cleaned.indexOf(".");
  if (point < 0) return cleaned;
  let end = cleaned.length;
  while (end > point + 1 && cleaned[end - 1] === "0") end--;
  if (end === point + 1) end = point;
  return cleaned.slice(0, end) || cleaned;
}

/** Renders a minimum for display: "20 USDC", "$20", or "" when unknown. */
export function formatMinimum(minimum?: {
  amount: string;
  symbol: string;
}): string {
  if (!minimum?.amount) return "";
  if (!minimum.symbol) return minimum.amount;
  if (minimum.symbol.toUpperCase() === "USD") return `$${minimum.amount}`;
  return `${minimum.amount} ${minimum.symbol}`;
}
