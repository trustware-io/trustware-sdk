import React, { lazy, Suspense, useMemo } from "react";
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        ...style,
      }}
    >
      {/* Confetti effect - lazy loaded */}
      <Suspense fallback={null}>
        <ConfettiEffect isActive={true} pieceCount={60} clearDelay={4000} />
      </Suspense>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${spacing[4]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <h1
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.foreground,
          }}
        >
          Deposit Complete
        </h1>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: `${spacing[8]} ${spacing[6]}`,
        }}
      >
        {/* Success Icon */}
        <div
          style={{
            width: "5rem",
            height: "5rem",
            borderRadius: "9999px",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing[6],
          }}
        >
          <svg
            style={{
              width: "2.5rem",
              height: "2.5rem",
              color: colors.green[500],
            }}
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
        <h2
          style={{
            fontSize: fontSize["2xl"],
            fontWeight: fontWeight.bold,
            color: colors.foreground,
            textAlign: "center",
            marginBottom: spacing[2],
          }}
        >
          Success!
        </h2>
        <p
          style={{
            color: colors.mutedForeground,
            textAlign: "center",
            marginBottom: spacing[6],
          }}
        >
          Your deposit has been completed successfully.
        </p>

        {/* Deposited Amount */}
        {selectedToken && parsedAmount > 0 && (
          <div
            style={{
              backgroundColor: "rgba(63, 63, 70, 0.5)",
              borderRadius: borderRadius.xl,
              padding: `${spacing[4]} ${spacing[6]}`,
              marginBottom: spacing[6],
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
                marginBottom: spacing[1],
              }}
            >
              Amount Deposited
            </p>
            <p
              style={{
                fontSize: fontSize["3xl"],
                fontWeight: fontWeight.bold,
                color: colors.foreground,
              }}
            >
              $
              {parsedAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing[2],
                marginTop: spacing[2],
              }}
            >
              {selectedToken.iconUrl && (
                <img
                  src={selectedToken.iconUrl}
                  alt=""
                  style={{
                    width: "1.25rem",
                    height: "1.25rem",
                    borderRadius: "9999px",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: fontSize.sm,
                  color: colors.mutedForeground,
                }}
              >
                {selectedToken.symbol}
                {selectedChain && ` on ${selectedChain.name}`}
              </span>
            </div>
          </div>
        )}

        {/* Transaction Hash Link */}
        {transactionHash && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: spacing[1],
              marginBottom: spacing[8],
            }}
          >
            <span
              style={{
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
              }}
            >
              Transaction ID
            </span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[1.5],
                  color: colors.primary,
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: fontSize.sm,
                  }}
                >
                  {truncateHash(transactionHash)}
                </span>
                <svg
                  style={{
                    width: "0.875rem",
                    height: "0.875rem",
                  }}
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
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: fontSize.sm,
                  color: colors.foreground,
                }}
              >
                {truncateHash(transactionHash)}
              </span>
            )}
          </div>
        )}

        {/* Done Button */}
        <button
          type="button"
          onClick={handleDone}
          style={{
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
          }}
        >
          Done
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: `${spacing[4]} ${spacing[6]}`,
          borderTop: `1px solid rgba(63, 63, 70, 0.3)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[2],
          }}
        >
          <svg
            style={{
              width: "0.875rem",
              height: "0.875rem",
              color: colors.mutedForeground,
            }}
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
          <span
            style={{
              fontSize: fontSize.sm,
              color: colors.mutedForeground,
            }}
          >
            Secured by{" "}
            <span
              style={{
                fontWeight: fontWeight.semibold,
                color: colors.foreground,
              }}
            >
              Trustware
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Success;
