import React from "react";

import type {
  Chain,
  Token,
  YourTokenData,
} from "../../../context/DepositContext";
import type { ChainDef } from "../../../../types";
import { AmountInputDisplay } from "./AmountInputDisplay";
import { AmountSlider } from "./AmountSlider";
import { TokenSwipePill } from "../../token-selection";
import { colors, fontSize, spacing } from "../../../styles";
import {
  amountSectionContainerStyle,
  amountSliderContainerStyle,
  tokenPickerContainerStyle,
} from "./cryptoPayAmountStyles";
import { AmountBalanceRow } from "./AmountBalanceRow";
import { AmountConversionRow } from "./AmountConversionRow";
import { AmountFeeSummary } from "./AmountFeeSummary";

type AmountInputMode = "usd" | "token";

type AmountComputationLike = {
  tokenAmount?: number | string | null;
  usdAmount?: number | string | null;
};

export interface CryptoPayAmountSectionProps {
  amount: string;
  amountComputation: AmountComputationLike;
  amountInputMode: AmountInputMode;
  estimatedReceive?: string | null;
  effectiveSliderMax?: number;
  effectiveSliderMin?: number;
  gasReservationWei: bigint;
  handleAmountChange: (raw: string) => void;
  handleExpandTokens: () => void;
  handleSliderChange: (value: number) => void;
  handleTokenChange: (
    token: Token | YourTokenData | null
  ) => Promise<void> | void;
  hasUsdPrice: boolean;
  isFixedAmount: boolean;
  isLoadingRoute: boolean;
  normalizedTokenBalance: number;
  orderedTokens: YourTokenData[];
  parsedAmount: number;
  selectedChain: ChainDef | null;
  selectedToken: YourTokenData | null;
  setAmountInputMode: React.Dispatch<React.SetStateAction<AmountInputMode>>;
  showFeeSummary: boolean;
  tokenPriceUSD: number;
  walletAddress: string | null;
  yourWalletTokensLength: number;
}

export function CryptoPayAmountSection({
  amount,
  amountComputation,
  amountInputMode,
  estimatedReceive,
  effectiveSliderMax,
  effectiveSliderMin,
  gasReservationWei,
  handleAmountChange,
  handleExpandTokens,
  handleSliderChange,
  handleTokenChange,
  hasUsdPrice,
  isFixedAmount,
  isLoadingRoute,
  normalizedTokenBalance,
  orderedTokens,
  parsedAmount,
  selectedChain,
  selectedToken,
  setAmountInputMode,
  showFeeSummary,
  tokenPriceUSD,
  walletAddress,
  yourWalletTokensLength,
}: CryptoPayAmountSectionProps): React.ReactElement {
  return (
    <div style={amountSectionContainerStyle}>
      <p
        style={{
          fontSize: fontSize.base,
          color: colors.mutedForeground,
          marginBottom: spacing[4],
          marginTop: spacing[4],
        }}
      >
        Enter an amount
      </p>

      <AmountInputDisplay
        amount={amount}
        parsedAmount={parsedAmount}
        isFixedAmount={isFixedAmount}
        onAmountChange={handleAmountChange}
        prefix={amountInputMode === "usd" ? "$" : ""}
        suffix={amountInputMode === "token" ? selectedToken?.symbol : undefined}
        style={{ marginBottom: spacing[4] }}
      />

      {selectedToken ? (
        <AmountConversionRow
          amountComputation={amountComputation}
          amountInputMode={amountInputMode}
          hasUsdPrice={hasUsdPrice}
          isFixedAmount={isFixedAmount}
          selectedTokenSymbol={selectedToken.symbol}
          setAmountInputMode={setAmountInputMode}
        />
      ) : null}

      {selectedToken?.balance ? (
        <AmountBalanceRow
          amountInputMode={amountInputMode}
          effectiveSliderMax={effectiveSliderMax}
          handleSliderChange={handleSliderChange}
          hasUsdPrice={hasUsdPrice}
          isFixedAmount={isFixedAmount}
          normalizedTokenBalance={normalizedTokenBalance}
          selectedTokenSymbol={selectedToken.symbol}
          tokenPriceUSD={tokenPriceUSD}
        />
      ) : null}

      {selectedToken && yourWalletTokensLength > 0 ? (
        <div style={tokenPickerContainerStyle}>
          <TokenSwipePill
            tokens={orderedTokens}
            selectedToken={selectedToken}
            onTokenChange={handleTokenChange}
            onExpandClick={handleExpandTokens}
            selectedChain={selectedChain as Chain}
            walletAddress={walletAddress}
          />
        </div>
      ) : null}

      {!isFixedAmount && selectedToken && effectiveSliderMax !== undefined ? (
        <div style={amountSliderContainerStyle}>
          <p
            style={{
              fontSize: fontSize.xs,
              color: colors.mutedForeground,
              marginBottom: spacing[2],
              textAlign: "center",
            }}
          >
            Slider unit:{" "}
            {amountInputMode === "usd" ? "$ USD" : selectedToken.symbol}
          </p>
          <AmountSlider
            value={Math.min(parsedAmount, effectiveSliderMax)}
            onChange={handleSliderChange}
            max={effectiveSliderMax}
            min={effectiveSliderMin}
            disabled={
              !selectedToken || isFixedAmount || effectiveSliderMax <= 0
            }
          />
        </div>
      ) : null}

      {showFeeSummary ? (
        <AmountFeeSummary
          amount={amount}
          estimatedReceive={estimatedReceive}
          gasReservationWei={gasReservationWei}
          isLoadingRoute={isLoadingRoute}
          parsedAmount={parsedAmount}
          selectedTokenDecimals={selectedToken?.decimals}
        />
      ) : null}
    </div>
  );
}
