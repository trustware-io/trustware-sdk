import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

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
    }),
    [currentStep, setCurrentStep, goBack, resetState, stepHistory]
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
