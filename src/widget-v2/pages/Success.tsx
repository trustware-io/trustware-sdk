import React, { lazy, Suspense, useMemo } from "react";
import { mergeStyles } from "../lib/utils";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/tokens";
import { useDeposit } from "../context/DepositContext";
import { useTransactionPolling } from "../hooks/useTransactionPolling";

// Lazy load the ConfettiEffect to reduce initial bundle size
const ConfettiEffect = lazy(() => import("../components/ConfettiEffect"));

export interface SuccessProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * Truncates a transaction hash for display
 */
function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
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
  justifyContent: "center",
  padding: `${spacing[4]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border}`,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: fontSize.lg,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: `${spacing[8]} ${spacing[6]}`,
};

const successIconContainerStyle: React.CSSProperties = {
  width: "5rem",
  height: "5rem",
  borderRadius: "9999px",
  backgroundColor: "rgba(34, 197, 94, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: spacing[6],
};

const successIconStyle: React.CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  color: colors.green[500],
};

const successTitleStyle: React.CSSProperties = {
  fontSize: fontSize["2xl"],
  fontWeight: fontWeight.bold,
  color: colors.foreground,
  textAlign: "center",
  marginBottom: spacing[2],
};

const successMessageStyle: React.CSSProperties = {
  color: colors.mutedForeground,
  textAlign: "center",
  marginBottom: spacing[6],
};

const amountBoxStyle: React.CSSProperties = {
  backgroundColor: "rgba(63, 63, 70, 0.5)",
  borderRadius: borderRadius.xl,
  padding: `${spacing[4]} ${spacing[6]}`,
  marginBottom: spacing[6],
  textAlign: "center",
};

const amountLabelStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
  marginBottom: spacing[1],
};

const amountValueStyle: React.CSSProperties = {
  fontSize: fontSize["3xl"],
  fontWeight: fontWeight.bold,
  color: colors.foreground,
};

const tokenInfoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  marginTop: spacing[2],
};

const tokenIconStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  borderRadius: "9999px",
};

const tokenTextStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

const hashContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: spacing[1],
  marginBottom: spacing[8],
};

const hashLabelStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

const hashLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1.5],
  color: colors.primary,
  textDecoration: "none",
};

const hashTextStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: fontSize.sm,
};

const hashPlainStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: fontSize.sm,
  color: colors.foreground,
};

const externalIconStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
};

const doneButtonStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "20rem",
  padding: `${spacing[3]} ${spacing[6]}`,
  borderRadius: borderRadius.xl,
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
  fontWeight: fontWeight.semibold,
  fontSize: fontSize.base,
  transition: "background-color 0.2s",
  border: 0,
  cursor: "pointer",
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

/**
 * Success page component.
 * Displays a celebratory success screen with confetti when the deposit completes.
 */
export function Success({ style }: SuccessProps): React.ReactElement {
  const { transactionHash, selectedToken, selectedChain, amount, resetState } =
    useDeposit();

  // Get transaction details for explorer URL
  const { transaction } = useTransactionPolling();

  // Parse amount for display
  const parsedAmount = useMemo(() => parseFloat(amount) || 0, [amount]);

  // Get block explorer URL from transaction data or construct fallback
  const explorerUrl = useMemo(() => {
    // Prefer the destination chain URL if bridging completed
    if (transaction?.toChainTxUrl) {
      return transaction.toChainTxUrl;
    }
    // Fall back to source chain URL
    if (transaction?.fromChainTxUrl) {
      return transaction.fromChainTxUrl;
    }
    // Last fallback: construct URL based on chain if we have a hash
    if (transactionHash && selectedChain?.explorerUrl) {
      return `${selectedChain.explorerUrl}/tx/${transactionHash}`;
    }
    return null;
  }, [transaction, transactionHash, selectedChain]);

  /**
   * Handle Done button click - reset state and return to home
   */
  const handleDone = () => {
    resetState();
  };

  return (
    <div style={mergeStyles(containerStyle, style)}>
      {/* Confetti effect - lazy loaded */}
      <Suspense fallback={null}>
        <ConfettiEffect isActive={true} pieceCount={60} clearDelay={4000} />
      </Suspense>

      {/* Header */}
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>Deposit Complete</h1>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {/* Success Icon */}
        <div style={successIconContainerStyle}>
          <svg
            style={successIconStyle}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h2 style={successTitleStyle}>Success!</h2>
        <p style={successMessageStyle}>
          Your deposit has been completed successfully.
        </p>

        {/* Deposited Amount */}
        {selectedToken && parsedAmount > 0 && (
          <div style={amountBoxStyle}>
            <p style={amountLabelStyle}>Amount Deposited</p>
            <p style={amountValueStyle}>
              $
              {parsedAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <div style={tokenInfoStyle}>
              {selectedToken.iconUrl && (
                <img src={selectedToken.iconUrl} alt="" style={tokenIconStyle} />
              )}
              <span style={tokenTextStyle}>
                {selectedToken.symbol}
                {selectedChain && ` on ${selectedChain.name}`}
              </span>
            </div>
          </div>
        )}

        {/* Transaction Hash Link */}
        {transactionHash && (
          <div style={hashContainerStyle}>
            <span style={hashLabelStyle}>Transaction ID</span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={hashLinkStyle}
              >
                <span style={hashTextStyle}>
                  {truncateHash(transactionHash)}
                </span>
                <svg
                  style={externalIconStyle}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ) : (
              <span style={hashPlainStyle}>{truncateHash(transactionHash)}</span>
            )}
          </div>
        )}

        {/* Done Button */}
        <button type="button" onClick={handleDone} style={doneButtonStyle}>
          Done
        </button>
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
            aria-hidden="true"
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

export default Success;
