import { SwipeToConfirmTokens } from "./SwipeToConfirmTokens";
import { mapError } from "src/widget/lib/mapError";
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
    ? refineErrorMessage(actionErrorMessage)
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

  // The swipe label is a button, not an error page, so it gets the mapped
  // title. What this replaces only rewrote a message that was *exactly* the
  // word "squid", "api" or "body" — which no error is — so raw provider text
  // like "squid api error: status=400 body={…}" was rendered on the button.
  function refineErrorMessage(message: string) {
    const mapped = mapError(message);
    if (mapped.category !== "unknown") return mapped.title;
    return message.length <= 60 ? message : "Route not available";
  }

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
