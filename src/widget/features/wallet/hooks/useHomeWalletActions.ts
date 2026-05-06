import { useEffect, useRef, useState } from "react";

import type {
  DetectedWallet,
  WalletConnectConfig,
  WalletInterFaceAPI,
} from "../../../../types";
import { getUniversalConnector } from "../../../../config/walletconnect";
import type { UniversalConnector } from "@reown/appkit-universal-connector";
import { NavigationStep } from "src/widget/state/deposit/types";
import { useDepositNavigationState } from "src/widget/state/deposit/useDepositNavigationState";
import { TrustwareConfigStore } from "src/config";

type UseHomeWalletActionsArgs = {
  connectWallet: (wallet: DetectedWallet) => Promise<{
    error: string | null;
    api: WalletInterFaceAPI | null;
  }>;
  detectedWallets: DetectedWallet[];
  setCurrentStep: (step: "select-token" | "crypto-pay") => void;
  setCurrentStepInternal?: (
    value: React.SetStateAction<NavigationStep>
  ) => void;
};

export function useHomeWalletActions({
  connectWallet,
  detectedWallets,
  setCurrentStep,
  // setCurrentStepInternal,
}: UseHomeWalletActionsArgs) {
  const [isCryptoDropdownOpen, setIsCryptoDropdownOpen] = useState(false);
  const [isFiatDropdownOpen, setIsFiatDropdownOpen] = useState(false);
  const [universalConnector, setUniversalConnector] =
    useState<UniversalConnector>();
  const cryptoDropdownRef = useRef<HTMLDivElement>(null);
  const fiatDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !TrustwareConfigStore.peek()?.walletConnect
    ) {
      return;
    }

    const walletConnect = TrustwareConfigStore.peek()
      ?.walletConnect as WalletConnectConfig;

    console.log({ walletConnect });

    if (walletConnect) {
      getUniversalConnector(walletConnect as WalletConnectConfig).then(
        setUniversalConnector
      );
    }
  }, [TrustwareConfigStore.peek()?.walletConnect]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cryptoDropdownRef.current &&
        !cryptoDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCryptoDropdownOpen(false);
      }
      if (
        fiatDropdownRef.current &&
        !fiatDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFiatDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // useEffect(() => {
  //   getUniversalConnector({}).then(setUniversalConnector);
  // }, []);

  const { resetNavigation } = useDepositNavigationState("home");

  const handleWalletSelect = async (wallet: DetectedWallet) => {
    setIsCryptoDropdownOpen(false);

    try {
      const { error } = await connectWallet(wallet);
      if (error) {
        // setCurrentStepInternal("home");
        resetNavigation();
        return;
      }
      setCurrentStep("crypto-pay");
    } catch {
      /*???*/
      // setCurrentStepInternal("home");
      resetNavigation();
    }
  };

  const handleFiatSelect = () => {
    setIsFiatDropdownOpen(false);
  };

  const handleWalletConnect = async () => {
    console.log("handleWalletConnect");
    if (!universalConnector) {
      return;
    }

    const { session: providerSession } = await universalConnector.connect();
    if (providerSession) {
      setCurrentStep("select-token");
    }
  };

  const browserWallets = detectedWallets.filter(
    (wallet) => wallet.meta.id !== "walletconnect"
  );

  return {
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
  };
}
