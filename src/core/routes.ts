import { apiBase, jsonHeaders, assertOK, rateLimitedFetch } from "./http";
import type {
  BuildRouteResult,
  RouteParams,
  RoutePlan,
  Transaction,
} from "../types";
import { TrustwareConfigStore } from "src/config/store";
import { validateRouteAddresses } from "../validation/address";

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
};

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
  data?: {
    intentId?: string;
    route?: RoutePlan;
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
): Promise<{
  intentId: string;
  txReq: TxRequest;
  actions: unknown[];
  finalExchangeRate: {
    fromAmountUSD?: string;
    toAmountMinUSD?: string;
  };
  route: RoutePlan | undefined;
}> {
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

  const cfg = TrustwareConfigStore.get();
  const url = `${apiBase()}/v1/routes/route`;
  const payload = {
    ...body,
    slippageBps:
      body.slippageBps ??
      (body.slippage === undefined ? undefined : Math.round(body.slippage * 100)),
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

  const finalExchangeRate = {
    fromAmountUSD: (estimate as { fromAmountUsd?: string }).fromAmountUsd,
    toAmountMinUSD: estimate?.toAmountMinUsd ?? estimate?.toAmountUsd,
  };

  if (!txReq?.data) {
    throw new Error("Invalid route: missing transaction data");
  }

  return { intentId, txReq, actions, finalExchangeRate, route };
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
  const cfg = TrustwareConfigStore.get();
  const url = `${apiBase()}/v1/routes/deposit-address`;
  const payload = {
    ...body,
    slippageBps:
      body.slippageBps ??
      (body.slippage === undefined ? undefined : Math.round(body.slippage * 100)),
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
    const msg = json?.error || json?.message || "Failed to build deposit address";
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

export async function submitReceipt(intentId: string, txHash: string) {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/route-intent/${intentId}/receipt`,
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

export async function getStatus(intentId: string): Promise<Transaction> {
  const r = await rateLimitedFetch(
    `${apiBase()}/v1/route-intent/${intentId}/status`,
    {
      headers: jsonHeaders(),
    }
  );
  await assertOK(r);
  const j = await r.json();
  return j.data as Transaction;
}

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
