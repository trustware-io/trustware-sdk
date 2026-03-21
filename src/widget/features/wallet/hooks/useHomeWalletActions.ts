import { useEffect, useRef, useState } from "react";

import type { DetectedWallet } from "../../../../types";
import { getUniversalConnector } from "../../../../config/walletconnect";
import type { UniversalConnector } from "@reown/appkit-universal-connector";

type UseHomeWalletActionsArgs = {
  connectWallet: (wallet: DetectedWallet) => Promise<void>;
  detectedWallets: DetectedWallet[];
  setCurrentStep: (step: "select-token" | "crypto-pay") => void;
};

export function useHomeWalletActions({
  connectWallet,
  detectedWallets,
  setCurrentStep,
}: UseHomeWalletActionsArgs) {
  const [isCryptoDropdownOpen, setIsCryptoDropdownOpen] = useState(false);
  const [isFiatDropdownOpen, setIsFiatDropdownOpen] = useState(false);
  const [universalConnector, setUniversalConnector] =
    useState<UniversalConnector>();
  const cryptoDropdownRef = useRef<HTMLDivElement>(null);
  const fiatDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    getUniversalConnector().then(setUniversalConnector);
  }, []);

  const handleWalletSelect = async (wallet: DetectedWallet) => {
    setIsCryptoDropdownOpen(false);

    try {
      await connectWallet(wallet);
      setCurrentStep("crypto-pay");
    } catch {
      // connection failure handled elsewhere
    }
  };

  const handleFiatSelect = () => {
    setIsFiatDropdownOpen(false);
  };

  const handleWalletConnect = async () => {
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
