import React, { useEffect, useState, useCallback } from "react";
import { cn } from "../lib/utils";

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

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "tw-pointer-events-auto tw-relative tw-flex tw-w-full tw-items-center tw-justify-between tw-space-x-3 tw-overflow-hidden tw-rounded-lg tw-border tw-p-4 tw-shadow-lg tw-transition-all tw-duration-200",
        isExiting
          ? "tw-opacity-0 tw-translate-x-4"
          : "tw-opacity-100 tw-translate-x-0",
        variant === "default" &&
          "tw-border-border tw-bg-card tw-text-foreground",
        variant === "destructive" &&
          "tw-border-red-500/50 tw-bg-red-500/10 tw-text-red-600 dark:tw-text-red-400",
        variant === "success" &&
          "tw-border-green-500/50 tw-bg-green-500/10 tw-text-green-600 dark:tw-text-green-400"
      )}
    >
      {/* Icon based on variant */}
      <div className="tw-flex-shrink-0">
        {variant === "destructive" && (
          <svg
            className="tw-w-5 tw-h-5"
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
            className="tw-w-5 tw-h-5"
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
            className="tw-w-5 tw-h-5"
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
      <div className="tw-flex-1 tw-min-w-0">
        <p className="tw-text-sm tw-font-semibold">{title}</p>
        {description && (
          <p className="tw-text-sm tw-opacity-80 tw-mt-0.5">{description}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="tw-flex-shrink-0 tw-rounded-md tw-p-1 tw-opacity-70 hover:tw-opacity-100 tw-transition-opacity"
        aria-label="Dismiss"
      >
        <svg
          className="tw-w-4 tw-h-4"
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
export function toast(
  data: Omit<ToastData, "id"> | string
): { dismiss: () => void } {
  const id = String(++toastId);
  const toastData: ToastData =
    typeof data === "string"
      ? { id, title: data }
      : { ...data, id };

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
    <div className="tw-fixed tw-bottom-4 tw-left-1/2 tw--translate-x-1/2 tw-z-50 tw-flex tw-flex-col tw-gap-2 tw-w-full tw-max-w-[380px] tw-px-4 tw-pointer-events-none">
      {activeToasts.map((toastData) => (
        <ToastItem key={toastData.id} {...toastData} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

export default ToastContainer;
