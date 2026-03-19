import React, { lazy, Suspense, useMemo } from "react";
import { colors, spacing, fontSize, fontWeight } from "../styles";
import { useDeposit } from "../context/DepositContext";
import { useTransactionPolling } from "../hooks";

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

  // // Parse amount for display
  const parsedAmount = useMemo(() => parseFloat(amount) || 0, [amount]);

  // // Get block explorer URL from transaction data or construct fallback
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
    if (transactionHash && selectedChain?.blockExplorerUrls?.length) {
      return `${selectedChain.blockExplorerUrls[0].replace(/\/+$/, "")}/tx/${transactionHash}`;
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
        minWidth: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        position: "relative",
        overflow: "hidden",
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
          justifyContent: "space-between",
          padding: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            width: "2.5rem",
          }}
        />
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: "600",
            color: colors.foreground,
          }}
        >
          Deposit Complete
        </h1>
        <div
          style={{
            width: "2.5rem",
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: "1.5rem",
          overflowY: "auto",
          scrollbarWidth: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            animation: "fade-in 0.3s ease-out",
          }}
        >
          {/* Status */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                width: "5rem",
                height: "5rem",
                borderRadius: "2.5rem",
                backgroundColor: colors.green[500],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "scale-in 0.3s ease-out",
                marginBottom: "0.75rem",
              }}
            >
              <svg
                style={{
                  width: "2.5rem",
                  height: "2.5rem",
                  color: colors.white,
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
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: colors.foreground,
              }}
            >
              Success!
            </div>
          </div>

          {/* Amount */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                fontSize: "1.875rem",
                fontWeight: "bold",
                color: colors.foreground,
              }}
            >
              $
              {parsedAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            {selectedToken?.iconUrl && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  marginTop: "0.375rem",
                }}
              >
                <img
                  src={selectedToken?.iconUrl}
                  alt={selectedToken.symbol}
                  style={{
                    width: "1rem",
                    height: "1rem",
                    borderRadius: "0.5rem",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: colors.mutedForeground,
                  }}
                >
                  {selectedToken?.symbol} on {selectedChain?.networkName}
                </span>
              </div>
            )}
          </div>

          {/* Transaction ID */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
              marginBottom: "2rem",
            }}
          >
            <span
              style={{
                fontSize: "0.625rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
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
                  gap: "0.25rem",
                  fontSize: "0.8rem",
                  color: colors.primary,
                  textDecoration: "none",
                  textDecorationColor: colors.primary,
                  cursor: "pointer",
                  transition: "text-decoration 0.3s ease-out",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: fontSize.sm,
                  }}
                >
                  {truncateHash(transactionHash || "")}
                </span>
                <svg
                  style={{
                    width: "0.75rem",
                    height: "0.75rem",
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
                {truncateHash(transactionHash || "")}
              </span>
            )}
          </div>

          {/* Done Button */}
          <div
            style={{
              width: "100%",
              padding: "1rem",
            }}
          >
            <button
              onClick={handleDone}
              style={{
                width: "100%",
                height: "3rem",
                borderRadius: "1.5rem",
                backgroundColor: colors.primary,
                transition: "background-color 0.3s ease-out",
                color: colors.primaryForeground,
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Content */}

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
