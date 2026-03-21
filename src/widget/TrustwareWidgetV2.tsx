import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

import { mergeStyles } from "./lib/utils";
import { spacing } from "./styles";
import {
  DepositProvider,
  useDepositForm,
  useDepositNavigation,
  useDepositTransaction,
  useDepositUi,
  type NavigationStep,
} from "./context/DepositContext";
import { ThemeToggle, WidgetContainer, type Theme } from "./components";
import {
  clearPersistedState,
  savePersistedState,
  type PersistedState,
} from "./app/WidgetPersistence";
import {
  ConfirmCloseDialog,
  InitErrorOverlay,
} from "./app/WidgetShellOverlays";
import { WidgetRouter } from "./app/WidgetRouter";
import { ACTIVE_TRANSACTION_STATUSES } from "./app/widgetSteps";
import { useTrustware } from "../provider";

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
  const { currentStep, navigationDirection, stepHistory } =
    useDepositNavigation();
  const { amount, selectedChain, selectedToken } = useDepositForm();
  const { transactionHash, transactionStatus } = useDepositTransaction();
  const { resolvedTheme, toggleTheme } = useDepositUi();

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

  return (
    <div style={mergeStyles(widgetContentContainerStyle, style)}>
      {/* Theme toggle button - positioned in top-right corner */}
      {showThemeToggle && (
        <div style={themeToggleContainerStyle}>
          <ThemeToggle theme={resolvedTheme} onToggle={toggleTheme} />
        </div>
      )}
      <WidgetRouter
        currentStep={currentStep}
        navigationDirection={navigationDirection}
        stepHistory={stepHistory}
      />
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
  const { resetState } = useDepositNavigation();
  const { transactionStatus } = useDepositTransaction();
  const { resolvedTheme } = useDepositUi();
  const { status, revalidate } = useTrustware();
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

  // Use resolved theme from context for the container (allows toggle to work)
  const effectiveTheme = resolvedTheme as Theme;
  const isRefreshing = status === "initializing";
  const initBlocked = status === "error";

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
