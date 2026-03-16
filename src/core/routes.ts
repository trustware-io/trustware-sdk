/* core/routes.ts */
import { apiBase, jsonHeaders, assertOK, rateLimitedFetch } from "./http";
import type {
  BuildRouteResult,
  RouteParams,
  RoutePlan,
  Transaction,
} from "../types";
import { TrustwareConfigStore } from "src/config/store";

export type BuildRouteBody = {
  fromChain: string; // e.g. "43114"
  toChain: string; // link.chain_id
  fromToken: string;
  toToken: string;
  fromAmount: string; // wei string
  fromAddress: string;
  toAddress: string;
  fromAmountUsd?: string; // optional USD string
  refundAddress?: string;
  slippage?: number; // bps or %
  linkId?: string; // optional link identifier
  // optional passthrough:
  memo?: string;
};

export type TxRequest = {
  to?: string;
  target?: string;
  data: string;
  value?: string; // wei string
  gasLimit?: string; // wei string
  maxFeePerGas?: string; // wei string
  maxPriorityFeePerGas?: string; // wei string
  chainId?: number | string; // sometimes provided by BE
  gasPrice?: string; // wei string, legacy gas price (optional if EIP-1559 fields are present)
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

// @title Build Route
// @description Builds a cross-chain or same-chain route based on the provided parameters. Returns a RouteIntent object containing details of the route.
// @param {RouteParams} p - The parameters for building the route.
// @param RouteParams.fromChain - The source chain identifier (e.g., "ethereum", "bsc").
// @param RouteParams.toChain - The destination chain identifier (e.g., "polygon", "avalanche").
// @param RouteParams.fromToken - The token address or symbol on the source chain.
// @param RouteParams.toToken - The token address or symbol on the destination chain.
// @param RouteParams.fromAmount - The amount of the source token to be transferred (in smallest unit, e.g., wei).
// @param RouteParams.fromAddress - The address on the source chain from which the tokens will be sent.
// @param RouteParams.toAddress - The address on the destination chain to which the tokens will be sent.
// @param RouteParams.slippage - (Optional) The maximum acceptable slippage percentage for the swap (default is 0.5%).
// @returns {Promise<RouteIntent>} - A promise that resolves to a RouteIntent object.
// @throws {Error} - Throws an error if the API request fails or if the response is invalid.
// @example
// const routeParams = {
//   fromChain: 'ethereum',
//   toChain: 'polygon',
//   fromToken: 'ETH',
//   toToken: 'MATIC',
//   fromAmount: '1000000000000000000', // 1 ETH in wei
//   fromAddress: '0xYourSourceAddress',
//   toAddress: '0xYourDestinationAddress',
//   slippage: 0.5, // Optional
//   };
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
  // backendBase: string,
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
  const cfg = TrustwareConfigStore.get();
  const url = `${apiBase()}/routes/route`;
  const payload = {
    ...body,
    slippageBps:
      body.slippage === undefined ? undefined : Math.round(body.slippage * 100),
    fromAmountUSD: body.fromAmountUsd,
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
    toAmountMinUSD: estimate?.toAmountUsd,
  };

  if (!txReq?.data || !(txReq?.to || txReq?.target)) {
    throw new Error("Invalid route: missing transactionRequest target/data");
  }

  return { intentId, txReq, actions, finalExchangeRate, route };
}

// @title Submit Receipt
// @description Submits a transaction receipt for a previously created route intent. This function is used to inform the system of the transaction hash associated with the route intent.
// @param {string} intentId - The unique identifier of the route intent.
// @param {string} txHash - The transaction hash of the submitted transaction.
// @returns {Promise<any>} - A promise that resolves to the response data from the API.
// @throws {Error} - Throws an error if the API request fails or if the response is invalid.
// @example
// const intentId = 'your-route-intent-id';
// const txHash = '0xYourTransactionHash';
// const receiptResponse = await submitReceipt(intentId, txHash);
export async function submitReceipt(intentId: string, txHash: string) {
  const r = await rateLimitedFetch(
    `${apiBase()}/route-intent/${intentId}/receipt`,
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

// @title Get Route Intent Status
// @description Retrieves the current status of a route intent based on its unique identifier. This function is used to check the progress of a cross-chain or same-chain transaction.
// @param {string} intentId - The unique identifier of the route intent.
// @returns {Promise<Transaction>} - A promise that resolves to a Transaction object containing the status and details of the route intent.
// @throws {Error} - Throws an error if the API request fails or if the response is invalid.
// @example
// const intentId = 'your-route-intent-id';
// const transactionStatus = await getStatus(intentId);
export async function getStatus(intentId: string): Promise<Transaction> {
  const r = await rateLimitedFetch(
    `${apiBase()}/route-intent/${intentId}/status`,
    {
      headers: jsonHeaders(),
    }
  );
  await assertOK(r);
  const j = await r.json();
  return j.data as Transaction;
}

// @title Poll Route Intent Status
// @description Polls the status of a route intent at regular intervals until it reaches a terminal state (success or failed) or a timeout occurs. This function is useful for monitoring the progress of a transaction.
// @param {string} intentId - The unique identifier of the route intent.
// @param {Object} [options] - Optional parameters for polling.
// @param {number} [options.intervalMs=2000] - The interval in milliseconds between each status check (default is 2000ms).
// @param {number} [options.timeoutMs=300000] - The maximum time in milliseconds to wait before timing out (default is 300000ms or 5 minutes).
// @returns {Promise<Transaction>} - A promise that resolves to a Transaction object containing the final status and details of the route intent.
// @throws {Error} - Throws an error if the API request fails during polling.
// @example
// const intentId = 'your-route-intent-id';
// const finalStatus = await pollStatus(intentId, { intervalMs: 3000, timeoutMs: 600000 });
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
