import { UniversalConnector } from "@reown/appkit-universal-connector";
import { useEffect, useState } from "react";
import { TrustwareConfigStore } from "src/config";
import { getUniversalConnector } from "src/config/walletconnect";
import { WalletConnectConfig } from "src/types";
import { NavigationStep } from "./types";

export function useWalletConnect({
  setWalletType,
  setCurrentStep,
}: {
  setWalletType: React.Dispatch<
    React.SetStateAction<"walletconnect" | "other">
  >;
  setCurrentStep: (step: NavigationStep) => void;
}) {
  const [universalConnector, setUniversalConnector] =
    useState<UniversalConnector>();
  const [walletConnectAddress, setWalletConnectAddress] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const walletConnect = TrustwareConfigStore.peek()
      ?.walletConnect as WalletConnectConfig;

    getUniversalConnector(walletConnect as WalletConnectConfig).then(
      setUniversalConnector
    );
  }, [TrustwareConfigStore.peek()?.walletConnect]);

  useEffect(() => {
    return () => {
      universalConnector?.disconnect();
    };
  }, [universalConnector]);

  const WalletConnect = async () => {
    if (!universalConnector) {
      return;
    }

    setWalletType("walletconnect");

    const { session: providerSession } = await universalConnector.connect();

    console.log({ providerSession });
    if (providerSession) {
      const ns = providerSession.namespaces["eip155"];
      if (!ns?.accounts?.length) return null;

      // Return the address from the first account in this namespace
      const adr = ns.accounts[0].split(":").slice(-1)[0];
      setWalletConnectAddress(adr);
      setCurrentStep("crypto-pay");
      console.log({ adr });
    }
  };

  const disconnectWalletConnect = async () => {
    if (universalConnector) {
      await universalConnector.disconnect();
      setWalletType("other");
      setCurrentStep("home");
    }
  };

  useEffect(() => {
    const provider = universalConnector?.provider;
    if (!provider) {
      return;
    }

    const handleSessionUpdate = () => console.log("session_update");
    const handleSessionDelete = () => console.log("session_delete");

    provider.on("session_update", handleSessionUpdate);
    provider.on("session_delete", handleSessionDelete);

    return () => {
      provider.off("session_update", handleSessionUpdate);
      provider.off("session_delete", handleSessionDelete);
    };
  }, [universalConnector]);

  return {
    universalConnector,
    walletConnectAddress,
    WalletConnect,
    disconnectWalletConnect,
  };
}
