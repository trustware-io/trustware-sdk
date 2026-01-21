import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "./lib/utils";
import {
  DepositProvider,
  useDeposit,
  type NavigationStep,
  type TransactionStatus,
} from "./context/DepositContext";
import { WidgetContainer, type Theme } from "./components/WidgetContainer";
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
 * Load persisted state from sessionStorage
 */
function loadPersistedState(): PersistedState | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as PersistedState;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
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

/**
 * Props for the internal widget content
 */
interface WidgetContentProps {
  className?: string;
  onStateChange?: (state: PersistedState) => void;
}

/**
 * Internal widget content that handles page rendering and transitions
 */
function WidgetContent({
  className,
  onStateChange,
}: WidgetContentProps): React.ReactElement {
  const {
    currentStep,
    stepHistory,
    amount,
    selectedChain,
    selectedToken,
    transactionHash,
    transactionStatus,
  } = useDeposit();
  const [displayedStep, setDisplayedStep] = useState<NavigationStep>(currentStep);
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
      selectedChainId: selectedChain?.chainId,
      selectedTokenAddress: selectedToken?.address,
      transactionHash: transactionHash ?? undefined,
      transactionStatus: transactionStatus !== "idle" ? transactionStatus : undefined,
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
          isAnimating &&
            animationDirection === "forward" &&
            displayedStep !== currentStep &&
            "tw-opacity-0 tw--translate-x-4",
          isAnimating &&
            animationDirection === "backward" &&
            displayedStep !== currentStep &&
            "tw-opacity-0 tw-translate-x-4",
          isAnimating &&
            displayedStep === currentStep &&
            animationDirection === "forward" &&
            "tw-animate-slide-in-right",
          isAnimating &&
            displayedStep === currentStep &&
            animationDirection === "backward" &&
            "tw-animate-slide-in-left"
        )}
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
  /** Widget theme - light, dark, or system preference */
  theme?: Theme;
  /** Additional CSS classes */
  className?: string;
  /** Initial navigation step (defaults to 'home') */
  initialStep?: NavigationStep;
  /** Whether the widget is initially open (defaults to true for inline usage) */
  defaultOpen?: boolean;
  /** Callback when the widget is closed */
  onClose?: () => void;
  /** Callback when the widget is opened */
  onOpen?: () => void;
}

/**
 * Confirmation dialog for closing during active transaction
 */
interface ConfirmCloseDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmCloseDialog({
  open,
  onConfirm,
  onCancel,
}: ConfirmCloseDialogProps): React.ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="tw-fixed tw-inset-0 tw-bg-black/50 tw-z-50 tw-animate-fade-in" />
        <Dialog.Content className="tw-fixed tw-left-1/2 tw-top-1/2 tw--translate-x-1/2 tw--translate-y-1/2 tw-z-50 tw-w-[90%] tw-max-w-[340px] tw-rounded-xl tw-bg-white tw-p-6 tw-shadow-xl tw-animate-fade-in dark:tw-bg-zinc-900">
          <Dialog.Title className="tw-text-lg tw-font-semibold tw-text-zinc-900 dark:tw-text-white">
            Transaction in Progress
          </Dialog.Title>
          <Dialog.Description className="tw-mt-2 tw-text-sm tw-text-zinc-600 dark:tw-text-zinc-400">
            You have an active transaction. Closing the widget will not cancel
            your transaction, but you will lose visibility of its progress.
          </Dialog.Description>
          <div className="tw-mt-6 tw-flex tw-gap-3">
            <button
              onClick={onCancel}
              className="tw-flex-1 tw-rounded-lg tw-border tw-border-zinc-200 tw-px-4 tw-py-2.5 tw-text-sm tw-font-medium tw-text-zinc-700 tw-transition-colors hover:tw-bg-zinc-50 dark:tw-border-zinc-700 dark:tw-text-zinc-300 dark:hover:tw-bg-zinc-800"
            >
              Keep Open
            </button>
            <button
              onClick={onConfirm}
              className="tw-flex-1 tw-rounded-lg tw-bg-red-500 tw-px-4 tw-py-2.5 tw-text-sm tw-font-medium tw-text-white tw-transition-colors hover:tw-bg-red-600"
            >
              Close Anyway
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Inner widget component with access to context
 */
interface WidgetInnerProps {
  theme: Theme;
  className?: string;
  onClose?: () => void;
  onStateChange?: (state: PersistedState) => void;
  closeRequestRef: React.MutableRefObject<(() => void) | null>;
}

function WidgetInner({
  theme,
  className,
  onClose,
  onStateChange,
  closeRequestRef,
}: WidgetInnerProps): React.ReactElement {
  const { transactionStatus, resetState } = useDeposit();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

  return (
    <>
      <WidgetContainer theme={theme} className={className}>
        <WidgetContent onStateChange={onStateChange} />
      </WidgetContainer>
      <ConfirmCloseDialog
        open={showConfirmDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
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
    className,
    initialStep = "home",
    defaultOpen = true,
    onClose,
    onOpen,
  }: TrustwareWidgetV2Props,
  ref
): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const closeRequestRef = useRef<(() => void) | null>(null);

  // Load persisted initial step if available (using lazy state initializer to avoid ref access during render)
  const [effectiveInitialStep] = useState<NavigationStep>(() => {
    const persisted = loadPersistedState();
    return persisted?.currentStep ?? initialStep;
  });

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
        className={className}
        onClose={handleClose}
        closeRequestRef={closeRequestRef}
      />
    </DepositProvider>
  );
});

export default TrustwareWidgetV2;
