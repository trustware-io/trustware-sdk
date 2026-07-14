import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositUi,
  useDepositWallet,
} from "../context/DepositContext";
import { WidgetSecurityFooter } from "../components";
import {
  AmountInputDisplay,
  formatUsdAmount,
  useAmountConstraints,
  useHomeAmountModel,
} from "../features/amount";
import { useWalletDetection } from "../../wallets";
import { HomePaymentOptions, useHomeWalletActions } from "../features/wallet";
import type { WalletConnectStatus } from "../state/deposit/types";

export interface HomeProps {
  style?: React.CSSProperties;
}

export interface HomeProps {
  style?: React.CSSProperties;
}

const wcBannerCopy: Record<
  "connecting" | "timedOut" | "failed",
  { text: string; icon: "spinner" | "⚠️" | "✕" }
> = {
  connecting: {
    text: "Waiting for wallet approval via WalletConnect…",
    icon: "spinner",
  },
  timedOut: {
    text: "Still waiting on WalletConnect — this is taking longer than expected.",
    icon: "⚠️",
  },
  failed: {
    text: "WalletConnect connection failed.",
    icon: "✕",
  },
};

// WalletConnect-only: an injected-wallet connect is a single synchronous
// request/approve step, but WalletConnect hands off to a separate wallet app
// and waits on a human there, so it's the one path worth a persistent status
// indicator instead of just a spinner on the row that was tapped.
function WalletConnectStatusBanner({
  status,
  errorMessage,
  onRetry,
  onDismiss,
}: {
  status: Exclude<WalletConnectStatus, "idle">;
  errorMessage: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}): React.ReactElement {
  const isDone = status !== "connecting";
  const isFailed = status === "failed";
  const { text, icon } = wcBannerCopy[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        width: "100%",
        padding: `${spacing[2.5]} ${spacing[3]}`,
        marginBottom: spacing[4],
        borderRadius: borderRadius.lg,
        backgroundColor: isFailed
          ? "rgba(239,68,68,0.1)"
          : isDone
            ? "rgba(234,179,8,0.1)"
            : colors.muted,
        border: isFailed
          ? "1px solid rgba(239,68,68,0.4)"
          : isDone
            ? "1px solid rgba(234,179,8,0.4)"
            : `1px solid ${colors.border}`,
      }}
    >
      {icon === "spinner" ? (
        <div
          style={{
            width: "0.875rem",
            height: "0.875rem",
            border: `2px solid ${colors.mutedForeground}`,
            borderTopColor: "transparent",
            borderRadius: "9999px",
            animation: "tw-spin 1s linear infinite",
            flexShrink: 0,
          }}
        />
      ) : (
        <span style={{ fontSize: fontSize.sm, flexShrink: 0 }} aria-hidden>
          {icon}
        </span>
      )}
      <p
        style={{
          flex: 1,
          fontSize: fontSize.xs,
          color: isDone ? colors.foreground : colors.mutedForeground,
          margin: 0,
        }}
      >
        {text}
        {isFailed && errorMessage ? ` ${errorMessage}` : ""}
      </p>
      {isDone && (
        <>
          <button
            type="button"
            onClick={onRetry}
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: colors.primary,
              backgroundColor: "transparent",
              border: 0,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              fontSize: fontSize.xs,
              color: colors.mutedForeground,
              backgroundColor: "transparent",
              border: 0,
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

export function Home({ style: _style }: HomeProps): React.ReactElement {
  const { amount, setAmount, amountInputMode, setAmountInputMode } =
    useDepositForm();
  const { setCurrentStep, setCurrentStepInternal } = useDepositNavigation();
  const {
    connectWallet,
    WalletConnect,
    setWalletType,
    wcStatus,
    wcErrorMessage,
    retryWalletConnect,
    dismissWcStatus,
  } = useDepositWallet();
  const { resolvedTheme } = useDepositUi();
  const { fixedFromAmountString, isFixedAmount, minAmountUsd, maxAmountUsd } =
    useAmountConstraints();
  const { detected: detectedWallets } = useWalletDetection();

  const { amountValidationMessage, handleAmountChange, parsedAmount } =
    useHomeAmountModel({
      amount,
      setAmount,
      amountInputMode,
      setAmountInputMode,
      fixedFromAmountString,
      isFixedAmount,
      minAmountUsd,
      maxAmountUsd,
    });
  const {
    browserWallets,
    cryptoDropdownRef,
    fiatDropdownRef,
    handleFiatSelect,
    handleWalletConnect,
    handleWalletSelect,
    isCryptoDropdownOpen,
    isFiatDropdownOpen,
    setIsCryptoDropdownOpen,
    setIsFiatDropdownOpen,
  } = useHomeWalletActions({
    connectWallet,
    detectedWallets,
    setCurrentStep,
    setCurrentStepInternal,
    WalletConnect,
    setWalletType,
  });

  const isDarkTheme = resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${spacing[4]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.border}`,
          position: "relative",
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.foreground,
          }}
        >
          Deposit
        </h1>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: `0 ${spacing[6]}`,
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {wcStatus !== "idle" && (
          <WalletConnectStatusBanner
            status={wcStatus}
            errorMessage={wcErrorMessage}
            onRetry={retryWalletConnect}
            onDismiss={dismissWcStatus}
          />
        )}

        {/* Enter Amount Label */}
        <p
          style={{
            fontSize: fontSize.base,
            color: colors.mutedForeground,
            marginBottom: spacing[4],
          }}
        >
          Enter an amount
        </p>

        <AmountInputDisplay
          amount={amount}
          parsedAmount={parsedAmount}
          isFixedAmount={isFixedAmount}
          onAmountChange={handleAmountChange}
          prefix="$"
          style={{ marginBottom: spacing[8] }}
        />

        {amountValidationMessage ? (
          <p
            style={{
              marginTop: `-${spacing[5]}`,
              marginBottom: spacing[5],
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.destructive,
              textAlign: "center",
            }}
          >
            {amountValidationMessage}
          </p>
        ) : minAmountUsd != null || maxAmountUsd != null ? (
          <p
            style={{
              marginTop: `-${spacing[5]}`,
              marginBottom: spacing[5],
              fontSize: fontSize.sm,
              color: colors.mutedForeground,
              textAlign: "center",
            }}
          >
            {[
              minAmountUsd != null
                ? `Min ${formatUsdAmount(minAmountUsd)} USD`
                : null,
              maxAmountUsd != null
                ? `Max ${formatUsdAmount(maxAmountUsd)} USD`
                : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </p>
        ) : null}

        <HomePaymentOptions
          browserWallets={browserWallets}
          cryptoDropdownRef={cryptoDropdownRef}
          fiatDropdownRef={fiatDropdownRef}
          handleFiatSelect={handleFiatSelect}
          handleWalletConnect={handleWalletConnect}
          handleWalletSelect={handleWalletSelect}
          isCryptoDropdownOpen={isCryptoDropdownOpen}
          isFiatDropdownOpen={isFiatDropdownOpen}
          isDarkTheme={isDarkTheme}
          setIsCryptoDropdownOpen={setIsCryptoDropdownOpen}
          setIsFiatDropdownOpen={setIsFiatDropdownOpen}
        />
      </div>

      <WidgetSecurityFooter />
    </div>
  );
}

export default Home;
