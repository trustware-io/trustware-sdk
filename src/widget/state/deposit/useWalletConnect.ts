import { useCallback, useEffect } from "react";
import { TrustwareConfigStore } from "src/config";
import { WalletConnectConfig } from "src/types";
import { NavigationStep } from "./types";
import { useWalletConnectConnect, walletManager } from "src/wallets";
import { WalletNamespace } from "src/widget/context/DepositContext";

export function useWalletConnect({
  setWalletType,
  setCurrentStep,
  selectedNamespace,
  setSelectedNamespace,
}: {
  setWalletType: React.Dispatch<
    React.SetStateAction<"walletconnect" | "other">
  >;
  setCurrentStep: (step: NavigationStep) => void;
  selectedNamespace: WalletNamespace;
  setSelectedNamespace: React.Dispatch<React.SetStateAction<WalletNamespace>>;
}) {
  const walletConnectCfg = TrustwareConfigStore.peek()?.walletConnect as
    WalletConnectConfig | undefined;

  const connectWC = useWalletConnectConnect(walletConnectCfg);

  const ecosystem: "evm" | "solana" =
    selectedNamespace.trim().toLowerCase() === "solana" ? "solana" : "evm";

  // A WalletConnect approval can complete on the wallet's side while our own
  // page has been silently reloaded by the OS during the app-switch round
  // trip (common on mobile) — the connect() call that was awaiting approval
  // never resolves in that (now-gone) JS context. WalletConnect's own
  // SignClient still restores the resulting session from storage on every
  // init, though, so check for one on mount and pick up where the reload cut
  // us off, instead of leaving the widget stuck on the home screen forever.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restoredEcosystem =
        await walletManager.restoreWalletConnectSession(walletConnectCfg);
      if (cancelled || !restoredEcosystem) return;

      setWalletType("walletconnect");
      if (restoredEcosystem === "solana") {
        setSelectedNamespace("Solana");
      }

      const address = walletManager.identity?.addresses[0]?.address ?? null;
      if (address) setCurrentStep("crypto-pay");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const WalletConnect = useCallback(async () => {
    // console.log("got called");
    if (
      walletManager.status === "connected" &&
      walletManager.connectedVia === "walletconnect" &&
      walletManager.wallet?.ecosystem === ecosystem
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
    const { error } = await connectWC(ecosystem);

    if (!error) {
      // console.log("I didnt error");
      const address = walletManager.identity?.addresses[0]?.address ?? null;
      if (address) {
        // console.log("I have an address", address);
        setCurrentStep("crypto-pay");
      } else {
        console.error(
          "[Trustware SDK] WalletConnect session established but no address " +
            `resolved for ecosystem "${ecosystem}".`
        );
      }
    } else {
      console.error("[Trustware SDK] WalletConnect connection failed:", error);
      setWalletType("other");
    }
  }, [connectWC, ecosystem, setCurrentStep, setWalletType]);

  const disconnectWalletConnect = useCallback(async () => {
    // walletManager.disconnect() handles: wallet.disconnect(), provider event
    // cleanup, resetUniversalConnector(), and status → "idle" emission.
    await walletManager.disconnect();
    setWalletType("other");
    setCurrentStep("home");
  }, [setCurrentStep, setWalletType]);

  // identity snapshot has the last-synced address, for whichever ecosystem
  // (evm or solana) the WalletConnect session was established for.
  const walletConnectAddress =
    walletManager.status === "connected" &&
    walletManager.connectedVia === "walletconnect"
      ? (walletManager.identity?.addresses[0]?.address ?? null)
      : null;

  return {
    walletConnectAddress,
    WalletConnect,
    disconnectWalletConnect,
  };
}
