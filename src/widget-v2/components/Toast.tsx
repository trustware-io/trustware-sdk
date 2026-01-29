import React, { useEffect, useState, useCallback } from "react";
import { mergeStyles } from "../lib/utils";
import { colors, spacing, fontSize, fontWeight, shadows, borderRadius } from "../styles/tokens";

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}

interface ToastProps extends ToastData {
  onDismiss: (id: string) => void;
}

const baseToastStyle: React.CSSProperties = {
  pointerEvents: "auto",
  position: "relative",
  display: "flex",
  width: "100%",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing[3],
  overflow: "hidden",
  borderRadius: borderRadius.lg,
  border: "1px solid",
  padding: spacing[4],
  boxShadow: shadows.lg,
  transition: "all 0.2s ease-out",
};

const variantStyles: Record<ToastData["variant"] & string, React.CSSProperties> = {
  default: {
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.foreground,
  },
  destructive: {
    borderColor: "rgba(239, 68, 68, 0.5)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: colors.red[600],
  },
  success: {
    borderColor: "rgba(34, 197, 94, 0.5)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    color: colors.green[600],
  },
};

const iconContainerStyle: React.CSSProperties = {
  flexShrink: 0,
};

const iconStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  margin: 0,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  opacity: 0.8,
  marginTop: spacing[0.5],
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  borderRadius: "0.375rem",
  padding: spacing[1],
  opacity: 0.7,
  transition: "opacity 0.2s",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "inherit",
};

const closeIconStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
};

/**
 * Individual Toast notification component
 */
function ToastItem({
  id,
  title,
  description,
  variant = "default",
  duration = 4000,
  onDismiss,
}: ToastProps): React.ReactElement {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    if (isExiting) {
      const exitTimer = setTimeout(() => {
        onDismiss(id);
      }, 200); // Animation duration
      return () => clearTimeout(exitTimer);
    }
  }, [isExiting, id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
  };

  const toastStyle = mergeStyles(
    baseToastStyle,
    variantStyles[variant] || variantStyles.default,
    isExiting
      ? { opacity: 0, transform: "translateX(1rem)" }
      : { opacity: 1, transform: "translateX(0)" }
  );

  return (
    <div role="alert" aria-live="assertive" style={toastStyle}>
      {/* Icon based on variant */}
      <div style={iconContainerStyle}>
        {variant === "destructive" && (
          <svg
            style={iconStyle}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        {variant === "success" && (
          <svg
            style={iconStyle}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {variant === "default" && (
          <svg
            style={iconStyle}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
      </div>

      {/* Content */}
      <div style={contentStyle}>
        <p style={titleStyle}>{title}</p>
        {description && <p style={descriptionStyle}>{description}</p>}
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        style={closeButtonStyle}
        aria-label="Dismiss"
      >
        <svg
          style={closeIconStyle}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// Global toast state management
type ToastListener = (toasts: ToastData[]) => void;
const listeners: ToastListener[] = [];
let toasts: ToastData[] = [];
let toastId = 0;

function notifyListeners() {
  listeners.forEach((listener) => listener([...toasts]));
}

/**
 * Show a toast notification
 */
export function toast(data: Omit<ToastData, "id"> | string): {
  dismiss: () => void;
} {
  const id = String(++toastId);
  const toastData: ToastData =
    typeof data === "string" ? { id, title: data } : { ...data, id };

  toasts = [toastData, ...toasts].slice(0, 3); // Limit to 3 toasts
  notifyListeners();

  return {
    dismiss: () => {
      toasts = toasts.filter((t) => t.id !== id);
      notifyListeners();
    },
  };
}

/**
 * Convenience methods for common toast types
 */
toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "destructive" });

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });

const containerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: spacing[4],
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 50,
  display: "flex",
  flexDirection: "column",
  gap: spacing[2],
  width: "100%",
  maxWidth: "380px",
  padding: `0 ${spacing[4]}`,
  pointerEvents: "none",
};

/**
 * ToastContainer - Renders all active toasts
 * Must be included in your component tree (typically in WidgetContainer)
 */
export function ToastContainer(): React.ReactElement | null {
  const [activeToasts, setActiveToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const listener: ToastListener = (newToasts) => {
      setActiveToasts(newToasts);
    };
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, []);

  if (activeToasts.length === 0) {
    return null;
  }

  return (
    <div style={containerStyle}>
      {activeToasts.map((toastData) => (
        <ToastItem
          key={toastData.id}
          {...toastData}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

export default ToastContainer;
