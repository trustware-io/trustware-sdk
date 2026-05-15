import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DetectedWallet, WalletInterFaceAPI } from "../../../../types";

import { NavigationStep } from "src/widget/state/deposit/types";
import { useDepositNavigationState } from "src/widget/state/deposit/useDepositNavigationState";
import { useDepositWallet } from "src/widget/context/DepositContext";
import { useWalletInfo } from "src/wallets";

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
  setWalletType: React.Dispatch<
    React.SetStateAction<"walletconnect" | "other">
  >;
  WalletConnect: () => Promise<void>;
};

export function useHomeWalletActions({
  connectWallet,
  detectedWallets,
  setCurrentStep,
  setWalletType,
  WalletConnect,
  // setCurrentStepInternal,
}: UseHomeWalletActionsArgs) {
  const [isCryptoDropdownOpen, setIsCryptoDropdownOpen] = useState(false);
  const [isFiatDropdownOpen, setIsFiatDropdownOpen] = useState(false);

  const cryptoDropdownRef = useRef<HTMLDivElement>(null);
  const fiatDropdownRef = useRef<HTMLDivElement>(null);

  const { disconnect } = useWalletInfo();

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

  const { resetNavigation } = useDepositNavigationState("home");

  const { setYourWalletTokens } = useDepositWallet();
  const { isConnected, walletMetaId, connectedVia } = useWalletInfo();

  const handleWalletSelect = useCallback(
    async (wallet: DetectedWallet) => {
      setIsCryptoDropdownOpen(false);

      try {
        if (walletMetaId !== wallet.meta?.id && isConnected) {
          disconnect();
          setYourWalletTokens([]);
        }
        setWalletType("other");
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
    },
    [setYourWalletTokens, disconnect]
  );

  const handleFiatSelect = () => {
    setIsFiatDropdownOpen(false);
  };

  const handleWalletConnect = useCallback(async () => {
    if (connectedVia !== "walletconnect" && isConnected) {
      disconnect();
      setYourWalletTokens([]);
    }
    WalletConnect().catch(() => resetNavigation());
  }, [setYourWalletTokens, disconnect]);

  const { selectedNamespace } = useDepositWallet();
  const browserWallets = useMemo(() => {
    if (!detectedWallets?.length) return [];

    return detectedWallets.filter(
      (wallet) =>
        wallet?.meta?.id !== "walletconnect" &&
        wallet?.meta?.ecosystem === selectedNamespace
    );
  }, [detectedWallets, selectedNamespace]);

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
