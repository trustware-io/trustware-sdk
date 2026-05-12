import React, { createContext, useContext, useState, useMemo } from "react";
import { useTrustware } from "../../provider";
import type { ChainDef } from "../../types";
import {
  type Chain,
  type DepositContextValue,
  type NavigationDirection,
  type NavigationStep,
  type PaymentMethodType,
  type ResolvedTheme,
  type Token,
  type TransactionStatus,
  type YourTokenData,
} from "../state/deposit/types";
import { useDepositNavigationState } from "../state/deposit/useDepositNavigationState";
import { useThemePreference } from "../state/deposit/useThemePreference";
import { useWalletSessionState } from "../state/deposit/useWalletSessionState";
import { useWalletTokenState } from "../state/deposit/useWalletTokenState";
import { useWalletConnect } from "../state/deposit/useWalletConnect";

export type {
  Chain,
  DepositContextValue,
  NavigationDirection,
  NavigationStep,
  PaymentMethodType,
  ResolvedTheme,
  Token,
  TransactionStatus,
  YourTokenData,
};

const DepositContext = createContext<DepositContextValue | undefined>(
  undefined
);
const DepositNavigationContext = createContext<
  | Pick<
      DepositContextValue,
      | "currentStep"
      | "setCurrentStep"
      | "goBack"
      | "resetState"
      | "stepHistory"
      | "navigationDirection"
      | "setCurrentStepInternal"
    >
  | undefined
>(undefined);
const DepositWalletContext = createContext<
  | Pick<
      DepositContextValue,
      | "selectedWallet"
      | "walletAddress"
      | "walletStatus"
      | "connectWallet"
      | "disconnectWallet"
      | "yourWalletTokens"
      | "setYourWalletTokens"
      | "yourWalletTokensLoading"
      | "WalletConnect"
      | "setWalletType"
      | "walletType"
    >
  | undefined
>(undefined);
const DepositFormContext = createContext<
  | Pick<
      DepositContextValue,
      | "selectedToken"
      | "setSelectedToken"
      | "selectedChain"
      | "setSelectedChain"
      | "amount"
      | "setAmount"
      | "paymentMethod"
      | "setPaymentMethod"
      | "amountInputMode"
      | "setAmountInputMode"
    >
  | undefined
>(undefined);
const DepositTransactionContext = createContext<
  | Pick<
      DepositContextValue,
      | "transactionStatus"
      | "setTransactionStatus"
      | "transactionHash"
      | "setTransactionHash"
      | "errorMessage"
      | "setErrorMessage"
      | "intentId"
      | "setIntentId"
    >
  | undefined
>(undefined);
const DepositUiContext = createContext<
  Pick<DepositContextValue, "resolvedTheme" | "toggleTheme"> | undefined
>(undefined);

export interface DepositProviderProps {
  children: React.ReactNode;
  /** Initial step to start the widget at */
  initialStep?: NavigationStep;
}

/**
 * Provider for deposit widget context including navigation state.
 */
export function DepositProvider({
  children,
  initialStep = "home",
}: DepositProviderProps): React.ReactElement {
  useTrustware(); // ensures provider is present

  const {
    currentStep,
    stepHistory,
    navigationDirection,
    setCurrentStep,
    goBack,
    resetNavigation,
    setCurrentStepInternal,
  } = useDepositNavigationState(initialStep);

  const { resolvedTheme, toggleTheme } = useThemePreference();

  const {
    selectedWallet,
    walletAddress: otherWalletAddress,
    walletStatus,
    connectWallet,
    disconnectWallet,
  } = useWalletSessionState();

  const [amountInputMode, setAmountInputMode] = useState<"usd" | "token">(
    "usd"
  );

  const [walletType, setWalletType] = useState<"walletconnect" | "other">(
    "other"
  );

  const { walletConnectAddress, WalletConnect, disconnectWalletConnect } =
    useWalletConnect({
      setWalletType,
      setCurrentStep,
    });

  // Token and chain state
  const [selectedToken, setSelectedToken] = useState<
    Token | null | YourTokenData
  >(null);
  const [selectedChain, setSelectedChain] = useState<ChainDef | null>(null);
  const [amount, setAmount] = useState<string>("");

  const walletAddress = useMemo(
    () =>
      walletType === "walletconnect"
        ? walletConnectAddress
        : otherWalletAddress,
    [walletType, walletConnectAddress, otherWalletAddress]
  );

  const {
    yourWalletTokens,
    setYourWalletTokens,
    reloadWalletTokens,
    yourWalletTokensLoading,
  } = useWalletTokenState({
    walletAddress,
    selectedChain,
    setSelectedChain,
    selectedToken,
    setSelectedToken,
  });

  // Transaction lifecycle state
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);

  // Payment method state (defaults to crypto)
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>("crypto");

  /**
   * Reset all state and return to home
   */
  const resetState = React.useCallback(() => {
    resetNavigation();
    setSelectedToken(null);
    setSelectedChain(null);
    setAmount("");
    setAmountInputMode("usd");
    setTransactionStatus("idle");
    setTransactionHash(null);
    setErrorMessage(null);
    setIntentId(null);
    setPaymentMethod("crypto");
    reloadWalletTokens();
  }, [reloadWalletTokens, resetNavigation]);

  const navigationValue = useMemo(
    () => ({
      currentStep,
      setCurrentStep,
      goBack,
      resetState,
      stepHistory,
      navigationDirection,
      setCurrentStepInternal,
    }),
    [
      currentStep,
      goBack,
      navigationDirection,
      resetState,
      setCurrentStep,
      setCurrentStepInternal,
      stepHistory,
    ]
  );

  const walletValue = useMemo(
    () => ({
      selectedWallet,
      walletAddress,
      walletStatus,
      connectWallet,
      disconnectWallet,
      yourWalletTokens,
      setYourWalletTokens,
      yourWalletTokensLoading,
      walletConnectAddress,
      WalletConnect,
      disconnectWalletConnect,
      setWalletType,
      walletType,
    }),
    [
      WalletConnect,
      connectWallet,
      disconnectWallet,
      disconnectWalletConnect,
      selectedWallet,
      setYourWalletTokens,
      walletAddress,
      walletConnectAddress,
      walletStatus,
      walletType,
      yourWalletTokens,
      yourWalletTokensLoading,
    ]
  );

  const formValue = useMemo(
    () => ({
      selectedToken,
      setSelectedToken,
      selectedChain,
      setSelectedChain,
      amount,
      setAmount,
      paymentMethod,
      setPaymentMethod,
      amountInputMode,
      setAmountInputMode,
    }),
    [
      amount,
      amountInputMode,
      paymentMethod,
      selectedChain,
      selectedToken,
      setPaymentMethod,
    ]
  );

  const transactionValue = useMemo(
    () => ({
      transactionStatus,
      setTransactionStatus,
      transactionHash,
      setTransactionHash,
      errorMessage,
      setErrorMessage,
      intentId,
      setIntentId,
    }),
    [errorMessage, intentId, transactionHash, transactionStatus]
  );

  const uiValue = useMemo(
    () => ({
      resolvedTheme,
      toggleTheme,
    }),
    [resolvedTheme, toggleTheme]
  );

  const value = useMemo<DepositContextValue>(
    () => ({
      ...navigationValue,
      ...walletValue,
      ...formValue,
      ...transactionValue,
      ...uiValue,
    }),
    [formValue, navigationValue, transactionValue, uiValue, walletValue]
  );

  return (
    <DepositNavigationContext.Provider value={navigationValue}>
      <DepositWalletContext.Provider value={walletValue}>
        <DepositFormContext.Provider value={formValue}>
          <DepositTransactionContext.Provider value={transactionValue}>
            <DepositUiContext.Provider value={uiValue}>
              <DepositContext.Provider value={value}>
                {children}
              </DepositContext.Provider>
            </DepositUiContext.Provider>
          </DepositTransactionContext.Provider>
        </DepositFormContext.Provider>
      </DepositWalletContext.Provider>
    </DepositNavigationContext.Provider>
  );
}

function useRequiredContext<T>(
  context: React.Context<T | undefined>,
  name: string
) {
  const value = useContext(context);
  if (value === undefined) {
    throw new Error(`${name} must be used within a DepositProvider`);
  }
  return value;
}

export function useDepositNavigation() {
  return useRequiredContext(DepositNavigationContext, "useDepositNavigation");
}

export function useDepositWallet() {
  return useRequiredContext(DepositWalletContext, "useDepositWallet");
}

export function useDepositForm() {
  return useRequiredContext(DepositFormContext, "useDepositForm");
}

export function useDepositTransaction() {
  return useRequiredContext(DepositTransactionContext, "useDepositTransaction");
}

export function useDepositUi() {
  return useRequiredContext(DepositUiContext, "useDepositUi");
}

/**
 * Hook to access deposit context
 * @throws Error if used outside of DepositProvider
 */
export function useDeposit(): DepositContextValue {
  const context = useContext(DepositContext);
  if (context === undefined) {
    throw new Error("useDeposit must be used within a DepositProvider");
  }
  return context;
}

export default DepositContext;
