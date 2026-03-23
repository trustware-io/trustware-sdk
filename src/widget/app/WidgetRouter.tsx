import React, { useMemo } from "react";

import { mergeStyles } from "../lib/utils";
import type {
  NavigationDirection,
  NavigationStep,
} from "../context/DepositContext";
import { PAGE_COMPONENTS } from "./widgetSteps";

const pageContainerBaseStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  transition: "all 0.15s ease-out",
};

interface WidgetRouterProps {
  currentStep: NavigationStep;
  navigationDirection: NavigationDirection;
  stepHistory: NavigationStep[];
}

export function WidgetRouter({
  currentStep,
  navigationDirection,
  stepHistory,
}: WidgetRouterProps): React.ReactElement {
  const PageComponent = useMemo(
    () => PAGE_COMPONENTS[currentStep],
    [currentStep]
  );

  const animationClass = useMemo(() => {
    return navigationDirection === "forward"
      ? "tw-animate-slide-in-right"
      : "tw-animate-slide-in-left";
  }, [navigationDirection]);

  return (
    <div
      key={`${currentStep}-${stepHistory.length}`}
      className={animationClass}
      style={mergeStyles(pageContainerBaseStyle)}
    >
      <PageComponent />
    </div>
  );
}
