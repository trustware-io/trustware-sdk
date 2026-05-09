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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (universalConnector as any)?.on("session_update", () =>
    console.log("session_update")
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (universalConnector as any)?.on("session_delete", () =>
    console.log("session_delete")
  );

  return {
    universalConnector,
    walletConnectAddress,
    WalletConnect,
    disconnectWalletConnect,
  };
}
