import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { walletManager } from "../../wallets/manager";
import type { DetectedWallet, WalletInterFaceAPI } from "../../types";

/**
 * Navigation states for the deposit widget flow
 */
export type NavigationStep =
  | "home"
  | "select-token"
  | "crypto-pay"
  | "processing"
  | "success"
  | "error";

/**
 * Wallet connection status
 */
export type WalletStatus =
  | "idle"
  | "detecting"
  | "connecting"
  | "connected"
  | "error";

export interface DepositContextValue {
  /** Current navigation step */
  currentStep: NavigationStep;
  /** Set the current navigation step */
  setCurrentStep: (step: NavigationStep) => void;
  /** Navigate to the previous step */
  goBack: () => void;
  /** Reset state and return to home */
  resetState: () => void;
  /** History of visited steps for back navigation */
  stepHistory: NavigationStep[];

  // Wallet state
  /** Currently connected wallet interface */
  selectedWallet: WalletInterFaceAPI | null;
  /** Current wallet address (null if not connected) */
  walletAddress: string | null;
  /** Current wallet connection status */
  walletStatus: WalletStatus;
  /** Connect to a detected wallet */
  connectWallet: (wallet: DetectedWallet) => Promise<void>;
  /** Disconnect the current wallet */
  disconnectWallet: () => Promise<void>;
}

const DepositContext = createContext<DepositContextValue | undefined>(
  undefined
);

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
  const [currentStep, setCurrentStepInternal] =
    useState<NavigationStep>(initialStep);
  const [stepHistory, setStepHistory] = useState<NavigationStep[]>([
    initialStep,
  ]);

  // Wallet state
  const [selectedWallet, setSelectedWallet] =
    useState<WalletInterFaceAPI | null>(walletManager.wallet);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>(
    walletManager.status as WalletStatus
  );

  /**
   * Subscribe to walletManager state changes
   */
  useEffect(() => {
    const unsubscribe = walletManager.onChange((status) => {
      setWalletStatus(status as WalletStatus);
      setSelectedWallet(walletManager.wallet);

      // Update wallet address when connected
      if (status === "connected" && walletManager.wallet) {
        walletManager.wallet.getAddress().then((address) => {
          setWalletAddress(address);
        }).catch(() => {
          setWalletAddress(null);
        });
      } else if (status !== "connected") {
        setWalletAddress(null);
      }
    });

    // Initialize wallet address if already connected
    if (walletManager.status === "connected" && walletManager.wallet) {
      walletManager.wallet.getAddress().then((address) => {
        setWalletAddress(address);
      }).catch(() => {
        setWalletAddress(null);
      });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Connect to a detected wallet
   */
  const connectWallet = useCallback(async (wallet: DetectedWallet) => {
    await walletManager.connectDetected(wallet);
  }, []);

  /**
   * Disconnect the current wallet
   */
  const disconnectWallet = useCallback(async () => {
    await walletManager.disconnect();
  }, []);

  /**
   * Set the current step and track history
   */
  const setCurrentStep = useCallback((step: NavigationStep) => {
    setCurrentStepInternal(step);
    setStepHistory((prev) => {
      // Don't add duplicate consecutive steps
      if (prev[prev.length - 1] === step) {
        return prev;
      }
      return [...prev, step];
    });
  }, []);

  /**
   * Navigate to the previous step based on history
   */
  const goBack = useCallback(() => {
    setStepHistory((prev) => {
      if (prev.length <= 1) {
        // Already at the beginning, stay at home
        setCurrentStepInternal("home");
        return ["home"];
      }

      // Remove current step from history
      const newHistory = prev.slice(0, -1);
      const previousStep = newHistory[newHistory.length - 1] || "home";
      setCurrentStepInternal(previousStep);
      return newHistory;
    });
  }, []);

  /**
   * Reset all state and return to home
   */
  const resetState = useCallback(() => {
    setCurrentStepInternal("home");
    setStepHistory(["home"]);
  }, []);

  const value = useMemo<DepositContextValue>(
    () => ({
      currentStep,
      setCurrentStep,
      goBack,
      resetState,
      stepHistory,
      // Wallet state
      selectedWallet,
      walletAddress,
      walletStatus,
      connectWallet,
      disconnectWallet,
    }),
    [
      currentStep,
      setCurrentStep,
      goBack,
      resetState,
      stepHistory,
      selectedWallet,
      walletAddress,
      walletStatus,
      connectWallet,
      disconnectWallet,
    ]
  );

  return (
    <DepositContext.Provider value={value}>{children}</DepositContext.Provider>
  );
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
