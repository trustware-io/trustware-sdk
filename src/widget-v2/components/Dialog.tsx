import React, { useEffect, useRef, ReactNode } from "react";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  zIndex,
} from "../styles";

export interface DialogProps {
  /** Controls whether the dialog is visible */
  open: boolean;
  /** Callback when dialog is cancelled/closed */
  onCancel: () => void;
  /** Callback when dialog is confirmed */
  onConfirm: () => void;
  /** Optional dialog title */
  title?: ReactNode;
  /** Optional dialog description */
  description?: ReactNode;
  /** Optional cancel button text */
  cancelText?: string;
  /** Optional confirm button text */
  confirmText?: string;
  /** Optional CSS class name */
  className?: string;
  /** Optional style overrides */
  style?: React.CSSProperties;

  isDark?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onCancel,
  onConfirm,
  title = "Transaction in Progress",
  description = "You have an active transaction. Closing the widget will not cancel your transaction, but you will lose visibility of its progress.",
  cancelText = "Keep Open",
  confirmText = "Close Anyway",
  className = "",
  style = {},
  isDark = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const lastButtonRef = useRef<HTMLButtonElement>(null);

  // Handle Escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onCancel();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onCancel]);

  // Handle focus trapping
  useEffect(() => {
    const handleTabKey = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Tab") {
        if (e.shiftKey) {
          // Shift + Tab (moving backwards)
          if (document.activeElement === firstButtonRef.current) {
            e.preventDefault();
            lastButtonRef.current?.focus();
          }
        } else {
          // Tab (moving forwards)
          if (document.activeElement === lastButtonRef.current) {
            e.preventDefault();
            firstButtonRef.current?.focus();
          }
        }
      }
    };

    if (open) {
      document.addEventListener("keydown", handleTabKey);
    }

    return () => {
      document.removeEventListener("keydown", handleTabKey);
    };
  }, [open]);

  // Set initial focus when dialog opens and manage body scroll
  useEffect(() => {
    if (open) {
      // Store current body overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;

      // Prevent body scrolling
      document.body.style.overflow = "hidden";

      // Set focus to first button after a small delay
      const timer = setTimeout(() => {
        firstButtonRef.current?.focus();
      }, 10);

      return () => {
        clearTimeout(timer);
        // Restore original body overflow
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);

  // Handle click outside to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  // Handle button key down events
  const handleCancelKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleConfirmKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onConfirm();
    }
  };

  // Add hover and focus styles dynamically
  const handleCancelMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = "var(--cancel-hover, #e5e7eb)";
  };

  const handleCancelMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = "var(--cancel-bg, #f3f4f6)";
  };

  const handleConfirmMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = "var(--confirm-hover, #dc2626)";
  };

  const handleConfirmMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = "var(--confirm-bg, #ef4444)";
  };

  const handleCancelFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.5)";
    e.currentTarget.style.borderColor = "#3b82f6";
  };

  const handleCancelBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = "";
    e.currentTarget.style.borderColor = "var(--cancel-border, #d1d5db)";
  };

  const handleConfirmFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.5)";
    e.currentTarget.style.borderColor = "#ef4444";
  };

  const handleConfirmBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    e.currentTarget.style.boxShadow = "";
    e.currentTarget.style.borderColor = "transparent";
  };

  // Don't render if not open
  if (!open) return null;

  return (
    <>
      <div
        // className={`dialog-overlay ${className}`}
        ref={overlayRef}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        data-testid="dialog-overlay"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: zIndex[50],
          animation: "tw-fade-in 0.2s ease-out",
        }}
      >
        <div
          //   className="dialog-content"
          ref={dialogRef}
          data-testid="dialog-content"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: zIndex[50],
            width: "90%",
            maxWidth: "340px",
            borderRadius: borderRadius.xl,
            padding: spacing[6],
            boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
            animation: "tw-fade-in 0.2s ease-out",
            backgroundColor: isDark ? colors.zinc[900] : colors.white,
          }}
        >
          <h2
            // className="dialog-title"
            id="dialog-title"
            data-testid="dialog-title"
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: isDark ? colors.white : colors.zinc[900],
            }}
          >
            {title}
          </h2>
          <p
            // className="dialog-description"
            id="dialog-description"
            data-testid="dialog-description"
            style={{
              marginTop: spacing[2],
              fontSize: fontSize.sm,
            }}
          >
            {description}
          </p>
          <div
            // className="dialog-buttons-container"
            data-testid="dialog-buttons-container"
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.75rem",
            }}
          >
            <button
              ref={firstButtonRef}
              onClick={onCancel}
              //   className="dialog-button dialog-button-cancel"
              onKeyDown={handleCancelKeyDown}
              onMouseEnter={handleCancelMouseEnter}
              onMouseLeave={handleCancelMouseLeave}
              onFocus={handleCancelFocus}
              onBlur={handleCancelBlur}
              aria-label={cancelText}
              data-testid="dialog-cancel-button"
              style={{
                flex: 1,
                borderRadius: "0.5rem",
                padding: `${spacing[2.5]} ${spacing[4]}`,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                transition: "background-color 0.2s",
                cursor: "pointer",
                ...(isDark
                  ? {
                      border: `1px solid ${colors.zinc[700]}`,
                      color: colors.zinc[300],
                      backgroundColor: "transparent",
                    }
                  : {
                      border: `1px solid ${colors.zinc[200]}`,
                      color: colors.zinc[700],
                      backgroundColor: "transparent",
                    }),
              }}
            >
              {cancelText}
            </button>

            <button
              ref={lastButtonRef}
              onClick={onConfirm}
              //   className="dialog-button dialog-button-confirm"
              onKeyDown={handleConfirmKeyDown}
              onMouseEnter={handleConfirmMouseEnter}
              onMouseLeave={handleConfirmMouseLeave}
              onFocus={handleConfirmFocus}
              onBlur={handleConfirmBlur}
              aria-label={confirmText}
              data-testid="dialog-confirm-button"
              style={{
                // borderRadius: "8px",
                flex: 1,
                borderRadius: "0.5rem",
                backgroundColor: colors.red[500],
                padding: `${spacing[2.5]} ${spacing[4]}`,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.white,
                transition: "background-color 0.2s",
                border: 0,
                cursor: "pointer",
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Optional: Default export for convenience
// export default Dialog;
