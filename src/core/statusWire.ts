import type { IntentExecutionStep, Transaction } from "../types";
import {
  ResponseShapeError,
  optionalBoolean,
  optionalNumber,
  optionalString,
  optionalStringOrNumber,
  readArray,
  readObject,
  requireNumber,
  requireOneOf,
  requireString,
  type WireObject,
} from "./wire";

/**
 * Parsers for the `/route-intent` bodies of the v2 API: the committed and the
 * uncommitted status shapes, and the step the step-receipt endpoint answers
 * with. Wire names are the API's (`sourceTxHash`); the SDK's names are the
 * keys of `Transaction` and `IntentExecutionStep`. Where the two differ
 * (`createDate` is `createdDate`, `quoteToAmountUsd` is `quoteToAmountUSD`),
 * the tables below are the one place that says so.
 */

const STATUS_SOURCE = "GET /route-intent/{id}/status";
export const STEP_RECEIPT_SOURCE =
  "POST /route-intent/{id}/steps/{index}/receipt";

/** Wire name to `Transaction` key, per value type. */
const TRANSACTION_STRING_FIELDS = {
  id: "id",
  projectId: "projectId",
  sdkApiKeyId: "sdkApiKeyId",
  fromAddress: "fromAddress",
  toAddress: "toAddress",
  originEoa: "originEoa",
  requestId: "requestId",
  providerRequestId: "providerRequestId",
  providerQuoteId: "providerQuoteId",
  senderVerification: "senderVerification",
  senderVerificationDetail: "senderVerificationDetail",
  routingProvider: "routingProvider",
  sourceTxHash: "sourceTxHash",
  destTxHash: "destTxHash",
  expiresAt: "expiresAt",
  intentStatus: "intentStatus",
  quoteToAmountUsd: "quoteToAmountUSD",
  fromChainTxUrl: "fromChainTxUrl",
  toChainTxUrl: "toChainTxUrl",
  gasStatus: "gasStatus",
  axelarTransactionUrl: "axelarTransactionUrl",
  nextPollAt: "nextPollAt",
  updateDate: "updatedDate",
  sponsorshipRequestId: "sponsorshipRequestId",
  sponsorshipStatus: "sponsorshipStatus",
  paymasterRuleId: "paymasterRuleId",
  paymasterAddress: "paymasterAddress",
  approvedSponsoredGasUsd: "approvedSponsoredGasUSD",
  gasSponsoredUsd: "gasSponsoredUSD",
  actualSponsoredGasUsd: "actualSponsoredGasUSD",
  approvedSponsoredGasWei: "approvedSponsoredGasWei",
  actualSponsoredGasWei: "actualSponsoredGasWei",
  sponsorshipUserOperationHash: "sponsorshipUserOperationHash",
} as const satisfies Record<string, keyof Transaction>;

const TRANSACTION_NUMBER_FIELDS = {
  fromChainBlock: "fromChainBlock",
  toChainBlock: "toChainBlock",
  timeSpentMs: "timeSpentMs",
  pollAttempt: "pollAttempt",
} as const satisfies Record<string, keyof Transaction>;

const TRANSACTION_BOOLEAN_FIELDS = {
  sdkRequest: "sdkRequest",
  isGmpTransaction: "isGMPTransaction",
  landedAmountVerified: "landedAmountVerified",
  refunded: "refunded",
  gasSponsored: "gasSponsored",
} as const satisfies Record<string, keyof Transaction>;

/** Ids and amounts that are strings on the wire, with a number tolerated. */
const TRANSACTION_STRING_OR_NUMBER_FIELDS = {
  fromChainId: "fromChainId",
  toChainId: "toChainId",
  toAmountWei: "toAmountWei",
} as const satisfies Record<string, keyof Transaction>;

/** Provider payloads: only the field name is the API's, the content is not. */
const TRANSACTION_PAYLOAD_FIELDS = {
  transactionRequest: "transactionRequest",
  statusRaw: "statusRaw",
  routePath: "routePath",
  routeStatus: "routeStatus",
} as const satisfies Record<string, keyof Transaction>;

function copyFields<K extends string>(
  wire: WireObject,
  out: Record<string, unknown>,
  table: Record<K, string>,
  read: (wire: WireObject, key: string) => unknown
) {
  for (const wireKey of Object.keys(table) as K[]) {
    const value = read(wire, wireKey);
    if (value !== undefined) out[table[wireKey]] = value;
  }
}

/**
 * Parses a status payload. Both shapes carry `status`, `intentId` and
 * `createDate`; everything else is optional because a `"pending"` payload is
 * a stub, and a committed one omits what the backend has not learned yet.
 */
export function parseTransactionStatus(raw: unknown): Transaction {
  const wire = readObject(raw, STATUS_SOURCE, "data");
  const out: Record<string, unknown> = {
    status: requireString(wire, "status", STATUS_SOURCE),
    intentId: requireString(wire, "intentId", STATUS_SOURCE),
    createdDate: requireString(wire, "createDate", STATUS_SOURCE),
  };

  copyFields(wire, out, TRANSACTION_STRING_FIELDS, (w, key) =>
    optionalString(w, key, STATUS_SOURCE)
  );
  copyFields(wire, out, TRANSACTION_NUMBER_FIELDS, (w, key) =>
    optionalNumber(w, key, STATUS_SOURCE)
  );
  copyFields(wire, out, TRANSACTION_BOOLEAN_FIELDS, (w, key) =>
    optionalBoolean(w, key, STATUS_SOURCE)
  );
  copyFields(wire, out, TRANSACTION_STRING_OR_NUMBER_FIELDS, (w, key) =>
    optionalStringOrNumber(w, key, STATUS_SOURCE)
  );
  copyFields(wire, out, TRANSACTION_PAYLOAD_FIELDS, (w, key) =>
    key in w ? w[key] : undefined
  );

  if ("steps" in wire) {
    out.steps = readArray(wire.steps, STATUS_SOURCE, "steps").map(
      (step, index) =>
        parseExecutionStep(step, STATUS_SOURCE, `steps[${index}]`)
    );
  }

  // Every field Transaction requires is set above, and each optional one was
  // type-checked on the way in.
  return out as Transaction;
}

const STEP_KINDS = [
  "approve",
  "main",
] as const satisfies readonly IntentExecutionStep["stepKind"][];
const STEP_STATUSES = [
  "planned",
  "submitted",
  "confirmed",
  "failed",
  "skipped",
] as const satisfies readonly IntentExecutionStep["status"][];

/** One step of an intent's execution plan. */
export function parseExecutionStep(
  raw: unknown,
  source: string,
  path: string
): IntentExecutionStep {
  const wire = readObject(raw, source, path);
  const at = (key: string) => `${path}.${key}`;
  const step: IntentExecutionStep = {
    stepIndex: requireNumber(wire, "stepIndex", source, at("stepIndex")),
    stepKind: requireOneOf(
      wire,
      "stepKind",
      STEP_KINDS,
      source,
      at("stepKind")
    ),
    chainId: requireString(wire, "chainId", source, at("chainId")),
    status: requireOneOf(wire, "status", STEP_STATUSES, source, at("status")),
    createdDate: requireString(wire, "createDate", source, at("createDate")),
    updatedDate: requireString(wire, "updateDate", source, at("updateDate")),
  };
  const txHash = optionalString(wire, "txHash", source, at("txHash"));
  if (txHash !== undefined) step.txHash = txHash;
  if ("detail" in wire) {
    const detail = readObject(wire.detail, source, at("detail"));
    for (const key of ["token", "spender", "amount"]) {
      optionalString(detail, key, source, `${at("detail")}.${key}`);
    }
    // The three named keys were just checked; any others are the plan's own.
    step.detail = detail as IntentExecutionStep["detail"];
  }
  return step;
}

/** The answer of the step-receipt endpoint. */
export type StepReceiptResult = { ok: true; step: IntentExecutionStep };

export function parseStepReceiptResult(raw: unknown): StepReceiptResult {
  const wire = readObject(raw, STEP_RECEIPT_SOURCE, "data");
  if (wire.ok !== true) {
    throw new ResponseShapeError(STEP_RECEIPT_SOURCE, "ok", "true", wire.ok);
  }
  return {
    ok: true,
    step: parseExecutionStep(wire.step, STEP_RECEIPT_SOURCE, "step"),
  };
}
