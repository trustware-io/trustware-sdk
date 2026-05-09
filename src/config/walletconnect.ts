// import type { AppKitNetwork } from "@reown/appkit/networks";
// import type { CustomCaipNetwork } from "@reown/appkit-common";
// import { UniversalConnector } from "@reown/appkit-universal-connector";
// import { TrustwareConfigStore } from "./store";
// import { ResolvedWalletConnectConfig, WalletConnectConfig } from "src/types";
// import { WALLETCONNECT_PROJECT_ID } from "src/constants";

// // Get projectId from https://dashboard.walletconnect.com
// // export const projectId = "896c4c8fa652baf14b9614e4026aff6a"; // this is a public projectId only to use on localhost
// // export const projectId = "";

// export const solanaMainnet: CustomCaipNetwork<"solana"> = {
//   id: 1,
//   chainNamespace: "solana",
//   caipNetworkId: "solana:5eykt4UsFv8P8NJdTREpY1vzqAQ3H1FQ",
//   name: "Solana Mainnet",
//   nativeCurrency: {
//     name: "Solana",
//     symbol: "SOL",
//     decimals: 9,
//   },
//   rpcUrls: {
//     default: {
//       http: ["https://api.mainnet-beta.solana.com"],
//     },
//   },
// };

// export const bitcoinMainnet: CustomCaipNetwork<"bip122"> = {
//   id: 0,
//   chainNamespace: "bip122",
//   caipNetworkId: "bip122:000000000019d6689c085ae165831e93",
//   name: "Bitcoin Mainnet",
//   nativeCurrency: {
//     name: "Bitcoin",
//     symbol: "BTC",
//     decimals: 8,
//   },
//   rpcUrls: {
//     default: {
//       http: ["https://api.blockcypher.com/v1/btc/main"],
//     },
//   },
// };

// export const ethereumMainnet: CustomCaipNetwork<"eip155"> = {
//   id: 1,
//   chainNamespace: "eip155",
//   caipNetworkId: "eip155:1",
//   name: "Ethereum Mainnet",
//   nativeCurrency: {
//     name: "Ether",
//     symbol: "ETH",
//     decimals: 18,
//   },
//   rpcUrls: {
//     default: {
//       http: ["https://rpc.ankr.com/eth"],
//     },
//   },
// };

// export const seiMainnet: CustomCaipNetwork<"eip155"> = {
//   id: 1329,
//   chainNamespace: "eip155",
//   caipNetworkId: "eip155:1329",
//   name: "Sei Mainnet",
//   nativeCurrency: {
//     name: "Sei",
//     symbol: "SEI",
//     decimals: 18,
//   },
//   rpcUrls: {
//     default: {
//       http: ["https://evm-rpc.sei-apis.com"],
//     },
//   },
// };

// export const networks1 = [
//   solanaMainnet,
//   bitcoinMainnet,
//   ethereumMainnet,
//   seiMainnet,
// ] as [AppKitNetwork, ...AppKitNetwork[]];

// let universalConnectorPromise: Promise<UniversalConnector> | null = null;

// function resolvedMetadata() {
//   const cfg = TrustwareConfigStore.peek();
//   const walletConnect = cfg
//     ? (cfg?.walletConnect as ResolvedWalletConnectConfig)
//     : undefined;
//   const configured = walletConnect?.metadata;
//   const pageUrl =
//     typeof window !== "undefined" && window.location?.origin
//       ? window.location.origin
//       : configured?.url;

//   return {
//     name: configured?.name ?? "Trustware",
//     description: configured?.description ?? "Cross-chain bridge & top-up",
//     url: pageUrl ?? "https://trustware.io",
//     icons: configured?.icons?.length
//       ? configured.icons
//       : ["https://app.trustware.io/icon.png"],
//   };
// }

// export async function getUniversalConnector(
//   walletCfg: WalletConnectConfig | undefined
// ) {
//   console.log({ ID: walletCfg?.projectId ?? WALLETCONNECT_PROJECT_ID });
//   if (!universalConnectorPromise) {
//     console.log({ walletCfg });
//     universalConnectorPromise = UniversalConnector.init({
//       projectId: walletCfg?.projectId ?? WALLETCONNECT_PROJECT_ID,
//       metadata: resolvedMetadata(),
//       networks: [
//         {
//           namespace: "solana",
//           chains: [solanaMainnet],
//           methods: ["solana_signMessage", "solana_signTransaction"],
//           events: [],
//         },
//         {
//           namespace: "eip155",
//           chains: [ethereumMainnet, seiMainnet],
//           methods: ["eth_sendTransaction", "eth_sign", "personal_sign"],
//           events: ["accountsChanged", "chainChanged"],
//         },
//         {
//           namespace: "bip122",
//           chains: [bitcoinMainnet],
//           methods: ["btc_signMessage"],
//           events: [],
//         },
//       ],
//     }).catch((error) => {
//       universalConnectorPromise = null;
//       console.error(
//         "[Trustware SDK] Failed to initialize WalletConnect:",
//         error
//       );
//     }) as Promise<UniversalConnector>;
//   }

//   return universalConnectorPromise;
// }

import type { AppKitNetwork } from "@reown/appkit/networks";
import type { CustomCaipNetwork } from "@reown/appkit-common";
import { UniversalConnector } from "@reown/appkit-universal-connector";
import { TrustwareConfigStore } from "./store";
import { ResolvedWalletConnectConfig, WalletConnectConfig } from "src/types";
import { WALLETCONNECT_PROJECT_ID } from "src/constants";

// ─── Network definitions ──────────────────────────────────────────────────────

// FIX 1: solanaMainnet no longer uses id:1 (that belongs to Ethereum).
// Solana doesn't have a meaningful numeric EVM chain ID, so we use a large
// unique constant that won't collide with any EVM chain.
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

// FIX 2: bitcoinMainnet no longer uses id:0 (falsy in JS).
// BIP-122 chain IDs are derived from the genesis block hash; we use a
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

// ─── Typed chain registries ───────────────────────────────────────────────────
// Each namespace keeps its own correctly-typed array. This avoids filtering
// through AppKitNetwork (a union that doesn't expose chainNamespace) and
// gives TypeScript full visibility into each chain's shape.

const solanaChains: CustomCaipNetwork<"solana">[] = [solanaMainnet];
const evmChains: CustomCaipNetwork<"eip155">[] = [ethereumMainnet, seiMainnet];
const bitcoinChains: CustomCaipNetwork<"bip122">[] = [bitcoinMainnet];

// FIX 6: Single source of truth for all networks.
// AppKit receives this array for its UI; the namespace config below is derived
// from the typed arrays above, so adding a chain in one place updates both.
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  ...solanaChains,
  ...bitcoinChains,
  ...evmChains,
];

// ─── Namespace config ─────────────────────────────────────────────────────────

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
    // FIX 8: Use the standard WalletConnect BIP-122 method name, not the
    // non-standard "btc_signMessage" prefix that most wallets reject.
    methods: ["signMessage", "sendTransfer"],
    events: [] as string[],
  },
];

// ─── Metadata ─────────────────────────────────────────────────────────────────

// FIX 5: resolvedMetadata() warns clearly when url cannot be determined,
// rather than silently falling back to a hardcoded domain that will fail
// WalletConnect's domain verification for real deployments.
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

// ─── Singleton connector ──────────────────────────────────────────────────────

let universalConnectorPromise: Promise<UniversalConnector> | null = null;
// FIX 4: Track which projectId was used to create the current singleton so we
// can detect when it changes and reinitialize accordingly.
let initializedProjectId: string | null = null;

export async function getUniversalConnector(
  walletCfg: WalletConnectConfig | undefined
): Promise<UniversalConnector> {
  const projectId = walletCfg?.projectId ?? WALLETCONNECT_PROJECT_ID;

  // FIX 4: If the projectId has changed since the last init, bust the cache
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
      // FIX 3: Reset the promise so the next call can retry, then re-throw
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

// ─── Cleanup helper ───────────────────────────────────────────────────────────
// Call this if you need to force a full re-initialization (e.g. on logout).

export function resetUniversalConnector(): void {
  universalConnectorPromise = null;
  initializedProjectId = null;
}
