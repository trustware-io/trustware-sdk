/* core/routes.ts */
import { apiBase, jsonHeaders, assertOK } from "./http";
import type { BuildRouteResult, RouteParams, Transaction } from "../types";

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
export async function buildRoute(p: RouteParams): Promise<BuildRouteResult> {
  const r = await fetch(`${apiBase()}/squid/route`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "omit",
    body: JSON.stringify(p),
  });
  await assertOK(r);
  const j = await r.json();
  return j.data as BuildRouteResult;
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
  const r = await fetch(`${apiBase()}/route-intent/${intentId}/receipt`, {
    method: "POST",
    headers: jsonHeaders({ "Idempotency-Key": txHash }),
    body: JSON.stringify({ txHash }),
  });
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
  const r = await fetch(`${apiBase()}/route-intent/${intentId}/status`, {
    headers: jsonHeaders(),
  });
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
  { intervalMs = 2000, timeoutMs = 5 * 60_000 } = {},
): Promise<Transaction> {
  const t0 = Date.now();
  while (true) {
    const tx = await getStatus(intentId);
    if (tx.status === "success" || tx.status === "failed") return tx;
    if (Date.now() - t0 > timeoutMs) return tx;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
