import type { AppKitNetwork } from "@reown/appkit/networks";
import type { CustomCaipNetwork } from "@reown/appkit-common";
import { UniversalConnector } from "@reown/appkit-universal-connector";
import { TrustwareConfigStore } from "./store";
import { ResolvedWalletConnectConfig, WalletConnectConfig } from "src/types";
import { WALLETCONNECT_PROJECT_ID } from "src/constants";

//used a large unique constant that won't collide with any EVM chain.
export const solanaMainnet: CustomCaipNetwork<"solana"> = {
  id: 900,
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

// well-known non-zero placeholder that won't be treated as falsy.
export const bitcoinMainnet: CustomCaipNetwork<"bip122"> = {
  id: 8333,
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

// ─── EVM chains ───────────────────────────────────────────────────────────────

export const ethereumMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1",
  name: "Ethereum Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/eth"] },
  },
};

export const polygonMainnet: CustomCaipNetwork<"eip155"> = {
  id: 137,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:137",
  name: "Polygon Mainnet",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/polygon"] },
  },
};

export const arbitrumMainnet: CustomCaipNetwork<"eip155"> = {
  id: 42161,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:42161",
  name: "Arbitrum One",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/arbitrum"] },
  },
};

export const optimismMainnet: CustomCaipNetwork<"eip155"> = {
  id: 10,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:10",
  name: "Optimism Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/optimism"] },
  },
};

export const baseMainnet: CustomCaipNetwork<"eip155"> = {
  id: 8453,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:8453",
  name: "Base Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.base.org"] },
  },
};

export const avalancheMainnet: CustomCaipNetwork<"eip155"> = {
  id: 43114,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:43114",
  name: "Avalanche C-Chain",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/avalanche"] },
  },
};

export const bscMainnet: CustomCaipNetwork<"eip155"> = {
  id: 56,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:56",
  name: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/bsc"] },
  },
};

export const gnosisMainnet: CustomCaipNetwork<"eip155"> = {
  id: 100,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:100",
  name: "Gnosis Chain",
  nativeCurrency: { name: "xDAI", symbol: "XDAI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/gnosis"] },
  },
};

export const fantomMainnet: CustomCaipNetwork<"eip155"> = {
  id: 250,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:250",
  name: "Fantom Opera",
  nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/fantom"] },
  },
};

export const celoMainnet: CustomCaipNetwork<"eip155"> = {
  id: 42220,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:42220",
  name: "Celo Mainnet",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/celo"] },
  },
};

export const zkSyncMainnet: CustomCaipNetwork<"eip155"> = {
  id: 324,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:324",
  name: "zkSync Era Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.era.zksync.io"] },
  },
};

export const lineaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 59144,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:59144",
  name: "Linea Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.linea.build"] },
  },
};

export const mantleMainnet: CustomCaipNetwork<"eip155"> = {
  id: 5000,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:5000",
  name: "Mantle Mainnet",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mantle.xyz"] },
  },
};

export const blastMainnet: CustomCaipNetwork<"eip155"> = {
  id: 81457,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:81457",
  name: "Blast Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.blast.io"] },
  },
};

export const seiMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1329,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1329",
  name: "Sei Mainnet",
  nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evm-rpc.sei-apis.com"] },
  },
};

export const evmChains: CustomCaipNetwork<"eip155">[] = [
  ethereumMainnet,
  polygonMainnet,
  arbitrumMainnet,
  optimismMainnet,
  baseMainnet,
  avalancheMainnet,
  bscMainnet,
  gnosisMainnet,
  fantomMainnet,
  celoMainnet,
  zkSyncMainnet,
  lineaMainnet,
  mantleMainnet,
  blastMainnet,
  seiMainnet,
];

// ─── Typed chain registries ───────────────────────────────────────────────────
// Each namespace keeps its own correctly-typed array. This avoids filtering
// through AppKitNetwork (a union that doesn't expose chainNamespace) and
// gives TypeScript full visibility into each chain's shape.

const solanaChains: CustomCaipNetwork<"solana">[] = [solanaMainnet];

const bitcoinChains: CustomCaipNetwork<"bip122">[] = [bitcoinMainnet];

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  // ...solanaChains,
  // ...bitcoinChains,
  ...evmChains,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

const namespaceConfig = [
  {
    namespace: "solana" as const,
    chains: solanaChains,
    methods: ["solana_signMessage", "solana_signTransaction"],
    events: [] as string[],
  },
  {
    namespace: "eip155" as const,
    chains: evmChains,
    methods: [
      "eth_sendTransaction",
      "eth_signTransaction",
      "eth_sign",
      "personal_sign",
      "eth_signTypedData_v4",
    ],
    events: ["accountsChanged", "chainChanged"],
  },
  {
    namespace: "bip122" as const,
    chains: bitcoinChains,

    methods: ["signMessage", "sendTransfer"],
    events: [] as string[],
  },
];

// ─── Metadata ──
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

  if (!pageUrl) {
    console.warn(
      "[Trustware SDK] WalletConnect metadata.url could not be determined from " +
        "window.location or config. Falling back to 'https://trustware.io'. " +
        "Pass metadata.url explicitly in your WalletConnectConfig to avoid " +
        "domain verification failures in production."
    );
  }

  return {
    name: configured?.name ?? "Trustware",
    description: configured?.description ?? "Cross-chain bridge & top-up",
    url: pageUrl ?? "https://trustware.io",
    icons: configured?.icons?.length
      ? configured.icons
      : ["https://app.trustware.io/icon.png"],
  };
}

let universalConnectorPromise: Promise<UniversalConnector> | null = null;
// Keep track of which projectId was used to create the current singleton so we
// can detect when it changes and reinitialize accordingly.
let initializedProjectId: string | null = null;

export async function getUniversalConnector(
  walletCfg: WalletConnectConfig | undefined
): Promise<UniversalConnector> {
  const projectId = walletCfg?.projectId ?? WALLETCONNECT_PROJECT_ID;

  // If the projectId has changed since the last init, bust the cache
  // so the connector is recreated with the correct credentials.
  if (universalConnectorPromise && initializedProjectId !== projectId) {
    console.warn(
      "[Trustware SDK] projectId changed since last init — reinitializing WalletConnect connector."
    );
    universalConnectorPromise = null;
    initializedProjectId = null;
  }

  if (!universalConnectorPromise) {
    initializedProjectId = projectId;

    universalConnectorPromise = UniversalConnector.init({
      projectId,
      metadata: resolvedMetadata(),
      networks: namespaceConfig,
    }).catch((error) => {
      // Reseting the promise so the next call can retry, then re-throw
      // so callers receive a real rejection instead of resolving to undefined.
      universalConnectorPromise = null;
      initializedProjectId = null;
      console.error(
        "[Trustware SDK] Failed to initialize WalletConnect:",
        error
      );
      throw error;
    });
  }

  return universalConnectorPromise;
}

// will Call this if I need to force a full re-initialization (e.g. on logout).
export function resetUniversalConnector(): void {
  universalConnectorPromise = null;
  initializedProjectId = null;
}
