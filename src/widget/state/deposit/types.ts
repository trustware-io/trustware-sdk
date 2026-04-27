import type { Dispatch, SetStateAction } from "react";

import type {
  ChainDef,
  DetectedWallet,
  WalletInterFaceAPI,
} from "../../../types";

export type ResolvedTheme = "light" | "dark";

export interface YourTokenData {
  chainIconURI: string;
  chainData: ChainDef | undefined;
  symbol: string;
  decimals: number;
  name: string;
  iconUrl: string;
  logoURI?: string;
  chainId: number | string;
  usdPrice: number | undefined;
  address: string;
  chain_key: string;
  category: "native" | "erc20" | "spl" | "btc";
  contract?: string;
  balance: string;
}

export type NavigationStep =
  | "home"
  | "select-token"
  | "crypto-pay"
  | "processing"
  | "success"
  | "error";

export type NavigationDirection = "forward" | "backward";

export type WalletStatus =
  | "idle"
  | "detecting"
  | "connecting"
  | "connected"
  | "error";

export type TransactionStatus =
  | "idle"
  | "confirming"
  | "processing"
  | "bridging"
  | "success"
  | "error";

export type PaymentMethodType = "crypto" | "fiat";

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  logoURI?: string;
  balance?: string;
  chainId: string | number;
  usdPrice: number | undefined;
}

export interface Chain {
  chainId: string | number;
  name: string;
  shortName: string;
  iconUrl?: string;
  isPopular?: boolean;
  nativeToken: string;
  explorerUrl?: string;
}

export interface DepositContextValue {
  currentStep: NavigationStep;
  setCurrentStep: (step: NavigationStep) => void;
  setCurrentStepInternal: (value: React.SetStateAction<NavigationStep>) => void;
  goBack: () => void;
  resetState: () => void;
  stepHistory: NavigationStep[];
  navigationDirection: NavigationDirection;
  selectedWallet: WalletInterFaceAPI | null;
  walletAddress: string | null;
  walletStatus: WalletStatus;
  connectWallet: (wallet: DetectedWallet) => Promise<{
    error: unknown;
    api: WalletInterFaceAPI | null;
  }>;
  disconnectWallet: () => Promise<void>;
  selectedToken: Token | null | YourTokenData;
  setSelectedToken: (token: Token | null | YourTokenData) => void;
  selectedChain: ChainDef | null;
  setSelectedChain: (chain: ChainDef | null) => void;
  amount: string;
  setAmount: (amount: string) => void;
  transactionStatus: TransactionStatus;
  setTransactionStatus: (status: TransactionStatus) => void;
  transactionHash: string | null;
  setTransactionHash: (hash: string | null) => void;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
  intentId: string | null;
  setIntentId: (id: string | null) => void;
  paymentMethod: PaymentMethodType;
  setPaymentMethod: (method: PaymentMethodType) => void;
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
  setYourWalletTokens: Dispatch<SetStateAction<YourTokenData[]>>;
  yourWalletTokens: YourTokenData[];
  yourWalletTokensLoading: boolean;
  amountInputMode: "usd" | "token";
  setAmountInputMode: Dispatch<SetStateAction<"usd" | "token">>;
}
