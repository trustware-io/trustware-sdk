import { colors, spacing, fontSize, fontWeight } from "../styles";
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

export interface HomeProps {
  style?: React.CSSProperties;
}

export interface HomeProps {
  style?: React.CSSProperties;
}

export function Home({ style: _style }: HomeProps): React.ReactElement {
  const { amount, setAmount, amountInputMode, setAmountInputMode } =
    useDepositForm();
  const { setCurrentStep, setCurrentStepInternal } = useDepositNavigation();
  const { connectWallet, WalletConnect, setWalletType } = useDepositWallet();
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
