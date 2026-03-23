import { useCallback, useEffect, useState } from "react";

import { useWalletDetection } from "../../../wallets/detect";
import { walletManager } from "../../../wallets/manager";

import type { WalletInterFaceAPI, DetectedWallet } from "../../../types";
import type { WalletStatus } from "./types";

export function useWalletSessionState() {
  const [selectedWallet, setSelectedWallet] =
    useState<WalletInterFaceAPI | null>(walletManager.wallet);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>(
    walletManager.status as WalletStatus
  );

  const { detected } = useWalletDetection();

  useEffect(() => {
    walletManager.setDetected(detected);
  }, [detected]);

  useEffect(() => {
    const unsubscribe = walletManager.onChange((status) => {
      setWalletStatus(status as WalletStatus);
      setSelectedWallet(walletManager.wallet);

      if (status === "connected" && walletManager.wallet) {
        walletManager.wallet
          .getAddress()
          .then(setWalletAddress)
          .catch(() => {
            setWalletAddress(null);
          });
      } else if (status !== "connected") {
        setWalletAddress(null);
      }
    });

    if (walletManager.status === "connected" && walletManager.wallet) {
      walletManager.wallet
        .getAddress()
        .then(setWalletAddress)
        .catch(() => {
          setWalletAddress(null);
        });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const connectWallet = useCallback(async (wallet: DetectedWallet) => {
    await walletManager.connectDetected(wallet);
  }, []);

  const disconnectWallet = useCallback(async () => {
    await walletManager.disconnect();
  }, []);

  return {
    selectedWallet,
    walletAddress,
    walletStatus,
    connectWallet,
    disconnectWallet,
  };
}
