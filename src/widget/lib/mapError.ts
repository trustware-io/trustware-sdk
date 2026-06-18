export type ErrorCategory =
  | "wallet_rejected"
  | "insufficient_funds"
  | "no_route"
  | "route_error"
  | "network_error"
  | "transaction_failed"
  | "timeout"
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

export function mapError(raw: unknown): MappedError {
  const msg =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw != null
          ? String(raw)
          : "";

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

  // ── No route (plain) ───────────────────────────────────────────────────────
  if (
    lower.includes("no route") ||
    lower.includes("no routes") ||
    lower.includes("route not found")
  ) {
    return {
      category: "no_route",
      title: "No Route Found",
      message:
        "No swap route exists for this pair. Try a different amount or token.",
    };
  }

  // ── Transaction failed (generic) ───────────────────────────────────────────
  if (lower.includes("transaction failed") || lower.includes("reverted")) {
    return {
      category: "transaction_failed",
      title: "Transaction Failed",
      message: "The transaction could not be completed. Please try again.",
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
