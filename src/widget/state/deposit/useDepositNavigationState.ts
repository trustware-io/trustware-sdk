import { useCallback, useState } from "react";

import type { NavigationDirection, NavigationStep } from "./types";

export function useDepositNavigationState(initialStep: NavigationStep) {
  const [currentStep, setCurrentStepInternal] =
    useState<NavigationStep>(initialStep);
  const [stepHistory, setStepHistory] = useState<NavigationStep[]>([
    initialStep,
  ]);
  const [navigationDirection, setNavigationDirection] =
    useState<NavigationDirection>("forward");

  const setCurrentStep = useCallback((step: NavigationStep) => {
    setNavigationDirection("forward");
    setCurrentStepInternal(step);
    setStepHistory((prev) => {
      if (prev[prev.length - 1] === step) {
        return prev;
      }
      return [...prev, step];
    });
  }, []);

  const goBack = useCallback(() => {
    setNavigationDirection("backward");
    setStepHistory((prev) => {
      if (prev.length <= 1) {
        setCurrentStepInternal("home");
        return ["home"];
      }

      const newHistory = prev.slice(0, -1);
      const previousStep = newHistory[newHistory.length - 1] || "home";
      setCurrentStepInternal(previousStep);
      return newHistory;
    });
  }, []);

  const resetNavigation = useCallback(() => {
    setNavigationDirection("backward");
    setCurrentStepInternal("home");
    setStepHistory(["home"]);
  }, []);

  return {
    currentStep,
    stepHistory,
    navigationDirection,
    setCurrentStep,
    goBack,
    resetNavigation,
    setCurrentStepInternal,
  };
}
