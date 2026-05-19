import React, { useEffect, useMemo } from "react";
import { TrustwareErrorCode } from "src/errors/errorCodes";
import { TrustwareError } from "src/errors/TrustwareError";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import { useTrustware } from "src/provider";
import { ChainDef } from "src/types";
import {
  WidgetPageHeader,
  LoadingSkeleton,
  WidgetSecurityFooter,
} from "src/widget/components";
import { borderRadius, colors, fontSize, spacing } from "src/widget/styles";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositWallet,
  YourTokenData,
} from "src/widget/context/DepositContext";
import {
  CryptoPayAmountSection,
  sanitizeAmountInput,
  useAmountConstraints,
  useDepositAmountModel,
} from "src/widget/features/amount";
import { useRoutePreviewModel } from "src/widget/features/route-preview";
import { useOrderedWalletTokens } from "src/widget/features/token-selection";
import {
  useTransactionActionModel,
  CryptoPaySwipeSection,
} from "src/widget/features/transaction";
import DefaultCryptoPay from "./DefaultCryptoPay";

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
    walletType,
    walletStatus,
    yourWalletTokens,
    yourWalletTokensLoading,
    disconnectWalletConnect,
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

  const showDefaultCryptoPay = useMemo(() => {
    const nonZer0Tks = (yourWalletTokens ?? []).filter(IsPos);

    return (
      !yourWalletTokensLoading &&
      nonZer0Tks.length === 0 &&
      yourWalletTokens.length > 0
    );
  }, [yourWalletTokens, yourWalletTokensLoading]);

  const showSkeleton = useMemo(() => {
    return yourWalletTokensLoading || (yourWalletTokens ?? []).length === 0;
  }, [yourWalletTokens, yourWalletTokensLoading]);

  const isReady =
    !yourWalletTokensLoading &&
    selectedToken != null &&
    (selectedToken as YourTokenData)?.chainData !== undefined &&
    !showDefaultCryptoPay &&
    !showSkeleton;

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
    walletType,
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

      {walletType === "walletconnect" && walletAddress && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${spacing[2]} ${spacing[4]}`,
            backgroundColor: colors.card,
            borderBottom: `1px solid ${colors.border}`,
            gap: spacing[2],
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[2],
              fontSize: fontSize.xs,
              color: colors.mutedForeground,
              overflow: "hidden",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{
                width: "0.875rem",
                height: "0.875rem",
                flexShrink: 0,
                color: colors.blue[500],
              }}
            >
              <path d="M6.09 10.56c3.26-3.2 8.56-3.2 11.82 0l.39.39a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53c-2.28-2.23-5.97-2.23-8.24 0l-.58.56a.21.21 0 01-.3 0L5.66 11.6a.4.4 0 010-.58l.43-.46zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.43.43 0 01-.6 0l-3.82-3.74a.11.11 0 00-.15 0l-3.82 3.74a.43.43 0 01-.6 0L2.15 15.03a.4.4 0 010-.58l1.2-1.17a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0z" />
            </svg>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void disconnectWalletConnect()}
            style={{
              flexShrink: 0,
              fontSize: fontSize.xs,
              color: colors.destructive,
              background: "transparent",
              border: `1px solid ${colors.destructive}`,
              borderRadius: borderRadius.md,
              padding: `${spacing[1]} ${spacing[2]}`,
              cursor: "pointer",
              lineHeight: 1.4,
            }}
          >
            Disconnect
          </button>
        </div>
      )}

      {showSkeleton ? (
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
                isWalletConnected={
                  isWalletConnected
                    ? isWalletConnected
                    : walletAddress !== null && walletType == "walletconnect"
                      ? true
                      : false
                }
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
