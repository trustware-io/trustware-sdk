/* core/receipt.ts */
import { apiBase, HttpError, jsonHeaders, rateLimitedFetch } from "./http";

/**
 * What one commit names: the body of
 * POST /v1/route-intent/{intentId}/receipt. Exactly one of `txHash` and
 * `userOpHash`, and a `userOpHash` always comes with the
 * `sponsorshipRequestId` that sponsored it.
 */
export type ReceiptCommit =
  | {
      /** The source transaction's hash, or a Solana signature. */
      txHash: string;
      userOpHash?: never;
      sponsorshipRequestId?: string;
      /** The connected wallet, when the route executed from a smart account. */
      eoaAddress?: string;
    }
  | {
      /** A sponsored ERC-4337 userOp's hash, committed as soon as the
       *  bundler accepts it. */
      userOpHash: string;
      txHash?: never;
      sponsorshipRequestId: string;
      eoaAddress?: string;
    };

/** A commit together with the route intent it is for. */
export type ReceiptReport = ReceiptCommit & { intentId: string };

/** A receipt that commits a transaction hash or Solana signature. */
export type TxReceiptReport = Extract<ReceiptReport, { txHash: string }>;

/** A receipt that commits a sponsored userOp's hash. */
export type UserOpReceiptReport = Extract<
  ReceiptReport,
  { userOpHash: string }
>;

/** The hash a commit names. It is also the commit's `Idempotency-Key`. */
export function receiptHash(commit: ReceiptCommit): string {
  return commit.userOpHash === undefined ? commit.txHash : commit.userOpHash;
}

/** The fields that identify a receipt in a log line. */
export function receiptLogFields(
  report: ReceiptReport
):
  | { intentId: string; txHash: string }
  | { intentId: string; userOpHash: string } {
  return report.userOpHash === undefined
    ? { intentId: report.intentId, txHash: report.txHash }
    : { intentId: report.intentId, userOpHash: report.userOpHash };
}

/**
 * The refusal codes that mean "retry shortly". Every other code is final
 * (the commit handshake spec, quicklinks_v1
 * docs/plans/2026-10-23-bvt-251-commit-handshake.md, "Integrator contract").
 */
export const RETRYABLE_RECEIPT_CODES: readonly string[] = [
  "replacement_not_visible",
  "signature_still_valid",
  "tx_not_visible",
  "idempotency_key_in_flight",
];

/** The final code a commit gets when the backend has no such route intent. */
export const RECEIPT_CODE_ROUTE_INTENT_NOT_FOUND = "route_intent_not_found";

/**
 * A commit the backend refused with a `code`. Branch on `code`, never on
 * the message: `retryable` is true exactly for `RETRYABLE_RECEIPT_CODES`,
 * and any other code, including one newer than this SDK, is final.
 */
export class ReceiptCommitError extends HttpError {
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, serverMessage: string, code: string) {
    super(status, serverMessage);
    this.name = "ReceiptCommitError";
    this.message = `HTTP ${status} (${code}): ${serverMessage}`;
    this.code = code;
    this.retryable = RETRYABLE_RECEIPT_CODES.includes(code);
  }
}

function commitBody(report: ReceiptReport): Record<string, string> {
  const body: Record<string, string> =
    report.userOpHash === undefined
      ? { txHash: report.txHash }
      : {
          userOpHash: report.userOpHash,
          sponsorshipRequestId: report.sponsorshipRequestId,
        };
  if (report.userOpHash === undefined && report.sponsorshipRequestId) {
    body.sponsorshipRequestId = report.sponsorshipRequestId;
  }
  if (report.eoaAddress) body.eoaAddress = report.eoaAddress;
  return body;
}

/**
 * Throws the refusal a non-2xx commit response carries: a
 * `ReceiptCommitError` when the body names a `code`, otherwise a plain
 * `HttpError` (a 5xx, or a refusal from the API-key middleware in front of
 * the handler).
 */
async function throwCommitRefusal(r: Response): Promise<never> {
  let body: unknown;
  try {
    body = await r.json();
  } catch {
    // Not JSON (a proxy's error page): only the status line is left.
  }
  const fields =
    body !== null && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  const message =
    typeof fields.error === "string" && fields.error !== ""
      ? fields.error
      : r.statusText;
  if (typeof fields.code === "string" && fields.code !== "") {
    throw new ReceiptCommitError(r.status, message, fields.code);
  }
  throw new HttpError(r.status, message);
}

/**
 * Commit a receipt. Retrying the same commit is safe: the backend answers
 * 200 with the same `transaction_id` for a hash it already holds, and the
 * `Idempotency-Key` (the hash) replays the first response exactly.
 */
export async function commitReceipt(report: ReceiptReport) {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/route-intent/${report.intentId}/receipt`,
    {
      method: "POST",
      headers: jsonHeaders({ "Idempotency-Key": receiptHash(report) }),
      body: JSON.stringify(commitBody(report)),
    }
  );
  if (!r.ok) await throwCommitRefusal(r);
  const j = await r.json();
  return j.data;
}

/**
 * Commit the transaction hash (or Solana signature) a host sent for
 * `intentId`. A refusal throws `ReceiptCommitError`; read its `code`.
 */
export async function submitReceipt(
  intentId: string,
  txHash: string,
  sponsorshipRequestId?: string,
  /** Connected wallet (EOA) that originated the payment. Pass when the route
   *  executes from a smart account, so the backend records the tx against the
   *  address the user actually connects with. */
  eoaAddress?: string
) {
  return commitReceipt({ intentId, txHash, sponsorshipRequestId, eoaAddress });
}
