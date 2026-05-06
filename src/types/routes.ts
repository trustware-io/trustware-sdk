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
  requestId?: string;
  routeRaw?: unknown;
  status: "created" | "submitted" | "bridging" | "success" | "failed";
  createdDate: Date | string;
  updatedDate: Date | string;
};

export type Transaction = {
  id: string;
  intentId: string;
  fromAddress: string;
  toAddress: string;
  fromChainId: string | number;
  toChainId: string | number;
  sourceTxHash: string;
  destTxHash: string;
  requestId: string;
  transactionRequest: unknown;
  status: "submitted" | "bridging" | "success" | "failed";
  statusRaw?: unknown;
  routePath?: unknown;
  routeStatus?: unknown;
  toAmountWei?: string | number;
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

export type RoutePlan = {
  estimate?: RouteEstimate;
  execution?: { transaction?: TxRequest };
  steps?: unknown[];
  provider?: string;
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
