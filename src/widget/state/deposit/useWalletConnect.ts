import { UniversalConnector } from "@reown/appkit-universal-connector";
import { useCallback, useEffect, useState } from "react";
import { TrustwareConfigStore } from "src/config";
import { getUniversalConnector } from "src/config/walletconnect";
import { WalletConnectConfig, WalletInterFaceAPI } from "src/types";
import { walletManager } from "../../../wallets/manager";
import { NavigationStep } from "./types";

type WalletConnectSession = {
  expiry?: number;
  namespaces?: Record<string, { accounts?: string[] }>;
};

function getEvmAccount(session?: WalletConnectSession | null) {
  const account = session?.namespaces?.eip155?.accounts?.[0];
  const [, chainId, address] = account?.split(":") ?? [];

  if (!chainId || !address) {
    return null;
  }

  return {
    address,
    chainId: Number(chainId),
  };
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

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

  const attachWalletConnectWallet = useCallback(
    (connector: UniversalConnector, session: WalletConnectSession) => {
      const account = getEvmAccount(session);
      if (!account) {
        return null;
      }

      const activeAddress = account.address;
      let activeChainId = account.chainId;

      connector.provider.setDefaultChain(`eip155:${activeChainId}`);

      const wallet: WalletInterFaceAPI = {
        ecosystem: "evm",
        type: "eip1193",
        async getAddress() {
          return activeAddress;
        },
        async getChainId() {
          return activeChainId;
        },
        async switchChain(chainId: number) {
          connector.provider.setDefaultChain(`eip155:${chainId}`);
          await connector.provider.request(
            {
              method: "wallet_switchEthereumChain",
              params: [{ chainId: toHexChainId(chainId) }],
            },
            `eip155:${chainId}`
          );
          activeChainId = chainId;
        },
        async request(args) {
          const tx = Array.isArray(args.params)
            ? (args.params[0] as { chainId?: unknown } | undefined)
            : undefined;
          const requestedChainId =
            typeof tx?.chainId === "string"
              ? Number.parseInt(tx.chainId, 16)
              : activeChainId;
          const chain = Number.isFinite(requestedChainId)
            ? `eip155:${requestedChainId}`
            : `eip155:${activeChainId}`;

          connector.provider.setDefaultChain(chain);
          return connector.provider.request(args, chain);
        },
        async disconnect() {
          await connector.disconnect();
        },
      };

      walletManager.attachWallet(wallet);
      setWalletConnectAddress(activeAddress);

      return activeAddress;
    },
    []
  );

  const getAddrAndRedirect = useCallback(
    (
      connector: UniversalConnector,
      session: WalletConnectSession
    ): string | null => {
      const adr = attachWalletConnectWallet(connector, session);
      if (!adr) return null;

      setCurrentStep("crypto-pay");
      console.log({ adr });
      return adr;
    },
    [attachWalletConnectWallet, setCurrentStep]
  );

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
        getAddrAndRedirect(universalConnector, session);
        return;
      }

      const { session: providerSession } = await universalConnector.connect();

      if (providerSession) {
        getAddrAndRedirect(universalConnector, providerSession);
        return;
      }
    },
    [getAddrAndRedirect, setWalletType, universalConnector]
  );

  const disconnectWalletConnect = async () => {
    if (universalConnector) {
      await walletManager.disconnect();
      setWalletType("other");
      setCurrentStep("home");
    }
  };

  useEffect(() => {
    const provider = universalConnector?.provider;
    if (!provider) {
      return;
    }

    const handleSessionUpdate = ({
      session,
    }: {
      session?: WalletConnectSession;
    }) => {
      console.log("session_update");
      if (session) {
        attachWalletConnectWallet(universalConnector, session);
      }
    };
    const handleSessionDelete = () => {
      console.log("session_delete");
      setWalletConnectAddress(null);
      void walletManager.disconnect();
    };

    provider.on("session_update", handleSessionUpdate);
    provider.on("session_delete", handleSessionDelete);

    return () => {
      provider.off("session_update", handleSessionUpdate);
      provider.off("session_delete", handleSessionDelete);
    };
  }, [attachWalletConnectWallet, universalConnector]);

  return {
    universalConnector,
    walletConnectAddress,
    WalletConnect,
    disconnectWalletConnect,
  };
}
