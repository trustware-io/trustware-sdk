import React, { useEffect, useMemo } from "react";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositWallet,
  YourTokenData,
} from "../context/DepositContext";
import {
  LoadingSkeleton,
  WidgetPageHeader,
  WidgetSecurityFooter,
} from "../components";
import {
  CryptoPayAmountSection,
  sanitizeAmountInput,
  useAmountConstraints,
  useDepositAmountModel,
} from "../features/amount";
import { useRoutePreviewModel } from "../features/route-preview";
import { useOrderedWalletTokens } from "../features/token-selection";
import {
  CryptoPaySwipeSection,
  useTransactionActionModel,
} from "../features/transaction";
import type { ChainDef } from "../../types";
import { TrustwareError } from "../../errors/TrustwareError";
import { TrustwareErrorCode } from "../../errors/errorCodes";
import { useTrustwareConfig } from "../../hooks/useTrustwareConfig";
import { useTrustware } from "../../provider";
import DefaultCryptoPay from "./CryptoPay/DefaultCryptoPay";

export interface CryptoPayProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const SHOW_FEE_SUMMARY = false;

/**
 * CryptoPay confirmation page.
 * Displays transaction summary with fees and allows last-minute token changes.
 * Includes SwipeToConfirmTokens for secure transaction confirmation.
 */
export function CryptoPay({ style: _style }: CryptoPayProps) {
  const {
    amount,
    setAmount,
    selectedToken,
    setSelectedToken,
    selectedChain,
    setSelectedChain,
    amountInputMode,
    setAmountInputMode,
  } = useDepositForm();
  const {
    walletAddress,
    walletStatus,
    yourWalletTokens,
    yourWalletTokensLoading,
  } = useDepositWallet();
  const { goBack, setCurrentStep, currentStep } = useDepositNavigation();
  const config = useTrustwareConfig();
  const { fixedFromAmountString, isFixedAmount, minAmountUsd, maxAmountUsd } =
    useAmountConstraints();
  const routeRefreshMs = useMemo(() => {
    const raw = config.routes?.options?.routeRefreshMs;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [config.routes?.options?.routeRefreshMs]);

  const IsPos = <T extends { balance: string | number }>(
    x: T | null | undefined
  ): x is T => x !== null && x !== undefined && x.balance !== "0";

  const isReady = useMemo(() => {
    if (
      selectedToken !== null &&
      yourWalletTokens.length > 0 &&
      (selectedToken as YourTokenData)?.chainData !== undefined
    ) {
      return true;
    }
  }, [selectedToken, yourWalletTokens]);

  const showDefaultCryptoPay = useMemo(() => {
    const nonZer0Tks = yourWalletTokens.filter(IsPos);
    if (!yourWalletTokensLoading && nonZer0Tks.length === 0) return true;
  }, [yourWalletTokens, yourWalletTokensLoading]);

  const {
    amountComputation,
    amountValidationError,
    amountWei,
    effectiveSliderMax,
    effectiveSliderMin,
    hasUsdPrice,
    normalizedTokenBalance,
    parsedAmount,
    tokenPriceUSD,
  } = useDepositAmountModel({
    amount,
    setAmount,
    amountInputMode,
    setAmountInputMode,
    fixedFromAmountString,
    isReady,
    selectedToken,
    minAmountUsd,
    maxAmountUsd,
  });
  const {
    actionErrorMessage,
    destinationConfig,
    isLoadingRoute,
    estimatedReceive,
    routeResult,
    routePrerequisiteError,
    routeError: routeBuilderError,
  } = useRoutePreviewModel({
    amountUsd: amountComputation.usdAmount || undefined,
    amountValidationError,
    amountWei,
    config,
    isReady,
    routeRefreshMs,
    selectedChain,
    selectedToken,
    walletAddress,
  });

  const {
    canSwipe,
    gasReservationWei,
    handleSwipeConfirm,
    isApproving,
    isReadingAllowance,
    isWalletConnected,
    needsApproval,
    swipeResetKey,
  } = useTransactionActionModel({
    actionErrorMessage,
    amountWei,
    isLoadingRoute,
    parsedAmount,
    routeResult,
    selectedChain,
    selectedToken,
    walletAddress,
    walletStatus,
  });
  const { handleTokenChange, orderedTokens } = useOrderedWalletTokens({
    amount,
    amountInputMode,
    selectedToken,
    setSelectedChain: (chain) => setSelectedChain(chain as ChainDef | null),
    setSelectedToken,
    yourWalletTokens,
  });

  const { emitError } = useTrustware();
  const readySelectedToken = isReady ? (selectedToken as YourTokenData) : null;

  useEffect(() => {
    if (currentStep !== "crypto-pay" || !actionErrorMessage) return;

    emitError?.(
      new TrustwareError({
        code: TrustwareErrorCode.INPUT_ERROR,
        message: actionErrorMessage,
        userMessage: actionErrorMessage,
        cause: actionErrorMessage,
      })
    );

    if (routePrerequisiteError || routeBuilderError) {
      void (routePrerequisiteError || routeBuilderError);
    }
  }, [
    actionErrorMessage,
    currentStep,
    emitError,
    routeBuilderError,
    routePrerequisiteError,
  ]);

  /**
   * Handle amount input changes with decimal sanitization
   */
  const handleAmountChange = (raw: string) => {
    if (isFixedAmount) return;
    const sanitized = sanitizeAmountInput(raw);
    setAmount(sanitized);
  };

  /**
   * Handle slider value change
   */
  const handleSliderChange = (value: number) => {
    if (isFixedAmount) return;
    setAmount(value.toString());
  };

  /**
   * Handle expand click to navigate to token selection
   */
  const handleExpandTokens = () => {
    setCurrentStep("select-token");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
      }}
    >
      <WidgetPageHeader onBack={goBack} title="Confirm Deposit" />

      {yourWalletTokensLoading ? (
        <>
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LoadingSkeleton />
          </div>
        </>
      ) : (
        <>
          {isReady && (
            <>
              <CryptoPayAmountSection
                amount={amount}
                amountComputation={amountComputation}
                amountInputMode={amountInputMode}
                estimatedReceive={estimatedReceive}
                effectiveSliderMax={effectiveSliderMax}
                effectiveSliderMin={effectiveSliderMin}
                gasReservationWei={gasReservationWei}
                handleAmountChange={handleAmountChange}
                handleExpandTokens={handleExpandTokens}
                handleSliderChange={handleSliderChange}
                handleTokenChange={handleTokenChange}
                hasUsdPrice={hasUsdPrice}
                isFixedAmount={isFixedAmount}
                isLoadingRoute={isLoadingRoute}
                normalizedTokenBalance={normalizedTokenBalance}
                orderedTokens={orderedTokens}
                parsedAmount={parsedAmount}
                selectedChain={selectedChain}
                selectedToken={readySelectedToken}
                setAmountInputMode={setAmountInputMode}
                showFeeSummary={SHOW_FEE_SUMMARY}
                tokenPriceUSD={tokenPriceUSD}
                walletAddress={walletAddress}
                yourWalletTokensLength={yourWalletTokens.length}
              />
              <CryptoPaySwipeSection
                actionErrorMessage={actionErrorMessage}
                canSwipe={canSwipe}
                destinationConfig={destinationConfig}
                fromChainName={selectedChain?.networkName}
                handleSwipeConfirm={handleSwipeConfirm}
                isApproving={isApproving}
                isLoadingRoute={isLoadingRoute}
                isReadingAllowance={isReadingAllowance}
                isWalletConnected={isWalletConnected}
                needsApproval={needsApproval}
                selectedToken={readySelectedToken}
                swipeResetKey={swipeResetKey}
              />
              <WidgetSecurityFooter />
            </>
          )}
          {showDefaultCryptoPay && <DefaultCryptoPay />}
        </>
      )}
    </div>
  );
}

export default CryptoPay;
