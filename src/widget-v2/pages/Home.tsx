import React, { useState, useRef } from "react";
import { cn } from "../lib/utils";
import { useDeposit } from "../context/DepositContext";

export interface HomeProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Home page for the deposit widget.
 * Displays a large amount input and continue button to navigate to token selection.
 */
export function Home({ className }: HomeProps): React.ReactElement {
  const { amount, setAmount, setCurrentStep, selectedToken } = useDeposit();
  const [isEditing, setIsEditing] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

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

  // Continue is enabled when there's a valid amount
  const canContinue = parsedAmount > 0;

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
