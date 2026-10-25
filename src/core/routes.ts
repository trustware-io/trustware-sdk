import { apiBase, jsonHeaders, assertOK, rateLimitedFetch } from "./http";
import { routeErrorFromResponse } from "./routeError";
import { assertRouteDeliversValue } from "./routeValue";
import { parseRouteExpiresAt, parseServerClockOffsetMs } from "./routeExpiry";
import type {
  BuildRouteResult,
  PostHookRequest,
  RoutePlan,
  RouteSponsorship,
  Transaction,
  VaultDepositRequest,
} from "../types";
import { TrustwareConfigStore } from "src/config/store";
import { validateRouteAddresses } from "../validation/address";
import {
  isNativeTokenAddress,
  NATIVE_SOLANA,
  normalizeChainType,
} from "../utils/chains";

/**
 * Names a token the way the routing API expects. On a Solana chain every
 * native-SOL spelling becomes `NATIVE_SOLANA`, the System Program id, and an
 * SPL mint passes through trimmed. iluvatar maps the System Program id onto
 * each routing provider's own spelling. Other chains pass through untouched:
 * the EVM sentinel is already right there.
 *
 * Never the wrapped-SOL mint (`So1111…112`): wSOL is a separate SPL token you
 * only hold once you've wrapped, and routing it for a native-SOL swap spends
 * a balance the caller doesn't have.
 */
export function canonicalRouteToken(
  address: string | undefined,
  chain: string | number | undefined
): string {
  // normalizeChainType treats a non-string as a ChainDef and reads .type /
  // .chainId off it, so a numeric chain id resolves to undefined and would
  // skip the mapping entirely. Convert before inferring.
  const chainType = normalizeChainType(
    chain === undefined || chain === null ? undefined : String(chain)
  );
  if (chainType !== "solana") return address ?? "";
  if (!address) return NATIVE_SOLANA;
  if (isNativeTokenAddress(address, chainType)) {
    return NATIVE_SOLANA;
  }
  return address.trim();
}

export type BuildRouteBody = {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
  fromAmountUsd?: string;
  fromAmountUSD?: string;
  refundAddress?: string;
  direction?: string;
  slippage?: number;
  slippageBps?: number;
  linkId?: string;
  memo?: string;
  /**
   * Optional bridge-and-call: execute a contract call on the destination
   * chain right after funds land, instead of a plain wallet transfer (e.g.
   * depositing into a vault in the same flow). Fully optional and backward
   * compatible — omit `hooks` entirely and nothing changes.
   */
  hooks?: { postHook?: PostHookRequest };
  /**
   * Deposit into a vault as the route's destination action (BVT-398), in
   * place of a hand-assembled `hooks.postHook`. Optional and backward
   * compatible — omit entirely and nothing changes. Mutually exclusive with
   * `hooks`; see {@link VaultDepositRequest}.
   */
  vault?: VaultDepositRequest;
};

/**
 * Validates a `BuildRouteBody.hooks` value before it's sent, so a malformed
 * postHook fails fast client-side instead of round-tripping to the backend.
 * A no-op when `hooks`/`hooks.postHook` is omitted. Exported so callers can
 * validate a postHook ahead of time (e.g. in their own form validation).
 */
export function assertValidPostHook(hooks: BuildRouteBody["hooks"]) {
  const postHook = hooks?.postHook;
  if (!postHook) return;
  if (!postHook.target?.trim()) {
    throw new Error("hooks.postHook.target is required.");
  }
  if (!postHook.callData?.trim()) {
    throw new Error("hooks.postHook.callData is required.");
  }
  if (postHook.fullAmount) {
    if (postHook.amountInputPos === undefined) {
      throw new Error(
        "hooks.postHook.amountInputPos is required when fullAmount is true."
      );
    }
  } else if (!postHook.fundAmount?.trim()) {
    throw new Error(
      "hooks.postHook.fundAmount is required unless fullAmount is set."
    );
  }
}

/**
 * Validates a `BuildRouteBody.vault` value before it's sent — the same
 * fail-fast-client-side intent as {@link assertValidPostHook}. A no-op when
 * `vault` is omitted or `hooks.postHook` isn't also set (the backend enforces
 * the same mutual exclusivity; this just avoids the round trip).
 */
export function assertValidVaultRequest(body: {
  vault?: BuildRouteBody["vault"];
  hooks?: BuildRouteBody["hooks"];
}) {
  if (!body.vault) return;
  if (!body.vault.vaultId?.trim()) {
    throw new Error("vault.vaultId is required.");
  }
  if (!body.vault.network?.trim()) {
    throw new Error("vault.network is required.");
  }
  if (body.hooks?.postHook) {
    throw new Error(
      "vault and hooks are mutually exclusive: a vault deposit builds its own postHook."
    );
  }
}

/**
 * The slippage a route request asks for, in basis points: the figure the
 * routing API receives as `slippageBps`. An explicit `slippageBps` wins over
 * the percentage `slippage`. Undefined when the request names neither, which
 * leaves the choice to the backend.
 */
export function requestSlippageBps(
  body: Pick<BuildRouteBody, "slippage" | "slippageBps">
): number | undefined {
  if (body.slippageBps !== undefined) return body.slippageBps;
  if (body.slippage === undefined) return undefined;
  return Math.round(body.slippage * 100);
}

export type TxRequest = {
  to?: string;
  target?: string;
  data: string;
  value?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: number | string;
  gasPrice?: string;
};

export type BuildRouteResponse = {
  intentId?: string;
  /** RFC 3339. Parsed into `BuildRouteResult.expiresAt`. */
  expiresAt?: string;
  route?: RoutePlan;
  sponsorship?: RouteSponsorship;
  data?: {
    intentId?: string;
    expiresAt?: string;
    route?: RoutePlan;
    sponsorship?: RouteSponsorship;
  };
  error?: string;
  message?: string;
};

type DepositAddress = {
  address?: string;
  memo?: string;
  expiresAt?: string;
};

type BuildDepositAddressResponse = {
  depositAddress?: DepositAddress;
  intentId?: string;
  expiresAt?: string;
  route?: RoutePlan;
  data?: {
    depositAddress?: DepositAddress;
    intentId?: string;
    expiresAt?: string;
    route?: RoutePlan;
  };
  error?: string;
  message?: string;
};

export function isEvmTxRequest(txReq?: TxRequest | null) {
  return Boolean(txReq?.data && (txReq.to || txReq.target));
}

export function isSerializedSolanaTxRequest(txReq?: TxRequest | null) {
  return Boolean(txReq?.data && !txReq?.to && !txReq?.target);
}

export async function buildRoute(
  body: BuildRouteBody,
  signal?: AbortSignal
): Promise<BuildRouteResult> {
  const addressValidation = validateRouteAddresses({
    fromChain: body.fromChain,
    toChain: body.toChain,
    fromAddress: body.fromAddress,
    toAddress: body.toAddress,
    refundAddress: body.refundAddress,
    direction: body.direction,
  });
  if (!addressValidation.isValid) {
    throw new Error(addressValidation.error || "Invalid route addresses.");
  }
  assertValidPostHook(body.hooks);
  assertValidVaultRequest(body);

  const cfg = TrustwareConfigStore.get();
  const url = `${apiBase()}/v1/routes/route`;
  const payload = {
    ...body,
    fromToken: canonicalRouteToken(body.fromToken, body.fromChain),
    toToken: canonicalRouteToken(body.toToken, body.toChain),
    slippageBps: requestSlippageBps(body),
    fromAmountUSD: body.fromAmountUSD ?? body.fromAmountUsd,
  };
  const r = await rateLimitedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": cfg.apiKey },
    body: JSON.stringify(payload),
    signal,
  });
  const receivedAtMs = Date.now();

  let json: BuildRouteResponse = {};
  try {
    json = await r.json();
  } catch {
    // response body not JSON
  }

  if (!r.ok) {
    // Structured, not just a sentence: the API says which provider is out and
    // why (see RouteError). `message` is unchanged, so callers reading it keep
    // working.
    throw routeErrorFromResponse(r.status, json, "Failed to build route");
  }

  const intentId = json?.data?.intentId ?? json?.intentId ?? "";
  const route = json?.data?.route ?? json?.route;
  const txReq: TxRequest | undefined = route?.execution?.transaction;
  const actions = Array.isArray(route?.steps) ? route.steps : [];
  const estimate = route?.estimate ?? {};
  const sponsorship = json?.data?.sponsorship ?? json?.sponsorship ?? undefined;

  const finalExchangeRate = {
    fromAmountUSD: (estimate as { fromAmountUsd?: string }).fromAmountUsd,
    toAmountMinUSD: estimate?.toAmountMinUsd ?? estimate?.toAmountUsd,
  };

  if (!txReq?.data) {
    throw new Error("Invalid route: missing transaction data");
  }
  const expiresAt = parseRouteExpiresAt(
    json?.data?.expiresAt ?? json?.expiresAt,
    intentId
  );
  const serverClockOffsetMs = parseServerClockOffsetMs(
    r.headers.get("Date"),
    receivedAtMs,
    intentId
  );
  // The backend scores on net_usd but still returns the best of a bad set.
  // Refused here, on the way in, so no consumer ever holds a losing route.
  assertRouteDeliversValue(route);

  return {
    intentId,
    txReq,
    actions,
    finalExchangeRate,
    route,
    sponsorship,
    expiresAt,
    serverClockOffsetMs,
  };
}

export async function buildDepositAddress(
  body: BuildRouteBody,
  signal?: AbortSignal
): Promise<{
  intentId: string;
  depositAddress: string;
  actions: unknown[];
  finalExchangeRate: {
    fromAmountUSD?: string;
    toAmountMinUSD?: string;
  };
  route: RoutePlan | undefined;
  /** When the route intent stops being usable, in the server's time.
   *  Send to the deposit address before then. */
  expiresAt: Date;
  /** How far the server's clock was ahead of this device's when the
   *  response arrived (its `Date` header). */
  serverClockOffsetMs: number;
}> {
  assertValidPostHook(body.hooks);
  assertValidVaultRequest(body);
  const cfg = TrustwareConfigStore.get();
  const url = `${apiBase()}/v1/routes/deposit-address`;
  const payload = {
    ...body,
    fromToken: canonicalRouteToken(body.fromToken, body.fromChain),
    toToken: canonicalRouteToken(body.toToken, body.toChain),
    slippageBps: requestSlippageBps(body),
    fromAmountUSD: body.fromAmountUSD ?? body.fromAmountUsd,
  };
  const r = await rateLimitedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": cfg.apiKey },
    body: JSON.stringify(payload),
    signal,
  });
  const receivedAtMs = Date.now();

  let json: BuildDepositAddressResponse = {};
  try {
    json = await r.json();
  } catch {
    // response body not JSON
  }

  if (!r.ok) {
    throw routeErrorFromResponse(
      r.status,
      json,
      "Failed to build deposit address"
    );
  }

  const intentId = json?.data?.intentId ?? json?.intentId ?? "";
  const route = json?.data?.route ?? json?.route;
  const depositAddress =
    json?.data?.depositAddress?.address ?? json?.depositAddress?.address ?? "";
  const actions = Array.isArray(route?.steps) ? route.steps : [];
  const estimate = route?.estimate ?? {};
  if (!depositAddress) {
    throw new Error("Invalid route: missing deposit address");
  }
  const expiresAt = parseRouteExpiresAt(
    json?.data?.expiresAt ?? json?.expiresAt,
    intentId
  );
  const serverClockOffsetMs = parseServerClockOffsetMs(
    r.headers.get("Date"),
    receivedAtMs,
    intentId
  );
  assertRouteDeliversValue(route);

  return {
    intentId,
    depositAddress,
    actions,
    finalExchangeRate: {
      fromAmountUSD: (estimate as { fromAmountUsd?: string }).fromAmountUsd,
      toAmountMinUSD: estimate?.toAmountMinUsd ?? estimate?.toAmountUsd,
    },
    route,
    expiresAt,
    serverClockOffsetMs,
  };
}

/**
 * Reports the submitted tx hash for one execution step of a multi-step
 * route — approve steps only; the main tx keeps going through
 * `submitReceipt` (core/receipt.ts). `stepIndex` is the step's position in
 * `route.execution.approvals` (the backend seeds its step plan in the same
 * order). Best-effort telemetry: callers fire-and-forget so a failed report
 * never blocks the payment flow, but a successful one lets the backend tell
 * "approve landed, main never followed" apart from an intent the user
 * abandoned before signing anything.
 */
export async function submitStepReceipt(
  intentId: string,
  stepIndex: number,
  txHash: string
) {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/route-intent/${intentId}/steps/${stepIndex}/receipt`,
    {
      method: "POST",
      headers: jsonHeaders({ "Idempotency-Key": txHash }),
      body: JSON.stringify({ txHash }),
    }
  );
  await assertOK(r);
  const j = await r.json();
  return j.data;
}

/**
 * Fetches the current status for a route intent.
 *
 * Response contract:
 * - 404 (throws)              → intent doesn't exist. Stop polling.
 * - 200 status: "pending"     → intent exists, no receipt yet. Keep polling.
 * - 200 status: "submitted"   → receipt in, tx in flight. Keep polling.
 * - 200 status: "bridging"    → cross-chain leg in progress. Keep polling.
 * - 200 status: "success"/"failed"/"expired" → terminal. Stop polling.
 * - 200 any other status      → newer than this SDK. Keep polling.
 *
 * A "pending" payload is a stub ({intent_id, status, intent_status,
 * create_date, expiresAt}) — the full Transaction fields appear once a
 * receipt lands.
 */
export async function getStatus(intentId: string): Promise<Transaction> {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/route-intent/${intentId}/status`,
    {
      headers: jsonHeaders(),
    }
  );
  await assertOK(r);
  const j = await r.json();
  return normalizeStatusPayload(j.data);
}

/**
 * Wire (snake_case) → Transaction (camelCase) field names.
 *
 * `origin_eoa` and `landed_amount_verified` are absent on purpose: Transaction
 * spells those two in snake_case already, so they need no mapping.
 */
const STATUS_WIRE_TO_CAMEL: Record<string, keyof Transaction> = {
  intent_id: "intentId",
  from_address: "fromAddress",
  to_address: "toAddress",
  from_chain_id: "fromChainId",
  to_chain_id: "toChainId",
  source_tx_hash: "sourceTxHash",
  dest_tx_hash: "destTxHash",
  request_id: "requestId",
  provider_request_id: "providerRequestId",
  transaction_request: "transactionRequest",
  status_raw: "statusRaw",
  route_path: "routePath",
  route_status: "routeStatus",
  to_amount_wei: "toAmountWei",
  from_chain_block: "fromChainBlock",
  to_chain_block: "toChainBlock",
  from_chain_tx_url: "fromChainTxUrl",
  to_chain_tx_url: "toChainTxUrl",
  gas_status: "gasStatus",
  is_gmp_transaction: "isGMPTransaction",
  axelar_transaction_url: "axelarTransactionUrl",
  create_date: "createdDate",
  update_date: "updatedDate",
  time_spent_ms: "timeSpentMs",
};

/**
 * Maps the status payload onto the camelCase names `Transaction` advertises.
 *
 * The whole payload is snake_case on the wire (`source_tx_hash`, `intent_id`,
 * `create_date`, ...) while `Transaction` is camelCase, so without this every
 * documented field — `sourceTxHash`, `destTxHash`, `intentId`, the two
 * correlation IDs — reads undefined on whatever `getStatus`/`pollStatus`/
 * `runTopUp` hand back. Swap mode used to be the only path that worked,
 * because it re-mapped four of these itself (`normalizeTx` in
 * modes/swap/hooks/useSwapExecution.ts).
 *
 * The raw keys are kept — anything already reading `request_id` off this
 * object keeps working — an explicit camelCase key on the wire wins over the
 * snake_case one, and a missing field stays missing rather than becoming a
 * defined-but-undefined property, so `"requestId" in tx` still means what it
 * says.
 */
export function normalizeStatusPayload(raw: unknown): Transaction {
  if (!raw || typeof raw !== "object") return raw as Transaction;

  const wire = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...wire };

  for (const [snake, camel] of Object.entries(STATUS_WIRE_TO_CAMEL)) {
    if (out[camel] !== undefined) continue;
    if (!(snake in wire)) continue;
    out[camel] = wire[snake];
  }

  return out as Transaction;
}

/**
 * Polls intent status until terminal ("success"/"failed"/"expired") or
 * timeout. Every other status ("pending", "submitted", "bridging", or one
 * newer than this SDK) keeps the loop going; a 404 (unknown intent) throws
 * out of the loop — don't retry it.
 */
export async function pollStatus(
  intentId: string,
  { intervalMs = 2000, timeoutMs = 5 * 60_000 } = {}
): Promise<Transaction> {
  const t0 = Date.now();
  while (true) {
    const tx = await getStatus(intentId);
    if (isTerminalStatus(tx.status)) return tx;
    if (Date.now() - t0 > timeoutMs) return tx;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Whether a status ends tracking. Any status not named here, including
 *  one newer than this SDK, means "not finished". */
export function isTerminalStatus(status: Transaction["status"]): boolean {
  return status === "success" || status === "failed" || status === "expired";
}
