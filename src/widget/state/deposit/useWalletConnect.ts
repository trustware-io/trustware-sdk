/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback } from "react";
import { TrustwareConfigStore } from "src/config";
import { WalletConnectConfig } from "src/types";
import { NavigationStep } from "./types";
import { useWalletConnectConnect, walletManager } from "src/wallets";

export function useWalletConnect({
  setWalletType,
  setCurrentStep,
}: {
  setWalletType: React.Dispatch<
    React.SetStateAction<"walletconnect" | "other">
  >;
  setCurrentStep: (step: NavigationStep) => void;
}) {
  const walletConnectCfg = TrustwareConfigStore.peek()?.walletConnect as
    | WalletConnectConfig
    | undefined;

  const connectWC = useWalletConnectConnect(walletConnectCfg);

  const WalletConnect = useCallback(async () => {
    // console.log("got called");
    if (
      walletManager.status === "connected" &&
      walletManager.connectedVia === "walletconnect"
    ) {
      // console.log("I am connedcted");
      const address = walletManager.identity?.addresses[0]?.address ?? null;
      if (address) {
        setWalletType("walletconnect");
        setCurrentStep("crypto-pay");
        return;
      }
    }

    setWalletType("walletconnect");
    const { error } = await connectWC();

    if (!error) {
      // console.log("I didnt error");
      const address = walletManager.identity?.addresses[0]?.address ?? null;
      if (address) {
        // console.log("I have an address", address);
        setCurrentStep("crypto-pay");
      }
    } else {
      setWalletType("other");
    }
  }, [connectWC, setCurrentStep, setWalletType]);

  const disconnectWalletConnect = useCallback(async () => {
    // walletManager.disconnect() handles: wallet.disconnect(), provider event
    // cleanup, resetUniversalConnector(), and status → "idle" emission.
    await walletManager.disconnect();
    setWalletType("other");
    setCurrentStep("home");
  }, [setCurrentStep, setWalletType]);

  const walletConnectAddress =
    walletManager.status === "connected" &&
    walletManager.connectedVia === "walletconnect"
      ? walletManager.wallet?.ecosystem === "evm"
        ? (walletManager.identity?.addresses[0]?.address ?? null) // identity snapshot has the last-synced address
        : null
      : null;

  return {
    walletConnectAddress,
    WalletConnect,
    disconnectWalletConnect,
  };
}
