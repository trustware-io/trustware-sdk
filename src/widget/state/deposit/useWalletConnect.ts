/* eslint-disable @typescript-eslint/no-explicit-any */
import { UniversalConnector } from "@reown/appkit-universal-connector";
import { useCallback, useEffect, useState } from "react";
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

  function getAddrAndRedirect(session: any): string | null {
    const ns = session.namespaces["eip155"];
    if (!ns?.accounts?.length) return null;
    // Return the address from the first account in this namespace
    const adr = ns.accounts[0].split(":").slice(-1)[0];
    setWalletConnectAddress(adr);
    setCurrentStep("crypto-pay");
    console.log({ adr });
    return adr;
  }

  const WalletConnect = useCallback(
    async function () {
      console.log("got called");
      if (!universalConnector) {
        return;
      }

      setWalletType("walletconnect");

      const session = universalConnector.provider.session;
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const isActive = session && session.expiry > nowInSeconds;

      console.log({ isActive, session });

      if (isActive && session) {
        getAddrAndRedirect(session);
        return;
      }

      const { session: providerSession } = await universalConnector.connect();

      if (providerSession) {
        getAddrAndRedirect(providerSession);
        return;
      }
    },
    [setCurrentStep, setWalletType, universalConnector]
  );

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

    // return () => {
    //   provider.off("session_update", handleSessionUpdate);
    //   provider.off("session_delete", handleSessionDelete);
    // };
  }, [universalConnector]);

  return {
    universalConnector,
    walletConnectAddress,
    WalletConnect,
    disconnectWalletConnect,
  };
}
