import React, { lazy, Suspense, useMemo } from "react";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositTransaction,
} from "../context/DepositContext";
import { WidgetPageHeader, WidgetSecurityFooter } from "../components";
import {
  SuccessSummaryCard,
  useTransactionPolling,
} from "../features/transaction";

// Lazy load the ConfettiEffect to reduce initial bundle size
const ConfettiEffect = lazy(() => import("../components/ConfettiEffect"));

export interface SuccessProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * Success page component.
 * Displays a celebratory success screen with confetti when the deposit completes.
 */
export function Success({ style }: SuccessProps): React.ReactElement {
  const { selectedToken, selectedChain, amount } = useDepositForm();
  const { resetState } = useDepositNavigation();
  const { transactionHash } = useDepositTransaction();

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

      <WidgetPageHeader title="Deposit Complete" />

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
        <SuccessSummaryCard
          amount={parsedAmount}
          explorerUrl={explorerUrl}
          onDone={handleDone}
          selectedChainName={selectedChain?.networkName}
          selectedTokenIconUrl={selectedToken?.iconUrl}
          selectedTokenSymbol={selectedToken?.symbol}
          transactionHash={transactionHash}
        />
      </div>

      <WidgetSecurityFooter />
    </div>
  );
}

export default Success;
