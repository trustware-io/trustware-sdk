import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

import { mergeStyles } from "./lib/utils";
import {
  spacing,
  colors,
  fontSize,
  fontWeight,
  borderRadius,
  zIndex,
} from "./styles";
import {
  DepositProvider,
  useDeposit,
  type NavigationStep,
  type TransactionStatus,
  type ResolvedTheme,
} from "./context/DepositContext";
import { ThemeToggle, WidgetContainer, type Theme, Dialog } from "./components";
import { useTrustware } from "src/provider";
import { Home } from "./pages/Home";
import { SelectToken } from "./pages/SelectToken";
import { CryptoPay } from "./pages/CryptoPay";
import { Processing } from "./pages/Processing";
import { Success } from "./pages/Success";
import { Error } from "./pages/Error";

/**
 * SessionStorage key for persisting widget state
 */
const STORAGE_KEY = "trustware-widget-state";

/**
 * Persisted widget state structure
 */
interface PersistedState {
  currentStep: NavigationStep;
  amount: string;
  selectedChainId?: number;
  selectedTokenAddress?: string;
  transactionHash?: string;
  transactionStatus?: TransactionStatus;
}

/**
 * Save state to sessionStorage
 */
function savePersistedState(state: PersistedState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear persisted state from sessionStorage
 */
function clearPersistedState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

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
 * Transaction statuses that indicate an active transaction
 */
const ACTIVE_TRANSACTION_STATUSES: TransactionStatus[] = [
  "confirming",
  "processing",
  "bridging",
];

// Styles for WidgetContent
const widgetContentContainerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "visible",
};

const themeToggleContainerStyle: React.CSSProperties = {
  position: "absolute",
  top: spacing[3],
  right: spacing[3],
  zIndex: 10,
};

const pageContainerBaseStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  transition: "all 0.15s ease-out",
};

/**
 * Props for the internal widget content
 */
interface WidgetContentProps {
  style?: React.CSSProperties;
  onStateChange?: (state: PersistedState) => void;
  /** Whether to show the theme toggle button */
  showThemeToggle: boolean;
}

/**
 * Internal widget content that handles page rendering and transitions
 */
function WidgetContent({
  style,
  onStateChange,
  showThemeToggle,
}: WidgetContentProps): React.ReactElement {
  const {
    currentStep,
    stepHistory,
    amount,
    selectedChain,
    selectedToken,
    transactionHash,
    transactionStatus,
    resolvedTheme,
    toggleTheme,
  } = useDeposit();
  const [displayedStep, setDisplayedStep] =
    useState<NavigationStep>(currentStep);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] =
    useState<AnimationDirection>("forward");
  const previousStepRef = useRef<NavigationStep>(currentStep);

  /**
   * Persist state changes to sessionStorage
   */
  useEffect(() => {
    const state: PersistedState = {
      currentStep,
      amount,
      selectedChainId: selectedChain?.chainId as number,
      selectedTokenAddress: selectedToken?.address,
      transactionHash: transactionHash ?? undefined,
      transactionStatus:
        transactionStatus !== "idle" ? transactionStatus : undefined,
    };
    savePersistedState(state);
    onStateChange?.(state);
  }, [
    currentStep,
    amount,
    selectedChain,
    selectedToken,
    transactionHash,
    transactionStatus,
    onStateChange,
  ]);

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
    const isBackNav =
      stepHistory.length <
      (previousStepRef.current === currentStep
        ? stepHistory.length
        : stepHistory.length);
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

  // Calculate page container animation styles
  const getPageAnimationStyle = (): React.CSSProperties => {
    if (!isAnimating) return {};

    if (displayedStep !== currentStep) {
      // Exit animation
      if (animationDirection === "forward") {
        return { opacity: 0, transform: "translateX(-1rem)" };
      } else {
        return { opacity: 0, transform: "translateX(1rem)" };
      }
    } else {
      // Enter animation - use CSS animation class
      return {};
    }
  };

  // Determine animation class for enter animation
  const getAnimationClass = (): string => {
    if (isAnimating && displayedStep === currentStep) {
      if (animationDirection === "forward") {
        return "tw-animate-slide-in-right";
      } else {
        return "tw-animate-slide-in-left";
      }
    }
    return "";
  };

  return (
    <div style={mergeStyles(widgetContentContainerStyle, style)}>
      {/* Theme toggle button - positioned in top-right corner */}
      {showThemeToggle && (
        <div style={themeToggleContainerStyle}>
          <ThemeToggle theme={resolvedTheme} onToggle={toggleTheme} />
        </div>
      )}
      <div
        className={getAnimationClass()}
        style={mergeStyles(pageContainerBaseStyle, getPageAnimationStyle())}
      >
        <PageComponent />
      </div>
    </div>
  );
}

/**
 * Ref methods exposed by TrustwareWidgetV2
 */
export interface TrustwareWidgetV2Ref {
  /** Open the widget */
  open: () => void;
  /** Close the widget (shows confirmation if transaction active) */
  close: () => void;
  /** Check if widget is currently open */
  isOpen: () => boolean;
}

export interface TrustwareWidgetV2Props {
  /** Widget theme - light, dark, or system preference (used as initial theme) */
  theme?: Theme;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Initial navigation step (defaults to 'home') */
  initialStep?: NavigationStep;
  /** Whether the widget is initially open (defaults to true for inline usage) */
  defaultOpen?: boolean;
  /** Callback when the widget is closed */
  onClose?: () => void;
  /** Callback when the widget is opened */
  onOpen?: () => void;
  /** Whether to show the theme toggle button (defaults to true) */
  showThemeToggle?: boolean;
}

/**
 * Confirmation dialog for closing during active transaction
 */
interface ConfirmCloseDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Current theme for styling */
  theme: ResolvedTheme;
}

function ConfirmCloseDialog({
  open,
  onConfirm,
  onCancel,
  theme,
}: ConfirmCloseDialogProps): React.ReactElement {
  const isDark = theme === "dark";

  return (
    <>
      <Dialog
        open={open}
        onCancel={onCancel}
        onConfirm={onConfirm}
        title={"Transaction in Progress"}
        description={
          "You have an active transaction. Closing the widget will not cancel your transaction, but you will lose visibility of its progress."
        }
        isDark={isDark}
        // style={customDarkStyles}
      />
    </>
  );
}

interface InitErrorOverlayProps {
  open: boolean;
  isDark: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function InitErrorOverlay({
  open,
  isDark,
  isRefreshing,
  onRefresh,
}: InitErrorOverlayProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="init-error-title"
      aria-describedby="init-error-description"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.2)",
        zIndex: zIndex[40],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing[6],
        borderRadius: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: borderRadius.xl,
          padding: spacing[6],
          backgroundColor: colors.card,
          color: colors.cardForeground,
          boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.35)",
          textAlign: "left",
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2
          id="init-error-title"
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.cardForeground,
          }}
        >
          API key validation failed
        </h2>
        <p
          id="init-error-description"
          style={{
            marginTop: spacing[2],
            fontSize: fontSize.sm,
            color: colors.mutedForeground,
          }}
        >
          We could not validate your Trustware API key. Please refresh to retry.
        </p>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh validation"
          style={{
            marginTop: spacing[4],
            width: "100%",
            borderRadius: "0.5rem",
            backgroundColor: colors.primary,
            padding: `${spacing[2.5]} ${spacing[4]}`,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.primaryForeground,
            border: 0,
            cursor: isRefreshing ? "not-allowed" : "pointer",
            opacity: isRefreshing ? 0.7 : 1,
            transition: "background-color 0.2s",
          }}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}

/**
 * Inner widget component with access to context
 */
interface WidgetInnerProps {
  theme: Theme;
  style?: React.CSSProperties;
  onClose?: () => void;
  onStateChange?: (state: PersistedState) => void;
  closeRequestRef: React.MutableRefObject<(() => void) | null>;
  /** Whether to show the theme toggle button */
  showThemeToggle: boolean;
}

function WidgetInner({
  style,
  onClose,
  onStateChange,
  closeRequestRef,
  showThemeToggle,
}: WidgetInnerProps): React.ReactElement {
  const { transactionStatus, resetState, resolvedTheme } = useDeposit();
  const { status, revalidate } = useTrustware();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initBlocked, setInitBlocked] = useState(false);

  /**
   * Handle close request - shows confirmation if transaction is active
   */
  const handleCloseRequest = useCallback(() => {
    if (ACTIVE_TRANSACTION_STATUSES.includes(transactionStatus)) {
      setShowConfirmDialog(true);
    } else {
      // Clear persisted state on close when no active transaction
      if (transactionStatus === "success" || transactionStatus === "error") {
        clearPersistedState();
        resetState();
      }
      onClose?.();
    }
  }, [transactionStatus, onClose, resetState]);

  // Expose close request handler to parent via useEffect to avoid ref access during render
  useEffect(() => {
    closeRequestRef.current = handleCloseRequest;
  }, [handleCloseRequest, closeRequestRef]);

  /**
   * Confirm close during active transaction
   */
  const handleConfirmClose = useCallback(() => {
    setShowConfirmDialog(false);
    onClose?.();
  }, [onClose]);

  /**
   * Cancel close during active transaction
   */
  const handleCancelClose = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  // Use resolved theme from context for the container (allows toggle to work)
  const effectiveTheme = resolvedTheme as Theme;
  const isRefreshing = status === "initializing";

  useEffect(() => {
    if (status === "error") setInitBlocked(true);
    if (status === "ready") setInitBlocked(false);
  }, [status]);

  const handleRefresh = useCallback(() => {
    revalidate?.();
  }, [revalidate]);

  return (
    <>
      <WidgetContainer theme={effectiveTheme} style={style}>
        <WidgetContent
          onStateChange={onStateChange}
          showThemeToggle={showThemeToggle}
        />
        <InitErrorOverlay
          open={initBlocked}
          isDark={resolvedTheme === "dark"}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </WidgetContainer>
      <ConfirmCloseDialog
        open={showConfirmDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        theme={resolvedTheme}
      />
    </>
  );
}

/**
 * TrustwareWidgetV2 - Main widget component for deposit flow.
 *
 * Provides a complete deposit experience with:
 * - Page navigation based on state machine
 * - Animated transitions between pages
 * - Theme support (light/dark/system)
 * - Context-based state management
 * - Programmatic open/close API via ref
 * - State persistence in sessionStorage
 *
 * @example
 * ```tsx
 * // Basic inline usage
 * <TrustwareWidgetV2 theme="dark" />
 *
 * // With ref for programmatic control
 * const widgetRef = useRef<TrustwareWidgetV2Ref>(null);
 *
 * <TrustwareWidgetV2
 *   ref={widgetRef}
 *   defaultOpen={false}
 *   onClose={() => console.log('Widget closed')}
 *   onOpen={() => console.log('Widget opened')}
 * />
 *
 * // Open/close programmatically
 * widgetRef.current?.open();
 * widgetRef.current?.close();
 * ```
 */
export const TrustwareWidgetV2 = forwardRef<
  TrustwareWidgetV2Ref,
  TrustwareWidgetV2Props
>(function TrustwareWidgetV2(
  {
    theme = "system",
    style,
    initialStep = "home",
    defaultOpen = true,
    onClose,
    onOpen,
    showThemeToggle = true,
  }: TrustwareWidgetV2Props,
  ref
): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const closeRequestRef = useRef<(() => void) | null>(null);

  // Always start at initialStep on mount (refresh returns to home)
  // Persisting step caused issues: wallet disconnects, intentId lost, polling stops
  const effectiveInitialStep = initialStep;

  /**
   * Open the widget
   */
  const open = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  /**
   * Close the widget (delegates to inner component for transaction check)
   */
  const close = useCallback(() => {
    if (closeRequestRef.current) {
      closeRequestRef.current();
    } else {
      setIsOpen(false);
      onClose?.();
    }
  }, [onClose]);

  /**
   * Handle actual close (called by WidgetInner after confirmation)
   */
  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      open,
      close,
      isOpen: () => isOpen,
    }),
    [open, close, isOpen]
  );

  // Don't render if closed
  if (!isOpen) {
    return null;
  }

  return (
    <DepositProvider initialStep={effectiveInitialStep}>
      <WidgetInner
        theme={theme}
        style={style}
        onClose={handleClose}
        closeRequestRef={closeRequestRef}
        showThemeToggle={showThemeToggle}
      />
    </DepositProvider>
  );
});

export default TrustwareWidgetV2;
