export type TrustwareConfig = {
  /** Required API key issued by Trustware */
  apiKey: string;

  /** Route defaults for one-click usage */
  defaults?: {
    toChain?: string;
    toToken?: string;
    fromToken?: string;
    defaultSlippage?: number;
  };
  /** Optional UI overrides for widgets */
  ui?: {
    theme?: { primary?: string; radius?: number };
    messages?: Partial<DefaultMessages>;
  };
};

export type InternalUIConfig = {
  theme?: { primary?: string; radius?: number };
  messages?: Partial<DefaultMessages>;
};

export type DefaultMessages = {
  title: string;
  amountPlaceholder: string;
  ctaIdle: string;
  ctaBusy: string;
  statusLabel: string;
  errorPrefix: string;
};

export type WalletInterFaceAPI = {
  getAddress(): Promise<string>;
  getChainId(): Promise<number>;
  switchChain(chainId: number): Promise<void>;
} & (
  | {
      type: "eip1193";
      request(args: { method: string; params?: any[] | object }): Promise<any>;
    }
  | {
      type: "wagmi";
      sendTransaction(tx: {
        to: `0x${string}`;
        data: `0x${string}`;
        value?: bigint;
        chainId?: number;
      }): Promise<{ hash: `0x${string}` }>;
    }
);

export type SimpleWalletInterface = {
  getAddress(): Promise<string>;
  getChainId(): Promise<number>;
  switchChain(chainId: number): Promise<void>;
};

export type EIP1193 = {
  request(args: { method: string; params?: any[] | object }): Promise<any>;
};

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
    estimate: { fromAmount: string; toAmount: string; fees?: any; route?: any };
    transactionRequest: {
      to: string;
      data: string;
      value?: string;
      chainId?: string;
    };
  };
};
