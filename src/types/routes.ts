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
  routeRaw?: any;
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
  transactionRequest: any;
  status: "submitted" | "bridging" | "success" | "failed";
  statusRaw?: any;
  routePath?: any;
  routeStatus?: any;
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

export type BuildRouteResult = {
  intentId: string;
  route: {
    estimate: {
      fromAmount: string;
      toAmount: string;
      fromAmountUSD?: string;
      toAmountUSD?: string;
      toAmountMinUSD?: string;
      minimumReceived?: string;
      fees?: any;
      route?: any;
    };
    transactionRequest: {
      to: string;
      data: string;
      value?: string;
      chainId?: string;
      fromAmountUSD?: string;
      toAmountMinUSD?: string;
    };
  };
};
