import React from "react";
import { useIsMobile } from "src/wallets/detect";
import SwapWalletSelectorMobile from "./SwapWalletSelectorMobile";
import { SwapWalletSelectorDesktop } from "./SwapWalletSelectorDesktop";
import { DetectedWallet, WalletInterFaceAPI } from "src";
import { WalletStatus } from "src/widget/state/deposit/types";
interface SwapWalletSelectorProps {
  walletStatus: WalletStatus;
  walletAddress: string | null;
  connectWallet: (
    wallet: DetectedWallet
  ) => Promise<{ error: string | null; api: WalletInterFaceAPI | null }>;
  onBack: () => void;
}
function SwapWalletSelector({
  walletStatus,
  walletAddress,
  connectWallet,
  onBack,
}: SwapWalletSelectorProps): React.ReactElement {
  const isMobile = useIsMobile();

  return (
    <>
      {isMobile && (
        <SwapWalletSelectorMobile
          walletStatus={walletStatus}
          walletAddress={walletAddress}
          connectWallet={connectWallet}
          onBack={onBack}
        />
      )}

      {!isMobile && (
        <SwapWalletSelectorDesktop
          walletStatus={walletStatus}
          walletAddress={walletAddress}
          connectWallet={connectWallet}
          onBack={onBack}
        />
      )}
    </>
  );
}

export default SwapWalletSelector;
