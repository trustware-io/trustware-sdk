import React, { lazy, Suspense, useMemo } from "react";
import { cn } from "../lib/utils";
import { useDeposit } from "../context/DepositContext";
import { useTransactionPolling } from "../hooks/useTransactionPolling";

// Lazy load the ConfettiEffect to reduce initial bundle size
const ConfettiEffect = lazy(() => import("../components/ConfettiEffect"));

export interface SuccessProps {
  /** Additional CSS classes */
  className?: string;
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
export function Success({ className }: SuccessProps): React.ReactElement {
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
    <div className={cn("tw-flex tw-flex-col tw-min-h-[500px]", className)}>
      {/* Confetti effect - lazy loaded */}
      <Suspense fallback={null}>
        <ConfettiEffect isActive={true} pieceCount={60} clearDelay={4000} />
      </Suspense>

      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-center tw-px-4 tw-py-4 tw-border-b tw-border-border">
        <h1 className="tw-text-lg tw-font-semibold tw-text-foreground">
          Deposit Complete
        </h1>
      </div>

      {/* Content */}
      <div className="tw-flex-1 tw-flex tw-flex-col tw-items-center tw-justify-center tw-px-6 tw-py-8">
        {/* Success Icon */}
        <div className="tw-w-20 tw-h-20 tw-rounded-full tw-bg-green-500/10 tw-flex tw-items-center tw-justify-center tw-mb-6">
          <svg
            className="tw-w-10 tw-h-10 tw-text-green-500"
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
        <h2 className="tw-text-2xl tw-font-bold tw-text-foreground tw-text-center tw-mb-2">
          Success!
        </h2>
        <p className="tw-text-muted-foreground tw-text-center tw-mb-6">
          Your deposit has been completed successfully.
        </p>

        {/* Deposited Amount */}
        {selectedToken && parsedAmount > 0 && (
          <div className="tw-bg-muted/50 tw-rounded-xl tw-px-6 tw-py-4 tw-mb-6 tw-text-center">
            <p className="tw-text-sm tw-text-muted-foreground tw-mb-1">
              Amount Deposited
            </p>
            <p className="tw-text-3xl tw-font-bold tw-text-foreground">
              $
              {parsedAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <div className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-mt-2">
              {selectedToken.iconUrl && (
                <img
                  src={selectedToken.iconUrl}
                  alt=""
                  className="tw-w-5 tw-h-5 tw-rounded-full"
                />
              )}
              <span className="tw-text-sm tw-text-muted-foreground">
                {selectedToken.symbol}
                {selectedChain && ` on ${selectedChain.name}`}
              </span>
            </div>
          </div>
        )}

        {/* Transaction Hash Link */}
        {transactionHash && (
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-1 tw-mb-8">
            <span className="tw-text-sm tw-text-muted-foreground">
              Transaction ID
            </span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tw-flex tw-items-center tw-gap-1.5 tw-text-primary hover:tw-underline"
              >
                <span className="tw-font-mono tw-text-sm">
                  {truncateHash(transactionHash)}
                </span>
                <svg
                  className="tw-w-3.5 tw-h-3.5"
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
              <span className="tw-font-mono tw-text-sm tw-text-foreground">
                {truncateHash(transactionHash)}
              </span>
            )}
          </div>
        )}

        {/* Done Button */}
        <button
          type="button"
          onClick={handleDone}
          className="tw-w-full tw-max-w-xs tw-py-3 tw-px-6 tw-rounded-xl tw-bg-primary tw-text-primary-foreground tw-font-semibold tw-text-base hover:tw-bg-primary/90 tw-transition-colors tw-border-0 tw-cursor-pointer"
        >
          Done
        </button>
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
            aria-hidden="true"
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

export default Success;
