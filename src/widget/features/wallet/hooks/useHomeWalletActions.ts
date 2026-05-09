import { useEffect, useRef, useState } from "react";

import type {
  DetectedWallet,
  // WalletConnectConfig,
  WalletInterFaceAPI,
} from "../../../../types";

import { NavigationStep } from "src/widget/state/deposit/types";
import { useDepositNavigationState } from "src/widget/state/deposit/useDepositNavigationState";

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
  WalletConnect: () => Promise<null | undefined>;
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

  const handleWalletSelect = async (wallet: DetectedWallet) => {
    setIsCryptoDropdownOpen(false);

    try {
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
  };

  const handleFiatSelect = () => {
    setIsFiatDropdownOpen(false);
  };

  const handleWalletConnect = async () => {
    // if (!universalConnector) {
    //   return;
    // }
    // const { session: providerSession } = await universalConnector.connect();
    // console.log({ providerSession }, "qqqqqq");
    // if (providerSession) {
    //   const ns = providerSession.namespaces["eip155"];
    //   if (!ns?.accounts?.length) return null;
    //   // Return the address from the first account in this namespace
    //   const adr = ns.accounts[0].split(":").slice(-1)[0];
    //   console.log({ adr });
    //   setCurrentStep("crypto-pay");
    // }
    WalletConnect().catch(() => resetNavigation());
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
