import React from "react";

import { SwipeToConfirmTokens } from "./SwipeToConfirmTokens";
import type { YourTokenData } from "../../../context/DepositContext";
import { spacing } from "../../../styles";

export interface CryptoPaySwipeSectionProps {
  actionErrorMessage?: string | null;
  canSwipe: boolean;
  destinationConfig?: {
    dappName?: string;
    toChain?: string;
    toToken?: string;
  } | null;
  fromChainName?: string;
  handleSwipeConfirm: () => Promise<void> | void;
  isApproving: boolean;
  isLoadingRoute: boolean;
  isReadingAllowance: boolean;
  isWalletConnected: boolean;
  needsApproval: boolean;
  selectedToken: YourTokenData | null;
  swipeResetKey: string | number;
}

export function CryptoPaySwipeSection({
  actionErrorMessage,
  canSwipe,
  destinationConfig,
  fromChainName,
  handleSwipeConfirm,
  isApproving,
  isLoadingRoute,
  isReadingAllowance,
  isWalletConnected,
  needsApproval,
  selectedToken,
  swipeResetKey,
}: CryptoPaySwipeSectionProps): React.ReactElement {
  const swipeText = actionErrorMessage
    ? actionErrorMessage
    : !isWalletConnected
      ? "Connect your wallet to deposit"
      : isLoadingRoute
        ? "Loading route..."
        : isApproving
          ? "Approving..."
          : isReadingAllowance
            ? "Checking allowance..."
            : needsApproval
              ? "Swipe to approve"
              : "Swipe to confirm";

  return (
    <div
      style={{
        padding: `${spacing[4]} ${spacing[6]}`,
      }}
    >
      {selectedToken?.chainData ? (
        <SwipeToConfirmTokens
          key={swipeResetKey}
          text={swipeText}
          fromToken={selectedToken}
          toTokenSymbol={destinationConfig?.toToken || "USDC"}
          toChainName={destinationConfig?.toChain || "Base"}
          fromChainName={fromChainName || "Unknown Chain"}
          dappName={destinationConfig?.dappName || "Example DApp"}
          onConfirm={handleSwipeConfirm}
          disabled={!canSwipe}
          isWalletConnected={isWalletConnected}
        />
      ) : null}
    </div>
  );
}
