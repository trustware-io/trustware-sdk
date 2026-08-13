import { TxRequest } from "src/core/routes";

export type RouteParams = {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string | number;
  fromAddress: string;
  toAddress: string;
  slippage?: number;
};

export type RouteIntent = {
  id: string;
  fromChainId: string | number;
  toChainId: string | number;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  toAddress: string;
  fromAmountWei: string | number;
  quoteToAmountWei: string | number;
  minToAmountWei: string | number;
  /** Trustware's own request ID (a UUID) for the call that created this
   *  intent — the same value the response carried in `X-Request-Id`, so it is
   *  the ID to quote in a Trustware support request. Wire field:
   *  `request_id`. Absent on intents created before it was split from
   *  `providerRequestId`. */
  requestId?: string;
  /** The routing provider's own correlation ID: Squid `requestId`, LiFi/Relay
   *  route id, or Khalani's `{quoteId,routeId}` composite — the ID *that
   *  provider's* status API and support recognise. Wire field:
   *  `provider_request_id`. Absent when the winning provider returned none. */
  providerRequestId?: string;
  routeRaw?: unknown;
  status: "created" | "submitted" | "bridging" | "success" | "failed";
  createdDate: Date | string;
  updatedDate: Date | string;
};

/**
 * A status payload from `getStatus`/`pollStatus`.
 *
 * Every field except `status` is optional, because a `"pending"` payload is a
 * stub — the intent exists but no receipt has landed, so there is no
 * transaction row to describe yet. Check `status` before reading anything
 * else.
 *
 * The wire is snake_case (`source_tx_hash`, `intent_id`, ...) while this type
 * is camelCase. `getStatus` maps the two onto each other (see
 * `normalizeStatusPayload` in core/routes.ts), so anything that reaches you
 * through `getStatus`/`pollStatus`/`runTopUp` carries both spellings — the raw
 * wire keys are left in place alongside the camelCase ones. Read defensively
 * only if you fetch the endpoint yourself.
 */
export type Transaction = {
  id?: string;
  intentId?: string;
  fromAddress?: string;
  toAddress?: string;
  /** Connected wallet (EOA) that originated the payment when the sender is a
   *  smart account. Wire field: `origin_eoa`. */
  origin_eoa?: string;
  fromChainId?: string | number;
  toChainId?: string | number;
  sourceTxHash?: string;
  destTxHash?: string;
  /** Trustware's own request ID (a UUID), copied from the intent. Wire field:
   *  `request_id`. Optional: absent on a "pending" payload, and on rows
   *  created before it was split from `providerRequestId`. */
  requestId?: string;
  /** The routing provider's own correlation ID, copied from the intent — what
   *  that provider's status API polls with. Wire field:
   *  `provider_request_id`. See RouteIntent.providerRequestId. */
  providerRequestId?: string;
  transactionRequest?: unknown;
  /**
   * "pending" means the intent exists but no receipt has been submitted yet —
   * the backend returns it (HTTP 200) instead of the old 404 so pollers can
   * tell "not ready yet, keep polling" apart from "unknown intent" (a real
   * 404, which means stop polling). A pending response carries only
   * `intent_id`, `status`, `intent_status`, `create_date` and — once the
   * intent has an execution step plan — `steps`; every other field here is
   * absent until a receipt lands.
   */
  status: "pending" | "submitted" | "bridging" | "success" | "failed";
  statusRaw?: unknown;
  routePath?: unknown;
  routeStatus?: unknown;
  /**
   * Exact once landed_amount_verified is true; otherwise a pre-trade quote
   * estimate copied in when the transaction was submitted — neither Squid's
   * nor LiFi's status API carries a real landed-amount field, so the
   * backend confirms it by reading the destination chain directly instead
   * (see BVT-246). Check `landed_amount_verified` before auto-continuing
   * on this value.
   */
  toAmountWei?: string | number;
  /** True once toAmountWei has been confirmed on-chain rather than being the
   *  pre-trade quote estimate. Wire field: `landed_amount_verified`. */
  landed_amount_verified?: boolean;
  fromChainBlock: number;
  toChainBlock: number;
  fromChainTxUrl?: string;
  toChainTxUrl?: string;
  gasStatus?: string;
  isGMPTransaction?: boolean;
  axelarTransactionUrl?: string;

  createdDate: Date | string;
  updatedDate: Date | string;
  timeSpentMs?: number;
};

// export type BuildRouteResult = {
//   intentId: string;
//   route: {
//     estimate: {
//       fromAmount: string;
//       toAmount: string;
//       fromAmountUSD?: string;
//       toAmountUSD?: string;
//       toAmountMinUSD?: string;
//       minimumReceived?: string;
//       fees?: any;
//       route?: any;
//     };
//     transactionRequest: {
//       to: string;
//       data: string;
//       value?: string;
//       chainId?: string;
//       fromAmountUSD?: string;
//       toAmountMinUSD?: string;
//     };
//   };
// };

export type SponsorshipApproval = {
  client_id: string;
  program_id: string;
  sdk_key_id: string;
  sender: string;
  call_data_hash: string;
  chain_id: string;
  max_cost: string;
  valid_after?: string | null;
  valid_until?: string | null;
  nonce: string;
  entry_point: string;
  paymaster: string;
};

export type RouteSponsorship = {
  requestId: string;
  paymaster: string;
  entryPoint: string;
  chainId: string;
  callDataHash: string;
  maxCost: string;
  paymasterAndData: string;
  signature: string;
  signer: string;
  typedDataHash: string;
  approval: SponsorshipApproval;
};

/**
 * A destination-chain contract call to execute automatically once bridged
 * funds land — e.g. depositing straight into a vault instead of a plain
 * wallet transfer. Entirely optional: omit `hooks` on `BuildRouteBody`
 * altogether and nothing about existing `buildRoute`/`buildDepositAddress`
 * behavior changes.
 *
 * There are two ways to tell the backend how much the call should act on:
 * - `fundAmount` (recommended — works with every provider): a fixed amount
 *   you already know ahead of time, with `callData` ABI-encoded for that
 *   exact number.
 * - `fullAmount: true` + `amountInputPos` (Squid only): lets the backend
 *   dynamically patch `callData` with the *actual* landed amount at
 *   execution time — useful when the exact bridged amount can't be known in
 *   advance. Requests using this mode are only ever routed to a provider
 *   that supports it.
 *
 * Pick one of the two amount modes; you don't need both.
 */
export type PostHookRequest = {
  /** Contract address to call on the destination chain. */
  target: string;
  /** ABI-encoded calldata for the call. */
  callData: string;
  /** msg.value to send with the call, in wei — only for native-value calls. */
  value?: string;
  /** Token the call acts on. Defaults to the route's `toToken`. */
  fundToken?: string;
  /** Fixed amount (wei). Required unless `fullAmount` is set. */
  fundAmount?: string;
  /** Squid-only: dynamically patch `callData` with the actual landed amount. */
  fullAmount?: boolean;
  /** Squid-only: required when `fullAmount` is true — the ABI arg index to patch. */
  amountInputPos?: number;
  /**
   * Gas limit hint for the call. Optional for Squid, but required to keep
   * this request eligible for LiFi — include it unless you're intentionally
   * Squid-only.
   */
  estimatedGas?: string;
  /**
   * Set this when `target` needs to pull `fundToken` via `transferFrom` (the
   * common ERC20 vault-deposit case) — usually the same address as `target`
   * itself. On Squid, an `approve()` call is automatically prepended before
   * your call (patched with the landed amount too, when `fullAmount` is
   * true). On LiFi, this is passed through as-is; LiFi's own execution
   * engine handles the approval. Leave unset for native-asset calls, which
   * never need an approval.
   */
  toApprovalAddress?: string;
  /** Where bridged funds go if the call fails (LiFi only). */
  toFallbackAddress?: string;
  description?: string;
};

export type RouteEstimate = {
  fromAmount?: string;
  toAmount?: string;
  toAmountMin?: string;
  fromAmountUsd?: string;
  toAmountUsd?: string;
  totalFeesUsd?: string;
  toAmountMinUsd?: string;
  fees?: unknown[];
};

/**
 * An ERC20 allowance that must be granted before `execution.transaction` can
 * succeed — e.g. bridging from USDC instead of a native asset. `sendRouteTransaction`
 * checks and grants these automatically; you only need this if you're
 * building the transaction lifecycle yourself.
 */
export type RouteApproval = {
  chainId?: string;
  tokenAddress?: string;
  spender?: string;
  amount?: string;
};

export type RoutePlan = {
  estimate?: RouteEstimate;
  execution?: { transaction?: TxRequest; approvals?: RouteApproval[] };
  steps?: unknown[];
  provider?: string;
  /** The winning provider's own correlation ID, not Trustware's — it is
   *  absent when that provider issued none, and it is what lands on the
   *  intent as `providerRequestId`. Trustware's request ID for the same call
   *  comes back in the `X-Request-Id` response header (the provider's is also
   *  mirrored there as `X-Provider-Request-Id`). */
  requestId?: string;
  reliabilityScore?: number;
  diagnostics?: { rawPayload?: unknown };
  sponsorship?: RouteSponsorship;
};

export type BuildRouteResult = {
  intentId: string;
  txReq: TxRequest;
  actions: unknown[];
  finalExchangeRate: {
    fromAmountUSD?: string;
    toAmountMinUSD?: string;
  };
  route: RoutePlan | undefined;
  sponsorship?: RouteSponsorship;
};
