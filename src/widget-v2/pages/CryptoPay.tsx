import React, { useState, useRef, useMemo } from "react";
import { cn } from "../lib/utils";
import { useDeposit } from "../context/DepositContext";
import { useRouteBuilder } from "../hooks/useRouteBuilder";
import { useTokens } from "../hooks/useTokens";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { TokenSwipePill } from "../components/TokenSwipePill";
import { SwipeToConfirmTokens } from "../components/SwipeToConfirmTokens";
import { AmountSlider } from "../components/AmountSlider";
import { TrustwareConfigStore } from "../../config/store";

export interface CryptoPayProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * CryptoPay confirmation page.
 * Displays transaction summary with fees and allows last-minute token changes.
 * Includes SwipeToConfirmTokens for secure transaction confirmation.
 */
export function CryptoPay({ className }: CryptoPayProps): React.ReactElement {
  const {
    amount,
    setAmount,
    selectedToken,
    setSelectedToken,
    selectedChain,
    walletAddress,
    walletStatus,
    goBack,
    setCurrentStep,
  } = useDeposit();

  const [isEditing, setIsEditing] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Get route info with fees
  const { isLoadingRoute, networkFees, estimatedReceive, error: routeError, routeResult } = useRouteBuilder();

  // Transaction submission hook
  const { isSubmitting, submitTransaction } = useTransactionSubmit();

  // Get available tokens for the selected chain
  const { tokens } = useTokens(selectedChain?.chainId ?? null);

  // Get destination config from SDK config
  const destinationConfig = useMemo(() => {
    try {
      const config = TrustwareConfigStore.get();
      return {
        toChain: config.routes.toChain,
        toToken: config.routes.toToken,
        toAddress: config.routes.toAddress,
      };
    } catch {
      return null;
    }
  }, []);

  // Parse amount for display
  const parsedAmount = parseFloat(amount) || 0;

  // Calculate token amount from USD
  const tokenAmount = useMemo(() => {
    if (!selectedToken || parsedAmount === 0) return 0;
    // For simplicity, assume 1:1 for stablecoins, otherwise we'd need price data
    // In production this would come from the route result
    return parsedAmount;
  }, [selectedToken, parsedAmount]);

  // Max amount based on token balance (if available)
  const maxAmount = useMemo(() => {
    if (!selectedToken?.balance) return 1000; // Default max
    // Parse balance and convert from smallest unit
    const balance = parseFloat(selectedToken.balance);
    if (isNaN(balance)) return 1000;
    // Assume balance is in token units (already converted)
    return Math.min(balance, 10000); // Cap at 10k for slider
  }, [selectedToken]);

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
   * Handle slider value change
   */
  const handleSliderChange = (value: number) => {
    setAmount(value.toString());
  };

  /**
   * Handle token change from TokenSwipePill
   */
  const handleTokenChange = (token: typeof selectedToken) => {
    if (token) {
      setSelectedToken(token);
    }
  };

  /**
   * Handle expand click to navigate to token selection
   */
  const handleExpandTokens = () => {
    setCurrentStep("select-token");
  };

  /**
   * Handle swipe confirmation - submit transaction to wallet
   */
  const handleConfirm = async () => {
    if (!routeResult) {
      // No route result available, show error
      return;
    }

    // Submit the transaction to the wallet for signing
    // The hook handles all state updates (confirming -> processing or error)
    await submitTransaction(routeResult);
  };

  const isWalletConnected = walletStatus === "connected";
  const canConfirm =
    parsedAmount > 0 &&
    selectedToken &&
    isWalletConnected &&
    !isLoadingRoute &&
    !isSubmitting &&
    !!routeResult;

  return (
    <div className={cn("tw-flex tw-flex-col tw-min-h-[500px]", className)}>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-px-4 tw-py-4 tw-border-b tw-border-border">
        <button
          type="button"
          onClick={goBack}
          className="tw-p-1 tw-mr-2 tw-rounded-lg hover:tw-bg-muted/50 tw-transition-colors"
          aria-label="Go back"
        >
          <svg className="tw-w-5 tw-h-5 tw-text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="tw-flex-1 tw-text-lg tw-font-semibold tw-text-foreground tw-text-center tw-mr-7">
          Confirm Deposit
        </h1>
      </div>

      {/* Content */}
      <div className="tw-flex-1 tw-px-6 tw-overflow-y-auto tw-flex tw-flex-col tw-items-center">
        {/* Enter Amount Label */}
        <p className="tw-text-base tw-text-muted-foreground tw-mb-4 tw-mt-4">
          Enter an amount
        </p>

        {/* Large Amount Display */}
        <div className="tw-text-center tw-relative tw-mb-4">
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

        {/* Token Amount Conversion */}
        {selectedToken && (
          <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2">
            <span className="tw-text-lg tw-text-muted-foreground">
              {tokenAmount > 0
                ? tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 5 })
                : "0"}{" "}
              {selectedToken.symbol}
            </span>
            <svg
              className="tw-w-4 tw-h-4 tw-text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
        )}

        {/* Balance + Max Button */}
        {selectedToken?.balance && (
          <div className="tw-flex tw-items-center tw-gap-3 tw-mt-2">
            <span className="tw-text-sm tw-font-semibold tw-text-primary">
              Balance {parseFloat(selectedToken.balance).toLocaleString(undefined, { maximumFractionDigits: 8 })}
            </span>
            <button
              type="button"
              onClick={() => handleSliderChange(maxAmount)}
              className="tw-px-3 tw-py-1 tw-text-xs tw-font-medium tw-text-muted-foreground tw-bg-muted tw-rounded-full hover:tw-bg-muted/80 tw-transition-colors tw-border-0"
            >
              Max
            </button>
          </div>
        )}

        {/* Token Swipe Pill */}
        {selectedToken && tokens.length > 0 && (
          <div className="tw-mt-6 tw-flex tw-flex-col tw-gap-3">
            <TokenSwipePill
              tokens={tokens}
              selectedToken={selectedToken}
              onTokenChange={handleTokenChange}
              onExpandClick={handleExpandTokens}
              selectedChain={selectedChain}
              walletAddress={walletAddress}
            />
          </div>
        )}

        {/* Amount Slider */}
        <div className="tw-w-full tw-mt-8 tw-px-2">
          <AmountSlider
            value={parsedAmount}
            onChange={handleSliderChange}
            max={maxAmount}
            disabled={!selectedToken}
          />
        </div>

        {/* Fee Summary */}
        <div className="tw-w-full tw-mt-6 tw-p-4 tw-rounded-xl tw-bg-muted/50 tw-space-y-2">
          {isLoadingRoute ? (
            <div className="tw-flex tw-items-center tw-justify-center tw-py-2">
              <svg
                className="tw-w-5 tw-h-5 tw-text-muted-foreground tw-animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="tw-opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="tw-opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="tw-ml-2 tw-text-sm tw-text-muted-foreground">
                Calculating fees...
              </span>
            </div>
          ) : routeError ? (
            <div className="tw-text-center tw-py-2">
              <p className="tw-text-sm tw-text-destructive">{routeError}</p>
            </div>
          ) : (
            <>
              {/* Network Fee */}
              <div className="tw-flex tw-justify-between tw-text-sm">
                <span className="tw-text-muted-foreground">Network fee</span>
                <span className="tw-font-medium tw-text-foreground">
                  {networkFees ? `$${networkFees}` : "—"}
                </span>
              </div>

              {/* Divider */}
              <div className="tw-h-px tw-bg-border tw-my-2" />

              {/* You'll receive */}
              <div className="tw-flex tw-justify-between">
                <span className="tw-text-muted-foreground tw-text-sm">You&apos;ll receive</span>
                <span className="tw-font-semibold tw-text-foreground">
                  {estimatedReceive
                    ? `~${parseFloat(estimatedReceive).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : parsedAmount > 0
                      ? `~$${(parsedAmount * 0.99).toFixed(2)}`
                      : "—"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Action - Swipe to Confirm */}
      <div className="tw-px-6 tw-py-4">
        {selectedToken && (
          <SwipeToConfirmTokens
            fromToken={selectedToken}
            toTokenSymbol={destinationConfig?.toToken || "USDC"}
            toChainName={destinationConfig?.toChain || "Base"}
            onConfirm={handleConfirm}
            disabled={!canConfirm}
            isWalletConnected={isWalletConnected}
          />
        )}
      </div>

      {/* Footer */}
      <div className="tw-px-6 tw-py-4 tw-border-t tw-border-border/30">
        <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
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

export default CryptoPay;
