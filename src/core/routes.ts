import { apiBase, jsonHeaders, assertOK, rateLimitedFetch } from "./http";
import type {
  BuildRouteResult,
  PostHookRequest,
  RouteParams,
  RoutePlan,
  RouteSponsorship,
  Transaction,
} from "../types";
import { TrustwareConfigStore } from "src/config/store";
import { validateRouteAddresses } from "../validation/address";
import {
  isSolanaNativeTokenAlias,
  normalizeChainType,
} from "../widget/helpers/chainHelpers";

/**
 * Wrapped SOL. The only identifier routing providers actually accept for
 * native SOL — `So1111…111` makes LiFi answer `provider_error`, and the EVM
 * native sentinel routes through an aggregator whose transaction reverts
 * on-chain with `UnbalancedInstruction`.
 */
export const SOLANA_NATIVE_ROUTE_TOKEN =
  "So11111111111111111111111111111111111111112";

/**
 * Normalizes how a chain's native asset is named on the wire.
 *
 * Token registries describe native SOL three different ways — the EVM
 * sentinel `0xEeee…` (Squid's convention, and what the token list returns),
 * `So1111…111`, and the wrapped-SOL mint. Providers only route the last one
 * correctly, so pin it here rather than passing whichever spelling the
 * selected token happened to carry. Non-Solana chains are untouched: the EVM
 * sentinel is exactly right there.
 */
export function canonicalRouteToken(
  address: string | undefined,
  chain: string | number | undefined
): string {
  if (normalizeChainType(chain as string) !== "solana") return address ?? "";
  if (!address) return SOLANA_NATIVE_ROUTE_TOKEN;
  const trimmed = address.trim();
  if (
    isSolanaNativeTokenAlias(trimmed) ||
    trimmed === "0x0000000000000000000000000000000000000000"
  ) {
    return SOLANA_NATIVE_ROUTE_TOKEN;
  }
  return trimmed;
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
  route?: RoutePlan;
  sponsorship?: RouteSponsorship;
  data?: {
    intentId?: string;
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
  route?: RoutePlan;
  data?: {
    depositAddress?: DepositAddress;
    intentId?: string;
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

export async function buildRoute1(p: RouteParams): Promise<BuildRouteResult> {
  const r = await rateLimitedFetch(`${apiBase()}/squid/route`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "omit",
    body: JSON.stringify(p),
  });
  await assertOK(r);
  const j = await r.json();
  return j.data as BuildRouteResult;
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

  const cfg = TrustwareConfigStore.get();
  const url = `${apiBase()}/v1/routes/route`;
  const payload = {
    ...body,
    fromToken: canonicalRouteToken(body.fromToken, body.fromChain),
    toToken: canonicalRouteToken(body.toToken, body.toChain),
    slippageBps:
      body.slippageBps ??
      (body.slippage === undefined
        ? undefined
        : Math.round(body.slippage * 100)),
    fromAmountUSD: body.fromAmountUSD ?? body.fromAmountUsd,
  };
  const r = await rateLimitedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": cfg.apiKey },
    body: JSON.stringify(payload),
    signal,
  });

  let json: BuildRouteResponse = {};
  try {
    json = await r.json();
  } catch {
    // response body not JSON
  }

  if (!r.ok) {
    const msg = json?.error || json?.message || "Failed to build route";
    throw new Error(msg);
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

  return { intentId, txReq, actions, finalExchangeRate, route, sponsorship };
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
}> {
  assertValidPostHook(body.hooks);
  const cfg = TrustwareConfigStore.get();
  const url = `${apiBase()}/v1/routes/deposit-address`;
  const payload = {
    ...body,
    fromToken: canonicalRouteToken(body.fromToken, body.fromChain),
    toToken: canonicalRouteToken(body.toToken, body.toChain),
    slippageBps:
      body.slippageBps ??
      (body.slippage === undefined
        ? undefined
        : Math.round(body.slippage * 100)),
    fromAmountUSD: body.fromAmountUSD ?? body.fromAmountUsd,
  };
  const r = await rateLimitedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": cfg.apiKey },
    body: JSON.stringify(payload),
    signal,
  });

  let json: BuildDepositAddressResponse = {};
  try {
    json = await r.json();
  } catch {
    // response body not JSON
  }

  if (!r.ok) {
    const msg =
      json?.error || json?.message || "Failed to build deposit address";
    throw new Error(msg);
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

  return {
    intentId,
    depositAddress,
    actions,
    finalExchangeRate: {
      fromAmountUSD: (estimate as { fromAmountUsd?: string }).fromAmountUsd,
      toAmountMinUSD: estimate?.toAmountMinUsd ?? estimate?.toAmountUsd,
    },
    route,
  };
}

export async function submitReceipt(
  intentId: string,
  txHash: string,
  sponsorshipRequestId?: string,
  /** Connected wallet (EOA) that originated the payment. Pass when the route
   *  executes from a smart account, so the backend records the tx against the
   *  address the user actually connects with. */
  eoaAddress?: string
) {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/route-intent/${intentId}/receipt`,
    {
      method: "POST",
      headers: jsonHeaders({ "Idempotency-Key": txHash }),
      body: JSON.stringify({
        txHash,
        ...(sponsorshipRequestId ? { sponsorshipRequestId } : {}),
        ...(eoaAddress ? { eoaAddress } : {}),
      }),
    }
  );
  await assertOK(r);
  const j = await r.json();
  return j.data;
}

/**
 * Reports the submitted tx hash for one execution step of a multi-step
 * route — approve steps only; the main tx keeps going through
 * `submitReceipt`. `stepIndex` is the step's position in
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
 * - 200 status: "success"/"failed" → terminal. Stop polling.
 *
 * A "pending" payload is a stub ({intent_id, status, intent_status,
 * create_date}) — the full Transaction fields appear once a receipt lands.
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
 * Polls intent status until terminal ("success"/"failed") or timeout.
 * Non-terminal statuses ("pending", "submitted", "bridging") keep the loop
 * going; a 404 (unknown intent) throws out of the loop — don't retry it.
 */
export async function pollStatus(
  intentId: string,
  { intervalMs = 2000, timeoutMs = 5 * 60_000 } = {}
): Promise<Transaction> {
  const t0 = Date.now();
  while (true) {
    const tx = await getStatus(intentId);
    if (tx.status === "success" || tx.status === "failed") return tx;
    if (Date.now() - t0 > timeoutMs) return tx;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
