import React, { useState, useEffect, useRef } from "react";
import { cn } from "./lib/utils";
import { DepositProvider, useDeposit, type NavigationStep } from "./context/DepositContext";
import { WidgetContainer, type Theme } from "./components/WidgetContainer";
import { Home } from "./pages/Home";
import { SelectToken } from "./pages/SelectToken";
import { CryptoPay } from "./pages/CryptoPay";
import { Processing } from "./pages/Processing";
import { Success } from "./pages/Success";
import { Error } from "./pages/Error";

/**
 * Animation direction for page transitions
 */
type AnimationDirection = "forward" | "backward";

/**
 * Page component mapping based on navigation step
 */
const PAGE_COMPONENTS: Record<NavigationStep, React.ComponentType> = {
  home: Home,
  "select-token": SelectToken,
  "crypto-pay": CryptoPay,
  processing: Processing,
  success: Success,
  error: Error,
};

/**
 * Step order for determining animation direction
 */
const STEP_ORDER: NavigationStep[] = [
  "home",
  "select-token",
  "crypto-pay",
  "processing",
  "success",
  "error",
];

/**
 * Props for the internal widget content
 */
interface WidgetContentProps {
  className?: string;
}

/**
 * Internal widget content that handles page rendering and transitions
 */
function WidgetContent({ className }: WidgetContentProps): React.ReactElement {
  const { currentStep, stepHistory } = useDeposit();
  const [displayedStep, setDisplayedStep] = useState<NavigationStep>(currentStep);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<AnimationDirection>("forward");
  const previousStepRef = useRef<NavigationStep>(currentStep);

  /**
   * Handle page transitions with animation.
   * Uses setState in effect to sync animation state with external navigation changes.
   * This pattern is valid for animation state synchronization.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (currentStep === displayedStep) return;

    // Determine animation direction based on step order
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const previousIndex = STEP_ORDER.indexOf(previousStepRef.current);

    // Check if this is a back navigation
    const isBackNav = stepHistory.length < (previousStepRef.current === currentStep ? stepHistory.length : stepHistory.length);
    const direction: AnimationDirection =
      currentIndex < previousIndex || isBackNav ? "backward" : "forward";

    setAnimationDirection(direction);
    setIsAnimating(true);

    // After exit animation completes, switch pages
    const exitTimeout = setTimeout(() => {
      setDisplayedStep(currentStep);
      previousStepRef.current = currentStep;
    }, 150);

    // After enter animation completes, stop animating
    const enterTimeout = setTimeout(() => {
      setIsAnimating(false);
    }, 300);

    return () => {
      clearTimeout(exitTimeout);
      clearTimeout(enterTimeout);
    };
  }, [currentStep, displayedStep, stepHistory.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const PageComponent = PAGE_COMPONENTS[displayedStep];

  return (
    <div
      className={cn(
        "tw-relative tw-w-full tw-h-full tw-overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "tw-w-full tw-h-full tw-transition-all tw-duration-150 tw-ease-out",
          isAnimating && animationDirection === "forward" && displayedStep !== currentStep &&
            "tw-opacity-0 tw--translate-x-4",
          isAnimating && animationDirection === "backward" && displayedStep !== currentStep &&
            "tw-opacity-0 tw-translate-x-4",
          isAnimating && displayedStep === currentStep && animationDirection === "forward" &&
            "tw-animate-slide-in-right",
          isAnimating && displayedStep === currentStep && animationDirection === "backward" &&
            "tw-animate-slide-in-left"
        )}
      >
        <PageComponent />
      </div>
    </div>
  );
}

export interface TrustwareWidgetV2Props {
  /** Widget theme - light, dark, or system preference */
  theme?: Theme;
  /** Additional CSS classes */
  className?: string;
  /** Initial navigation step (defaults to 'home') */
  initialStep?: NavigationStep;
}

/**
 * TrustwareWidgetV2 - Main widget component for deposit flow.
 *
 * Provides a complete deposit experience with:
 * - Page navigation based on state machine
 * - Animated transitions between pages
 * - Theme support (light/dark/system)
 * - Context-based state management
 *
 * @example
 * ```tsx
 * <TrustwareWidgetV2 theme="dark" />
 * ```
 */
export function TrustwareWidgetV2({
  theme = "system",
  className,
  initialStep = "home",
}: TrustwareWidgetV2Props): React.ReactElement {
  return (
    <DepositProvider initialStep={initialStep}>
      <WidgetContainer theme={theme} className={className}>
        <WidgetContent />
      </WidgetContainer>
    </DepositProvider>
  );
}

export default TrustwareWidgetV2;
