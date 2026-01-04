import { TrustwareWidgetTheme, TrustwareWidgetMessages } from "./theme";

export type TrustwareConfigOptions = {
  apiKey: string; // Required API key for authentication
  routes: {
    toChain: string; // Default destination chain
    toToken: string; // Default destination token
    fromToken?: string; // Default source token (optional)
    fromAddress?: string; // Default source address (optional)
    toAddress?: string; // Default destination address (optional; can be updated later via Trustware.setDestinationAddress)
    defaultSlippage?: number; // Default slippage percentage (optional) defautts to 1
    options?: {
      fixedFromAmount?: string | number;
      minAmountOut?: string | number;
      maxAmountOut?: string | number;
    };
  };
  autoDetectProvider?: boolean; // Whether to auto-detect wallet provider (optional, default: false.)
  theme?: TrustwareWidgetTheme; // Optional theme customization
  messages?: Partial<TrustwareWidgetMessages>; // Optional message customization
};

export type ResolvedTrustwareConfig = {
  apiKey: string;
  routes: {
    toChain: string;
    toToken: string;
    fromToken?: string;
    fromAddress?: string;
    toAddress?: string;
    defaultSlippage: number; // resolved
    options: {
      fixedFromAmount?: string | number;
      minAmountOut?: string | number;
      maxAmountOut?: string | number;
    };
  };
  autoDetectProvider: boolean;
  theme: TrustwareWidgetTheme;
  messages: TrustwareWidgetMessages;
};

export const DEFAULT_SLIPPAGE = 1; // Default slippage percentage
export const DEFAULT_AUTO_DETECT_PROVIDER = false; // Default auto-detect provider setting
