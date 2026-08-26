import {
  formatMinimum,
  parseRouteError,
  RouteDeclineCode,
  type RouteErrorFacts,
} from "src/core";

export type ErrorCategory =
  | "wallet_rejected"
  | "insufficient_funds"
  | "no_route"
  | "route_error"
  | "network_error"
  | "transaction_failed"
  | "timeout"
  | "fees_exceed_output"
  | "unknown";

export type MappedError = {
  category: ErrorCategory;
  title: string;
  message: string;
};

// Pull the status code and body out of messages like:
//   "squid api error: status=500 body={...}"
//   "lifi api error: status=400 body={...}"
function parseApiError(
  msg: string
): { status: number; body: Record<string, unknown> } | null {
  const statusMatch = msg.match(/status[=:\s]+(\d{3})/i);
  const bodyMatch = msg.match(/body[=:\s]+(\{[\s\S]*\})/i);
  if (!statusMatch) return null;
  const status = Number(statusMatch[1]);
  let body: Record<string, unknown> = {};
  if (bodyMatch) {
    try {
      body = JSON.parse(bodyMatch[1]) as Record<string, unknown>;
    } catch {
      /* unparseable body — proceed with status only */
    }
  }
  return { status, body };
}

function bodyMessage(body: Record<string, unknown>): string {
  return (
    (typeof body.message === "string" ? body.message : "") ||
    (typeof body.error === "string" ? body.error : "") ||
    ""
  ).toLowerCase();
}

/**
 * Turns the routing API's own verdict into the widget's category.
 *
 * Preferred over the substring rules below because it is what the backend
 * decided, not a guess at what it meant: each provider reports a stable code
 * (`amount_too_low`, `insufficient_liquidity`, `pair_unsupported`, …) and this
 * reads them. Returns null when the codes say nothing actionable, so mapError
 * falls through to its existing handling.
 */
function mapRouteFacts(facts: RouteErrorFacts): MappedError | null {
  if (facts.codes.length === 0) return null;

  // A provider that never answered is not evidence about the pair — saying "no
  // route exists" would be a claim the backend explicitly refused to make.
  if (!facts.allDeclined) {
    return {
      category: "route_error",
      title: "Route Unavailable",
      message:
        "A routing provider did not respond. Please try again in a moment.",
    };
  }

  const has = (code: string) => facts.codes.includes(code);

  // The SDK's own verdict (assertRouteDeliversValue): a route exists, but
  // executing it loses money outright. Not "no route" — the same inputs
  // return the same route — so it gets a category of its own, which the
  // swap CTA uses to block rather than offer "Review".
  if (has(RouteDeclineCode.FeesExceedOutput)) {
    return {
      category: "fees_exceed_output",
      title: "Fees Exceed Amount Received",
      message:
        "This route costs more in fees than it delivers. Try a larger amount, or a different token or network.",
    };
  }

  const tooLow = has(RouteDeclineCode.AmountTooLow);
  const lowLiquidity = has(RouteDeclineCode.InsufficientLiquidity);

  // Both cited at once points in two directions at once — a bigger amount for
  // one provider, a smaller one for the other. Say neither.
  if (tooLow && !lowLiquidity) {
    const minimum = formatMinimum(facts.minimum);
    return {
      category: "no_route",
      title: "Amount Below the Minimum",
      message: minimum
        ? `This route needs at least ${minimum}. Try a larger amount.`
        : "This amount is below the minimum for this route. Try a larger amount.",
    };
  }

  if (lowLiquidity && !tooLow) {
    return {
      category: "route_error",
      title: "Insufficient Liquidity",
      message:
        "Not enough liquidity for this swap. Try a smaller amount or different token.",
    };
  }

  if (
    facts.codes.every((code) => code === RouteDeclineCode.DestinationCallFailed)
  ) {
    // Integrator-facing: the pair routes fine, their postHook is what reverted.
    return DESTINATION_CALL_FAILED;
  }

  return {
    category: "no_route",
    title: "No Route Found",
    message:
      "No swap route exists for this pair. Try a different amount or token.",
  };
}

/**
 * Results this function has already produced, keyed by their message.
 *
 * The widget maps an error, stores the message in component state, and maps it
 * again on the way out — SwapMode renders `mapError(route.error)` where
 * `route.error` is already a mapped message. The second pass matched none of
 * the rules below (they read provider text, not our own prose), so "Your
 * balance is too low…" came back as "Something Went Wrong". Recognizing our own
 * output makes the second pass a no-op instead.
 *
 * Only messages this function authored are kept. A rule that passes the input
 * through unchanged is content-matched, so its output re-classifies the same
 * way on its own; and authored messages are a fixed set of literals (plus the
 * quoted minimum), so the map stays small without a cap that could stop
 * remembering mid-session.
 */
const SELF_MAPPED = new Map<string, MappedError>();

function rememberSelfMapped(mapped: MappedError, input: string): MappedError {
  if (mapped.message && mapped.message !== input) {
    SELF_MAPPED.set(mapped.message, mapped);
  }
  return mapped;
}

function messageOf(raw: unknown): string {
  return raw instanceof Error
    ? raw.message
    : typeof raw === "string"
      ? raw
      : raw != null
        ? String(raw)
        : "";
}

export function mapError(raw: unknown): MappedError {
  const msg = messageOf(raw);
  const seen = SELF_MAPPED.get(msg);
  if (seen) return seen;
  return rememberSelfMapped(classifyError(raw, msg), msg);
}

const DESTINATION_CALL_FAILED: MappedError = {
  category: "route_error",
  title: "Destination Call Failed",
  message:
    "The destination contract call could not be simulated. Check the call data and target.",
};

function classifyError(raw: unknown, msg: string): MappedError {
  const lower = msg.toLowerCase();

  // ── Wallet rejections ──────────────────────────────────────────────────────
  const code = (raw as Record<string, unknown>)?.code;
  if (
    code === 4001 ||
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("cancelled by user") ||
    (lower.includes("cancelled") && !lower.includes("api"))
  ) {
    return {
      category: "wallet_rejected",
      title: "Transaction Cancelled",
      message: "You declined the transaction in your wallet.",
    };
  }

  // ── Routing verdict ───────────────────────────────────────────────────────
  // Read the backend's own judgement first. It ran every provider and recorded
  // why each one is out; the rules below can only guess at that from prose, and
  // guessed wrong for an amount below a provider's minimum.
  const routeFacts = parseRouteError(raw);
  if (routeFacts) {
    const mapped = mapRouteFacts(routeFacts);
    if (mapped) return mapped;
  }

  // ── API errors (Squid, LiFi, etc.) ────────────────────────────────────────
  const api = parseApiError(msg);
  if (api) {
    const bm = bodyMessage(api.body);

    if (
      bm.includes("no route") ||
      bm.includes("no routes") ||
      bm.includes("route not found") ||
      bm.includes("no path found") ||
      bm.includes("cannot find")
    ) {
      return {
        category: "no_route",
        title: "No Route Found",
        message:
          "No swap route exists for this token pair. Try a different amount or token.",
      };
    }

    if (
      bm.includes("liquidity") ||
      bm.includes("slippage") ||
      bm.includes("price impact")
    ) {
      return {
        category: "route_error",
        title: "Insufficient Liquidity",
        message:
          "Not enough liquidity for this swap. Try a smaller amount or different token.",
      };
    }

    if (
      bm.includes("insufficient funds") ||
      bm.includes("insufficient balance")
    ) {
      return {
        category: "insufficient_funds",
        title: "Insufficient Balance",
        message: "Your balance is too low to complete this swap.",
      };
    }

    if (api.status >= 500) {
      return {
        category: "route_error",
        title: "Route Unavailable",
        message:
          "The routing service is temporarily unavailable. Please try again.",
      };
    }

    if (api.status === 400 || api.status === 422) {
      return {
        category: "route_error",
        title: "Invalid Quote Request",
        message:
          "Unable to get a quote for this swap. Try a different amount or token.",
      };
    }

    if (api.status === 429) {
      return {
        category: "route_error",
        title: "Too Many Requests",
        message: "Rate limit reached. Please wait a moment and try again.",
      };
    }

    return {
      category: "route_error",
      title: "Route Unavailable",
      message: "Could not get a quote right now. Please try again.",
    };
  }

  // ── Liquidity ─────────────────────────────────────────────────────────────
  // Ahead of the balance rule on purpose: "Not enough liquidity for this swap"
  // is about the pool, not the wallet, and the balance rule's "not enough"
  // matched it first — so this function's own liquidity message came back as
  // "Insufficient Balance" the second time round.
  // Deliberately narrow: a bare "slippage" or "price impact" also appears in
  // revert text, which the transaction rules below classify better.
  if (
    lower.includes("not enough liquidity") ||
    lower.includes("insufficient liquidity") ||
    lower.includes("price impact too high")
  ) {
    return {
      category: "route_error",
      title: "Insufficient Liquidity",
      message:
        "Not enough liquidity for this swap. Try a smaller amount or different token.",
    };
  }

  // ── Destination call ──────────────────────────────────────────────────────
  // Deterministic on its own wording, not via the cache above: this result is
  // otherwise close enough to "Route Unavailable" that the provider rule below
  // would retitle it on a second pass.
  if (lower.includes("destination contract call")) {
    return DESTINATION_CALL_FAILED;
  }

  // ── Provider did not answer ───────────────────────────────────────────────
  if (lower.includes("did not respond") || lower.includes("routing provider")) {
    return {
      category: "route_error",
      title: "Route Unavailable",
      message: msg.length < 160 ? msg : "Please try again in a moment.",
    };
  }

  // ── Insufficient funds ─────────────────────────────────────────────────────
  if (
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance") ||
    lower.includes("not enough")
  ) {
    return {
      category: "insufficient_funds",
      title: "Insufficient Balance",
      message:
        "Your balance is too low. Make sure you have enough tokens and gas.",
    };
  }

  // ── Gas / revert ───────────────────────────────────────────────────────────
  if (
    lower.includes("execution reverted") ||
    lower.includes("gas required exceeds")
  ) {
    return {
      category: "transaction_failed",
      title: "Transaction Would Fail",
      message: "The transaction would revert on-chain. Try a different amount.",
    };
  }

  if (
    lower.includes("gas") &&
    (lower.includes("estimation") || lower.includes("estimate"))
  ) {
    return {
      category: "transaction_failed",
      title: "Gas Estimation Failed",
      message:
        "Could not estimate gas for this transaction. Try a different amount.",
    };
  }

  // ── Network / RPC ──────────────────────────────────────────────────────────
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("connection refused") ||
    lower.includes("econnrefused") ||
    lower.includes("rpc") ||
    (lower.includes("timeout") && lower.includes("fetch"))
  ) {
    return {
      category: "network_error",
      title: "Connection Error",
      message:
        "Could not reach the network. Check your internet connection and try again.",
    };
  }

  // ── Timeout ────────────────────────────────────────────────────────────────
  if (
    lower.includes("timeout") ||
    lower.includes("taking longer") ||
    lower.includes("timed out")
  ) {
    return {
      category: "timeout",
      title: "Request Timed Out",
      message:
        "This is taking longer than expected. Check your block explorer for the status.",
    };
  }

  // ── Amount below a provider minimum ───────────────────────────────────────
  // Also covers this function's own wording. The widget stores a mapped message
  // in component state and maps it again on the way out (SwapMode renders
  // mapError(route.error)), so a message that did not re-classify to the same
  // category fell through to "Something Went Wrong".
  if (
    lower.includes("below the minimum") ||
    lower.includes("needs at least") ||
    lower.includes("minimum swap amount")
  ) {
    return {
      category: "no_route",
      title: "Amount Below the Minimum",
      message:
        msg.length < 120
          ? msg
          : "This amount is below the minimum for this route. Try a larger amount.",
    };
  }

  // ── No route (plain) ───────────────────────────────────────────────────────
  if (
    lower.includes("no route") ||
    lower.includes("no routes") ||
    lower.includes("no swap route") ||
    lower.includes("route not found")
  ) {
    return {
      category: "no_route",
      title: "No Route Found",
      message:
        "No swap route exists for this pair. Try a different amount or token.",
    };
  }

  // ── Transaction failed ─────────────────────────────────────────────────────
  if (lower.includes("transaction failed") || lower.includes("reverted")) {
    // A caller that already worked out *why* (describeTransactionFailure reads
    // the provider's substatus) must not have that replaced by boilerplate.
    // Bare phrases, multi-line dumps and raw viem revert traces still get it.
    const specific = msg.trim();
    const isBare =
      /^transaction (failed|reverted)[.!]?$/i.test(specific) ||
      specific.length > 200 ||
      specific.includes("\n");
    return {
      category: "transaction_failed",
      title: "Transaction Failed",
      message: isBare
        ? "The transaction could not be completed. Please try again."
        : specific,
    };
  }

  // ── Wrong chain ────────────────────────────────────────────────────────────
  if (
    lower.includes("wrong network") ||
    lower.includes("wrong chain") ||
    lower.includes("chain mismatch")
  ) {
    return {
      category: "transaction_failed",
      title: "Wrong Network",
      message:
        msg.length < 120
          ? msg
          : "Please switch to the correct network in your wallet.",
    };
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return {
    category: "unknown",
    title: "Something Went Wrong",
    message: "An unexpected error occurred. Please try again.",
  };
}
