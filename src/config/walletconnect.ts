import type { AppKitNetwork } from "@reown/appkit/networks";
import type { CustomCaipNetwork } from "@reown/appkit-common";
import { UniversalConnector } from "@reown/appkit-universal-connector";
import { TrustwareConfigStore } from "./store";
import { ResolvedWalletConnectConfig, WalletConnectConfig } from "src/types";
import { WALLETCONNECT_PROJECT_ID } from "../constants";

export const solanaMainnet: CustomCaipNetwork<"solana"> = {
  id: 1,
  chainNamespace: "solana",
  caipNetworkId: "solana:5eykt4UsFv8P8NJdTREpY1vzqAQ3H1FQ",
  name: "Solana Mainnet",
  nativeCurrency: {
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
  },
  rpcUrls: {
    default: {
      http: ["https://api.mainnet-beta.solana.com"],
    },
  },
};

export const bitcoinMainnet: CustomCaipNetwork<"bip122"> = {
  id: 0,
  chainNamespace: "bip122",
  caipNetworkId: "bip122:000000000019d6689c085ae165831e93",
  name: "Bitcoin Mainnet",
  nativeCurrency: {
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
  },
  rpcUrls: {
    default: {
      http: ["https://api.blockcypher.com/v1/btc/main"],
    },
  },
};

export const ethereumMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1",
  name: "Ethereum Mainnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.ankr.com/eth"],
    },
  },
};

export const seiMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1329,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1329",
  name: "Sei Mainnet",
  nativeCurrency: {
    name: "Sei",
    symbol: "SEI",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc.sei-apis.com"],
    },
  },
};

export const networks1 = [
  solanaMainnet,
  bitcoinMainnet,
  ethereumMainnet,
  seiMainnet,
] as [AppKitNetwork, ...AppKitNetwork[]];

let universalConnectorPromise: Promise<UniversalConnector> | null = null;

function resolvedMetadata() {
  const cfg = TrustwareConfigStore.peek();
  const walletConnect = cfg
    ? (cfg?.walletConnect as ResolvedWalletConnectConfig)
    : undefined;
  const configured = walletConnect?.metadata;
  const pageUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : configured?.url;

  return {
    name: configured?.name ?? "Trustware",
    description: configured?.description ?? "Cross-chain bridge & top-up",
    url: pageUrl ?? "https://trustware.io",
    icons: configured?.icons?.length
      ? configured.icons
      : ["https://app.trustware.io/icon.png"],
  };
}

export async function getUniversalConnector(
  walletCfg: WalletConnectConfig | undefined
) {
  const projectId = walletCfg?.projectId ?? WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    console.warn(
      "[Trustware SDK] WalletConnect disabled: no projectId. Set TRUSTWARE_WALLETCONNECT_PROJECT_ID at build time or pass walletConnect.projectId in config."
    );
    return undefined;
  }
  if (!universalConnectorPromise) {
    universalConnectorPromise = UniversalConnector.init({
      projectId,
      metadata: resolvedMetadata(),
      networks: [
        {
          namespace: "solana",
          chains: [solanaMainnet],
          methods: ["solana_signMessage", "solana_signTransaction"],
          events: [],
        },
        {
          namespace: "eip155",
          chains: [ethereumMainnet, seiMainnet],
          methods: ["eth_sendTransaction", "eth_sign", "personal_sign"],
          events: ["accountsChanged", "chainChanged"],
        },
        {
          namespace: "bip122",
          chains: [bitcoinMainnet],
          methods: ["btc_signMessage"],
          events: [],
        },
      ],
    }).catch((error) => {
      universalConnectorPromise = null;
      throw error;
    });
  }

  return universalConnectorPromise;
}
