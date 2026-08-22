import type { Transaction } from "../types";

/**
 * Turns a failed status payload into something a user can act on.
 *
 * Providers explain themselves in `status_raw`: LiFi sends `substatus` plus a
 * `substatusMessage` ("Instruction #5 failed..."), others use `reason`,
 * `error` or `message`. None of that reached the UI, so a Solana swap that
 * reverted on-chain rendered the same "please try again" as every other
 * failure and the user had to open the network tab to learn anything.
 */

/** Long enough for a real provider sentence, short enough not to wreck the UI. */
const MAX_DETAIL = 160;

const GENERIC = "Transaction failed on-chain. Please try again.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** One line, no runaway length — these strings land in a small error card. */
function tidy(detail: string): string {
  const collapsed = detail.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_DETAIL
    ? `${collapsed.slice(0, MAX_DETAIL - 1).trimEnd()}…`
    : collapsed;
}

export function describeTransactionFailure(tx: Transaction): string {
  const raw = asRecord(tx?.statusRaw);

  const substatus = str(raw?.substatus);
  const detail =
    str(raw?.substatusMessage) ||
    str(raw?.reason) ||
    str(raw?.error) ||
    str(raw?.message);

  // The code is the reliable signal; the message is the human-readable part.
  // Match on both so a provider that only sends one of them still classifies.
  const haystack = `${substatus} ${detail}`.toLowerCase();

  if (/slippage|price impact|price movement/.test(haystack)) {
    return "Transaction failed due to price movement. Please try again with a higher slippage.";
  }

  if (/liquidity/.test(haystack)) {
    return "Transaction failed due to insufficient liquidity. Try a smaller amount.";
  }

  if (/timeout|timed out|expired/.test(haystack)) {
    return "Transaction expired. Please start a new transaction.";
  }

  if (/out.?of.?gas|insufficient (gas|fee)/.test(haystack)) {
    return "Transaction failed due to insufficient gas. Please ensure you have enough native tokens for gas.";
  }

  if (/insufficient (balance|funds)/.test(haystack)) {
    return "Transaction failed due to insufficient balance.";
  }

  if (tx?.gasStatus === "insufficient") {
    return "Transaction failed due to insufficient gas. Please ensure you have enough native tokens for gas.";
  }

  // Unclassified but explained — an on-chain instruction error, say. Passing
  // the provider's own words through beats inventing a vaguer sentence.
  if (detail) return `Transaction failed on-chain: ${tidy(detail)}`;

  return GENERIC;
}
