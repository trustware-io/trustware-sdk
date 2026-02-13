import React, { useState, useRef, useMemo } from "react";
import { mergeStyles } from "../lib/utils";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/tokens";
import { useDeposit } from "../context/DepositContext";
import { useRouteBuilder } from "../hooks/useRouteBuilder";
import { useTokens } from "../hooks/useTokens";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { TokenSwipePill } from "../components/TokenSwipePill";
import { SwipeToConfirmTokens } from "../components/SwipeToConfirmTokens";
import { AmountSlider } from "../components/AmountSlider";
import { TrustwareConfigStore } from "../../config/store";
import { getBalances } from "src/core/balances";

export interface CryptoPayProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

// Styles
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "500px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: `${spacing[4]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border}`,
};

const backButtonStyle: React.CSSProperties = {
  padding: spacing[1],
  marginRight: spacing[2],
  borderRadius: borderRadius.lg,
  transition: "background-color 0.2s",
  backgroundColor: "transparent",
  border: 0,
  cursor: "pointer",
};

const backIconStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  color: colors.foreground,
};

const headerTitleStyle: React.CSSProperties = {
  flex: 1,
  fontSize: fontSize.lg,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
  textAlign: "center",
  marginRight: "1.75rem",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: `0 ${spacing[6]}`,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const enterAmountLabelStyle: React.CSSProperties = {
  fontSize: fontSize.base,
  color: colors.mutedForeground,
  marginBottom: spacing[4],
  marginTop: spacing[4],
};

const amountDisplayContainerStyle: React.CSSProperties = {
  textAlign: "center",
  position: "relative",
  marginBottom: spacing[4],
};

const amountDisplayStyle: React.CSSProperties = {
  fontSize: "3.75rem",
  fontWeight: fontWeight.bold,
  letterSpacing: "-0.025em",
  cursor: "pointer",
};

const dollarSignStyle: React.CSSProperties = {
  color: colors.foreground,
};

const amountValueContainerStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
  minWidth: "1ch",
};

const amountInputStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  backgroundColor: "transparent",
  border: "none",
  outline: "none",
  padding: 0,
  margin: 0,
  textAlign: "center",
  color: "transparent",
  fontSize: "3.75rem",
  fontWeight: fontWeight.bold,
  letterSpacing: "-0.025em",
  caretColor: "hsl(var(--tw-muted-foreground) / 0.5)",
};

const tokenConversionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  marginTop: spacing[2],
};

const tokenAmountStyle: React.CSSProperties = {
  fontSize: fontSize.lg,
  color: colors.mutedForeground,
};

const conversionIconStyle: React.CSSProperties = {
  width: "1rem",
  height: "1rem",
  color: colors.mutedForeground,
};

const balanceContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  marginTop: spacing[2],
};

const balanceTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: colors.primary,
};

const maxButtonStyle: React.CSSProperties = {
  padding: `${spacing[1]} ${spacing[3]}`,
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  color: colors.mutedForeground,
  backgroundColor: colors.muted,
  borderRadius: "9999px",
  transition: "background-color 0.2s",
  border: 0,
  cursor: "pointer",
};

const tokenPillContainerStyle: React.CSSProperties = {
  marginTop: spacing[6],
  display: "flex",
  flexDirection: "column",
  gap: spacing[3],
};

const sliderContainerStyle: React.CSSProperties = {
  width: "100%",
  marginTop: spacing[8],
  padding: `0 ${spacing[2]}`,
};

const feeSummaryStyle: React.CSSProperties = {
  width: "100%",
  marginTop: spacing[6],
  padding: spacing[4],
  borderRadius: borderRadius.xl,
  backgroundColor: "rgba(63, 63, 70, 0.5)",
};

const feeLoadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `${spacing[2]} 0`,
};

const spinnerStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  color: colors.mutedForeground,
};

const feeLoadingTextStyle: React.CSSProperties = {
  marginLeft: spacing[2],
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

const feeErrorStyle: React.CSSProperties = {
  textAlign: "center",
  padding: `${spacing[2]} 0`,
};

const feeErrorTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.destructive,
};

const feeRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: fontSize.sm,
};

const feeLabelStyle: React.CSSProperties = {
  color: colors.mutedForeground,
};

const feeValueStyle: React.CSSProperties = {
  fontWeight: fontWeight.medium,
  color: colors.foreground,
};

const feeDividerStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: colors.border,
  margin: `${spacing[2]} 0`,
};

const receiveRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
};

const receiveLabelStyle: React.CSSProperties = {
  color: colors.mutedForeground,
  fontSize: fontSize.sm,
};

const receiveValueStyle: React.CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};

const actionContainerStyle: React.CSSProperties = {
  padding: `${spacing[4]} ${spacing[6]}`,
};

const footerStyle: React.CSSProperties = {
  padding: `${spacing[4]} ${spacing[6]}`,
  borderTop: `1px solid rgba(63, 63, 70, 0.3)`,
};

const footerContentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
};

const lockIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
  color: colors.mutedForeground,
};

const footerTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

const footerBrandStyle: React.CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};

function usdToTokenAmount(amt: string, tkPrice: string | undefined): number {
  if (tkPrice === undefined || tkPrice === "0") return 0;
  return Number(amt) / Number(tkPrice);
}
/**
 * CryptoPay confirmation page.
 * Displays transaction summary with fees and allows last-minute token changes.
 * Includes SwipeToConfirmTokens for secure transaction confirmation.
 */
export function CryptoPay({ style }: CryptoPayProps): React.ReactElement {
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
  const {
    isLoadingRoute,
    networkFees,
    estimatedReceive,
    error: routeError,
    routeResult,
  } = useRouteBuilder();

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

  // Minimum deposit from SDK config
  const minDeposit = useMemo(() => {
    try {
      const config = TrustwareConfigStore.get();
      const raw = config.routes.options?.minAmountOut;
      return raw ? Number(raw) : 0;
    } catch {
      return 0;
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

  const maxAmountUSD = useMemo(() => {
    if (!selectedToken?.usdPrice || !selectedToken?.balance) return 1000; // Default max
    // Parse balance and convert from smallest unit
    const balance = parseFloat(selectedToken.balance);
    if (isNaN(balance)) return 1000;
    // Assume balance is in token units (already converted)

    return Math.min(balance * selectedToken.usdPrice, 10000); // Cap at 10k for slider
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

  const _combinedAmountObj = useMemo(() => {
    if (selectedToken?.usdPrice !== undefined) {
      const tokenAmt = usdToTokenAmount(
        amount,
        selectedToken.usdPrice.toString()
      );
      return {
        usdAmount: amount,
        tokenAmount: tokenAmt.toString(),
      };
    }
    return undefined;
  }, [selectedToken?.usdPrice, amount]);

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
  const handleTokenChange = async (token: typeof selectedToken) => {
    if (token) {
      if (token.balance !== undefined) return setSelectedToken(token);

      const balance = await getBalances(
        selectedChain?.chainId as string | number,
        walletAddress as string
      );

      const match = balance.find(
        (b) => b.contract?.toLowerCase() === token.address.toLowerCase()
      );
      const tokenWithBalance = {
        ...token,
        balance: (match
          ? Number(match.balance) / 10 ** token.decimals
          : "0"
        ).toString(),
      };

      setSelectedToken(tokenWithBalance);
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
    <div style={mergeStyles(containerStyle, style)}>
      {/* Header */}
      <div style={headerStyle}>
        <button
          type="button"
          onClick={goBack}
          style={backButtonStyle}
          aria-label="Go back"
        >
          <svg
            style={backIconStyle}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 style={headerTitleStyle}>Confirm Deposit</h1>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {/* Enter Amount Label */}
        <p style={enterAmountLabelStyle}>Enter an amount</p>

        {/* Large Amount Display */}
        <div style={amountDisplayContainerStyle}>
          <span style={amountDisplayStyle} onClick={handleAmountClick}>
            <span style={dollarSignStyle}>$</span>
            <span style={amountValueContainerStyle}>
              <span
                style={{
                  color:
                    parsedAmount > 0
                      ? colors.foreground
                      : "rgba(161, 161, 170, 0.4)",
                }}
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
                <span style={{ color: "rgba(161, 161, 170, 0.4)" }}>.00</span>
              )}
              <input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                onBlur={() => setIsEditing(false)}
                style={amountInputStyle}
                aria-label="Deposit amount"
              />
            </span>
          </span>
        </div>

        {/* Token Amount Conversion */}
        {selectedToken && (
          <div style={tokenConversionStyle}>
            <span style={tokenAmountStyle}>
              {Number(_combinedAmountObj?.tokenAmount ?? 0) > 0
                ? parseFloat(
                    (_combinedAmountObj?.tokenAmount ?? 0).toString()
                  ).toLocaleString(undefined, {
                    maximumFractionDigits: 5,
                  })
                : "0"}{" "}
              {selectedToken.symbol}
            </span>
            <svg
              style={conversionIconStyle}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </div>
        )}

        {/* Balance + Max Button */}
        {selectedToken?.balance && (
          <div style={balanceContainerStyle}>
            <span style={balanceTextStyle}>
              Balance{" "}
              {parseFloat(selectedToken.balance).toLocaleString(undefined, {
                maximumFractionDigits: 8,
              })}
            </span>
            <button
              type="button"
              onClick={() => handleSliderChange(maxAmount)}
              style={maxButtonStyle}
            >
              Max
            </button>
          </div>
        )}

        {/* Token Swipe Pill */}
        {selectedToken && tokens.length > 0 && (
          <div style={tokenPillContainerStyle}>
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
        <div style={sliderContainerStyle}>
          <AmountSlider
            value={parsedAmount}
            onChange={handleSliderChange}
            max={maxAmountUSD}
            min={minDeposit}
            disabled={!selectedToken}
          />
        </div>

        {/* Fee Summary */}
        <div style={feeSummaryStyle}>
          {isLoadingRoute ? (
            <div style={feeLoadingStyle}>
              <svg
                style={spinnerStyle}
                viewBox="0 0 24 24"
                fill="none"
                className="tw-animate-spin"
              >
                <circle
                  style={{ opacity: 0.25 }}
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  style={{ opacity: 0.75 }}
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span style={feeLoadingTextStyle}>Calculating fees...</span>
            </div>
          ) : routeError ? (
            <div style={feeErrorStyle}>
              <p style={feeErrorTextStyle}>{routeError}</p>
            </div>
          ) : (
            <>
              {/* Network Fee */}
              <div style={feeRowStyle}>
                <span style={feeLabelStyle}>Network fee</span>
                <span style={feeValueStyle}>
                  {networkFees ? `$${networkFees}` : "—"}
                </span>
              </div>

              {/* Divider */}
              <div style={feeDividerStyle} />

              {/* You'll receive */}
              <div style={receiveRowStyle}>
                <span style={receiveLabelStyle}>You&apos;ll receive</span>
                <span style={receiveValueStyle}>
                  {estimatedReceive
                    ? `~$${parseFloat(estimatedReceive).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
      <div style={actionContainerStyle}>
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
      <div style={footerStyle}>
        <div style={footerContentStyle}>
          <svg
            style={lockIconStyle}
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
          <span style={footerTextStyle}>
            Secured by <span style={footerBrandStyle}>Trustware</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default CryptoPay;
