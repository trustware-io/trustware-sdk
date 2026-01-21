import React, { useState, useRef } from "react";
import { cn } from "../lib/utils";
import { useDeposit, type PaymentMethodType } from "../context/DepositContext";

/**
 * Fiat payment option definition
 */
interface FiatOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

/**
 * Available fiat payment options (all coming soon)
 */
const fiatOptions: FiatOption[] = [
  {
    id: "applepay",
    name: "Apple Pay",
    icon: (
      <svg className="tw-w-5 tw-h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
    ),
  },
  {
    id: "mpesa",
    name: "M-Pesa",
    icon: (
      <svg className="tw-w-5 tw-h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
  },
  {
    id: "venmo",
    name: "Venmo",
    icon: (
      <svg className="tw-w-5 tw-h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3h-15C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zm-4.77 11.58c-.64 1.56-2.13 3.42-3.86 3.42H8.69l-.61-3.55 1.13-.21.28 1.64c.25.14.52.22.79.22.68 0 1.31-.48 1.74-1.34.33-.67.44-1.34.44-1.92 0-.45-.11-.82-.38-1.06-.24-.22-.58-.33-.98-.33-.64 0-1.29.28-1.86.61l-.05-.02.61-4.04h4.13l-.16 1.11H11l-.21 1.4c.41-.13.85-.19 1.28-.19.71 0 1.31.2 1.73.61.46.44.67 1.08.67 1.88 0 .68-.15 1.35-.48 2.01z" />
      </svg>
    ),
  },
  {
    id: "zelle",
    name: "Zelle",
    icon: (
      <svg className="tw-w-5 tw-h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.25 4H5.5C4.67 4 4 4.67 4 5.5v13c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5v-7.75h-2v6.25H6V7h7.25V4zm3.91 2.83L9.83 14.17l-1.42-1.41 7.33-7.34L13.83 3.5h6.67v6.67l-1.92-1.92-1.42-1.42z" />
      </svg>
    ),
  },
];

export interface HomeProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Home page for the deposit widget.
 * Displays a large amount input and continue button to navigate to token selection.
 */
export function Home({ className }: HomeProps): React.ReactElement {
  const { amount, setAmount, setCurrentStep, selectedToken, paymentMethod, setPaymentMethod } = useDeposit();
  const [isEditing, setIsEditing] = useState(false);
  const [showFiatMessage, setShowFiatMessage] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle payment method selection
   */
  const handlePaymentMethodSelect = (method: PaymentMethodType) => {
    setPaymentMethod(method);
    if (method === "fiat") {
      setShowFiatMessage(true);
    } else {
      setShowFiatMessage(false);
    }
  };

  // Parse amount for display
  const parsedAmount = parseFloat(amount) || 0;

  /**
   * Handle amount input changes with decimal sanitization
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    // Handle multiple decimal points - keep only the first one
    const parts = raw.split(".");
    const sanitized =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
    setAmount(sanitized);
  };

  /**
   * Handle click on the amount display to start editing
   */
  const handleAmountClick = () => {
    const isZeroish = !amount || parseFloat(amount) === 0;
    setIsEditing(true);
    if (isZeroish) setAmount("");

    setTimeout(() => {
      const input = amountInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, 0);
    }, 0);
  };

  /**
   * Handle continue button click
   */
  const handleContinue = () => {
    setCurrentStep("select-token");
  };

  // Continue is enabled when there's a valid amount AND crypto is selected
  const canContinue = parsedAmount > 0 && paymentMethod === "crypto";

  return (
    <div className={cn("tw-flex tw-flex-col tw-min-h-[500px]", className)}>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-center tw-px-4 tw-py-4 tw-border-b tw-border-border">
        <h1 className="tw-text-lg tw-font-semibold tw-text-foreground">
          Deposit
        </h1>
      </div>

      {/* Content */}
      <div className="tw-flex-1 tw-px-6 tw-overflow-y-auto tw-flex tw-flex-col tw-items-center tw-justify-center">
        {/* Enter Amount Label */}
        <p className="tw-text-base tw-text-muted-foreground tw-mb-4">
          Enter an amount
        </p>

        {/* Large Amount Display */}
        <div className="tw-text-center tw-relative tw-mb-8">
          <span
            className="tw-text-6xl tw-font-bold tw-tracking-tight tw-cursor-pointer"
            onClick={handleAmountClick}
          >
            <span className="tw-text-foreground">$</span>
            <span className="tw-relative tw-inline-block tw-min-w-[1ch]">
              <span
                className={
                  parsedAmount > 0
                    ? "tw-text-foreground"
                    : "tw-text-muted-foreground/40"
                }
              >
                {isEditing
                  ? amount || "0"
                  : parsedAmount > 0
                    ? parsedAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0"}
              </span>
              {!isEditing && parsedAmount === 0 && (
                <span className="tw-text-muted-foreground/40">.00</span>
              )}
              <input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                onBlur={() => setIsEditing(false)}
                className="tw-absolute tw-inset-0 tw-w-full tw-bg-transparent tw-border-none tw-outline-none tw-p-0 tw-m-0 tw-text-center tw-text-transparent tw-text-6xl tw-font-bold tw-tracking-tight"
                style={{ caretColor: "hsl(var(--tw-muted-foreground) / 0.5)" }}
                aria-label="Deposit amount"
              />
            </span>
          </span>
        </div>

        {/* Selected Token Display (if any) */}
        {selectedToken && (
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4 tw-px-4 tw-py-2 tw-bg-muted/50 tw-rounded-full">
            {selectedToken.iconUrl && (
              <img
                src={selectedToken.iconUrl}
                alt={selectedToken.symbol}
                className="tw-w-5 tw-h-5 tw-rounded-full"
              />
            )}
            <span className="tw-text-sm tw-font-medium tw-text-foreground">
              {selectedToken.symbol}
            </span>
          </div>
        )}

        {/* Payment Method Selector */}
        <div className="tw-w-full tw-max-w-xs tw-mt-4">
          <p className="tw-text-sm tw-text-muted-foreground tw-text-center tw-mb-3">
            Pay with
          </p>

          {/* Crypto Option - Always available */}
          <button
            onClick={() => handlePaymentMethodSelect("crypto")}
            className={cn(
              "tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-3 tw-rounded-xl tw-border tw-transition-all tw-duration-200 tw-mb-2",
              paymentMethod === "crypto"
                ? "tw-border-primary tw-bg-primary/10"
                : "tw-border-border tw-bg-muted/30 hover:tw-bg-muted/50"
            )}
          >
            {/* Crypto Icon */}
            <div className={cn(
              "tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center",
              paymentMethod === "crypto" ? "tw-bg-primary/20" : "tw-bg-muted"
            )}>
              <svg
                className={cn(
                  "tw-w-4 tw-h-4",
                  paymentMethod === "crypto" ? "tw-text-primary" : "tw-text-muted-foreground"
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="tw-flex-1 tw-text-left">
              <span className={cn(
                "tw-text-sm tw-font-medium",
                paymentMethod === "crypto" ? "tw-text-foreground" : "tw-text-foreground"
              )}>
                Crypto
              </span>
            </div>
            {/* Selection indicator */}
            <div className={cn(
              "tw-w-5 tw-h-5 tw-rounded-full tw-border-2 tw-flex tw-items-center tw-justify-center tw-transition-all",
              paymentMethod === "crypto"
                ? "tw-border-primary tw-bg-primary"
                : "tw-border-muted-foreground/30"
            )}>
              {paymentMethod === "crypto" && (
                <svg className="tw-w-3 tw-h-3 tw-text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>

          {/* Fiat Option - Coming Soon */}
          <button
            onClick={() => handlePaymentMethodSelect("fiat")}
            className={cn(
              "tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-3 tw-rounded-xl tw-border tw-transition-all tw-duration-200",
              paymentMethod === "fiat"
                ? "tw-border-amber-500/50 tw-bg-amber-500/10"
                : "tw-border-border tw-bg-muted/30 hover:tw-bg-muted/50"
            )}
          >
            {/* Credit Card Icon */}
            <div className={cn(
              "tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center",
              paymentMethod === "fiat" ? "tw-bg-amber-500/20" : "tw-bg-muted"
            )}>
              <svg
                className={cn(
                  "tw-w-4 tw-h-4",
                  paymentMethod === "fiat" ? "tw-text-amber-600" : "tw-text-muted-foreground"
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="tw-flex-1 tw-text-left">
              <span className={cn(
                "tw-text-sm tw-font-medium",
                paymentMethod === "fiat" ? "tw-text-foreground" : "tw-text-foreground"
              )}>
                Fiat
              </span>
              <div className="tw-flex tw-items-center tw-gap-1.5 tw-mt-0.5">
                {fiatOptions.slice(0, 3).map((option) => (
                  <span key={option.id} className="tw-text-muted-foreground tw-opacity-60">
                    {option.icon}
                  </span>
                ))}
                <span className="tw-text-xs tw-text-muted-foreground">+{fiatOptions.length - 3}</span>
              </div>
            </div>
            {/* Coming Soon Badge */}
            <span className="tw-text-[10px] tw-font-medium tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-amber-500/20 tw-text-amber-600 tw-whitespace-nowrap">
              Coming Soon
            </span>
          </button>

          {/* Fiat Coming Soon Message */}
          {showFiatMessage && paymentMethod === "fiat" && (
            <div className="tw-mt-3 tw-p-3 tw-rounded-lg tw-bg-amber-500/10 tw-border tw-border-amber-500/30">
              <p className="tw-text-xs tw-text-amber-700 dark:tw-text-amber-400 tw-text-center">
                Fiat payments including Apple Pay, M-Pesa, Venmo, and more are coming soon.
                For now, please use crypto to complete your deposit.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer with Continue Button */}
      <div className="tw-px-6 tw-py-4 tw-border-t tw-border-border/30">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={cn(
            "tw-w-full tw-py-3 tw-px-6 tw-rounded-full tw-font-semibold tw-text-base tw-transition-all tw-duration-200",
            canContinue
              ? "tw-bg-primary tw-text-primary-foreground hover:tw-opacity-90"
              : "tw-bg-muted tw-text-muted-foreground tw-cursor-not-allowed"
          )}
        >
          Continue
        </button>

        {/* Secured by footer */}
        <div className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-mt-4">
          <svg
            className="tw-w-3.5 tw-h-3.5 tw-text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="tw-text-sm tw-text-muted-foreground">
            Secured by{" "}
            <span className="tw-font-semibold tw-text-foreground">
              Trustware
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Home;
