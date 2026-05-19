import type { AppKitNetwork } from "@reown/appkit/networks";
import type { CustomCaipNetwork } from "@reown/appkit-common";
import { UniversalConnector } from "@reown/appkit-universal-connector";
import { TrustwareConfigStore } from "./store";
import { ResolvedWalletConnectConfig, WalletConnectConfig } from "src/types";
import { WALLETCONNECT_PROJECT_ID } from "src/constants";

// ─── Non-EVM chains ───────────────────────────────────────────────────────────

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

// Sei Cosmos (pacific-1) — unique numeric placeholder, won't collide with EVM.
export const seiCosmosMainnet: CustomCaipNetwork<"cosmos"> = {
  id: 9001,
  chainNamespace: "cosmos",
  caipNetworkId: "cosmos:pacific-1",
  name: "Sei Cosmos",
  nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.sei-apis.com"] },
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

export const flareMainnet: CustomCaipNetwork<"eip155"> = {
  id: 14,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:14",
  name: "Flare",
  nativeCurrency: { name: "Flare", symbol: "FLR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://flare-api.flare.network/ext/C/rpc"] },
  },
};

export const cronosMainnet: CustomCaipNetwork<"eip155"> = {
  id: 25,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:25",
  name: "Cronos",
  nativeCurrency: { name: "Cronos", symbol: "CRO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evm.cronos.org"] },
  },
};

export const rootstockMainnet: CustomCaipNetwork<"eip155"> = {
  id: 30,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:30",
  name: "Rootstock",
  nativeCurrency: {
    name: "Rootstock Smart Bitcoin",
    symbol: "RBTC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://public-node.rsk.co"] },
  },
};

export const telosMainnet: CustomCaipNetwork<"eip155"> = {
  id: 40,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:40",
  name: "Telos",
  nativeCurrency: { name: "Telos", symbol: "TLOS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.telos.net"] },
  },
};

export const xdcMainnet: CustomCaipNetwork<"eip155"> = {
  id: 50,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:50",
  name: "XDC",
  nativeCurrency: { name: "XDC", symbol: "XDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xdcrpc.com"] },
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

export const victionMainnet: CustomCaipNetwork<"eip155"> = {
  id: 88,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:88",
  name: "Viction",
  nativeCurrency: { name: "Viction", symbol: "VIC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.viction.xyz"] },
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

export const fuseMainnet: CustomCaipNetwork<"eip155"> = {
  id: 122,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:122",
  name: "FUSE",
  nativeCurrency: { name: "FUSE", symbol: "FUSE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.fuse.io"] },
  },
};

export const unichainMainnet: CustomCaipNetwork<"eip155"> = {
  id: 130,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:130",
  name: "Unichain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.unichain.org"] },
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

export const monadMainnet: CustomCaipNetwork<"eip155"> = {
  id: 143,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:143",
  name: "MONAD",
  nativeCurrency: { name: "Mon", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz/"] },
  },
};

export const sonicMainnet: CustomCaipNetwork<"eip155"> = {
  id: 146,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:146",
  name: "Sonic",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.soniclabs.com"] },
  },
};

export const opBnbMainnet: CustomCaipNetwork<"eip155"> = {
  id: 204,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:204",
  name: "opBNB",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://opbnb-mainnet-rpc.bnbchain.org"] },
  },
};

export const lensMainnet: CustomCaipNetwork<"eip155"> = {
  id: 232,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:232",
  name: "Lens",
  nativeCurrency: { name: "GHO", symbol: "GHO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.lens.matterhosted.dev"] },
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

export const fraxtalMainnet: CustomCaipNetwork<"eip155"> = {
  id: 252,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:252",
  name: "Fraxtal",
  nativeCurrency: { name: "FRAX", symbol: "FRAX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.frax.com"] },
  },
};

export const bobaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 288,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:288",
  name: "Boba",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.boba.network"] },
  },
};

export const hederaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 295,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:295",
  name: "HEDERA",
  nativeCurrency: { name: "Hbar", symbol: "HBAR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.hashio.io/api"] },
  },
};

export const filecoinMainnet: CustomCaipNetwork<"eip155"> = {
  id: 314,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:314",
  name: "Filecoin",
  nativeCurrency: { name: "Filecoin", symbol: "FIL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.node.glif.io"] },
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

export const worldchainMainnet: CustomCaipNetwork<"eip155"> = {
  id: 480,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:480",
  name: "World Chain",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://worldchain-mainnet.g.alchemy.com/public"],
    },
  },
};

export const flowMainnet: CustomCaipNetwork<"eip155"> = {
  id: 747,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:747",
  name: "Flow",
  nativeCurrency: { name: "FLOW", symbol: "FLOW", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.evm.nodes.onflow.org"] },
  },
};

export const stableMainnet: CustomCaipNetwork<"eip155"> = {
  id: 988,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:988",
  name: "Stable",
  nativeCurrency: { name: "USDT0", symbol: "USDT0", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.stable.xyz"] },
  },
};

export const hyperEvmMainnet: CustomCaipNetwork<"eip155"> = {
  id: 999,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:999",
  name: "HyperEVM",
  nativeCurrency: { name: "Hyperliquid", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hyperliquid.xyz/evm"] },
  },
};

export const metisMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1088,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1088",
  name: "Metis",
  nativeCurrency: { name: "METIS", symbol: "METIS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://metis-public.nodies.app"] },
  },
};

export const liskMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1135,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1135",
  name: "Lisk",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.api.lisk.com"] },
  },
};

export const moonbeamMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1284,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1284",
  name: "Moonbeam",
  nativeCurrency: { name: "Moonbeam", symbol: "GLMR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.api.moonbeam.network"] },
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

export const hyperliquidMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1337,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1337",
  name: "Hyperliquid",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://li.quest/v1/rpc/1337"] },
  },
};

export const vanaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1480,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1480",
  name: "Vana",
  nativeCurrency: { name: "VAN", symbol: "VAN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.vana.org"] },
  },
};

export const gravityMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1625,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1625",
  name: "Gravity",
  nativeCurrency: { name: "G", symbol: "G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.gravity.xyz/"] },
  },
};

export const pharosMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1672,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1672",
  name: "Pharos Mainnet",
  nativeCurrency: { name: "Pharos", symbol: "PROS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pharos.xyz"] },
  },
};

export const soneiumMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1868,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1868",
  name: "Soneium",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.soneium.org/"] },
  },
};

export const swellchainMainnet: CustomCaipNetwork<"eip155"> = {
  id: 1923,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1923",
  name: "Swellchain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://swell-mainnet.alt.technology"] },
  },
};

export const roninMainnet: CustomCaipNetwork<"eip155"> = {
  id: 2020,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:2020",
  name: "Ronin",
  nativeCurrency: { name: "RON", symbol: "RON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.roninchain.com/rpc"] },
  },
};

export const kavaEvmMainnet: CustomCaipNetwork<"eip155"> = {
  id: 2222,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:2222",
  name: "Kava EVM",
  nativeCurrency: { name: "Kava", symbol: "KAVA", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evm2.kava.io"] },
  },
};

export const abstractMainnet: CustomCaipNetwork<"eip155"> = {
  id: 2741,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:2741",
  name: "Abstract",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.mainnet.abs.xyz"] },
  },
};

export const morphMainnet: CustomCaipNetwork<"eip155"> = {
  id: 2818,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:2818",
  name: "Morph",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.morph.network"] },
  },
};

export const peaqMainnet: CustomCaipNetwork<"eip155"> = {
  id: 3338,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:3338",
  name: "Peaq",
  nativeCurrency: { name: "Peaq", symbol: "PEAQ", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://quicknode1.peaq.xyz"] },
  },
};

export const tempoMainnet: CustomCaipNetwork<"eip155"> = {
  id: 4217,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:4217",
  name: "Tempo",
  nativeCurrency: { name: "PathUSD", symbol: "PathUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.tempo.xyz"] },
  },
};

export const megaEthMainnet: CustomCaipNetwork<"eip155"> = {
  id: 4326,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:4326",
  name: "MegaETH",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.megaeth.com/rpc"] },
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

export const somniaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 5031,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:5031",
  name: "Somnia",
  nativeCurrency: { name: "Somnia", symbol: "SOMI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.infra.mainnet.somnia.network/"] },
  },
};

export const kaiaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 8217,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:8217",
  name: "Kaia",
  nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://public-en.node.kaia.io"] },
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

export const plasmaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 9745,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:9745",
  name: "Plasma",
  nativeCurrency: { name: "XPL", symbol: "XPL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.plasma.to"] },
  },
};

export const immutableZkEvmMainnet: CustomCaipNetwork<"eip155"> = {
  id: 13371,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:13371",
  name: "Immutable zkEVM",
  nativeCurrency: { name: "IMX", symbol: "IMX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.immutable.com"] },
  },
};

export const apechainMainnet: CustomCaipNetwork<"eip155"> = {
  id: 33139,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:33139",
  name: "Apechain",
  nativeCurrency: { name: "ApeCoin", symbol: "APE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.apechain.com"] },
  },
};

export const modeMainnet: CustomCaipNetwork<"eip155"> = {
  id: 34443,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:34443",
  name: "Mode",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.mode.network"] },
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

export const arbitrumNovaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 42170,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:42170",
  name: "Arbitrum Nova",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://arbitrum-nova-rpc.publicnode.com"] },
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

export const etherlinkMainnet: CustomCaipNetwork<"eip155"> = {
  id: 42793,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:42793",
  name: "Etherlink",
  nativeCurrency: { name: "Tezos", symbol: "XTZ", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://node.mainnet.etherlink.com"] },
  },
};

export const hemiMainnet: CustomCaipNetwork<"eip155"> = {
  id: 43111,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:43111",
  name: "Hemi",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hemi.network/rpc"] },
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

export const sophonMainnet: CustomCaipNetwork<"eip155"> = {
  id: 50104,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:50104",
  name: "Sophon",
  nativeCurrency: { name: "SOPH", symbol: "SOPH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sophon.xyz"] },
  },
};

export const superpositionMainnet: CustomCaipNetwork<"eip155"> = {
  id: 55244,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:55244",
  name: "Superposition",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.superposition.so"] },
  },
};

export const inkMainnet: CustomCaipNetwork<"eip155"> = {
  id: 57073,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:57073",
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-gel.inkonchain.com"] },
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

export const bobMainnet: CustomCaipNetwork<"eip155"> = {
  id: 60808,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:60808",
  name: "BOB",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.gobob.xyz"] },
  },
};

export const berachainMainnet: CustomCaipNetwork<"eip155"> = {
  id: 80094,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:80094",
  name: "Berachain",
  nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.berachain.com/"] },
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

export const plumeMainnet: CustomCaipNetwork<"eip155"> = {
  id: 98866,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:98866",
  name: "Plume",
  nativeCurrency: { name: "PLUME", symbol: "PLUME", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.plume.org"] },
  },
};

export const taikoMainnet: CustomCaipNetwork<"eip155"> = {
  id: 167000,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:167000",
  name: "Taiko",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.taiko.xyz"] },
  },
};

export const scrollMainnet: CustomCaipNetwork<"eip155"> = {
  id: 534352,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:534352",
  name: "Scroll",
  nativeCurrency: { name: "Scroll", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.scroll.io"] },
  },
};

export const katanaMainnet: CustomCaipNetwork<"eip155"> = {
  id: 747474,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:747474",
  name: "Katana",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.katana.network"] },
  },
};

export const cornMainnet: CustomCaipNetwork<"eip155"> = {
  id: 21000000,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:21000000",
  name: "Corn",
  nativeCurrency: { name: "Bitcorn", symbol: "BTCN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.corn-rpc.com"] },
  },
};

export const evmChains: CustomCaipNetwork<"eip155">[] = [
  // Major L1s
  ethereumMainnet,
  bscMainnet,
  avalancheMainnet,
  polygonMainnet,
  // L2s / rollups
  arbitrumMainnet,
  arbitrumNovaMainnet,
  optimismMainnet,
  baseMainnet,
  zkSyncMainnet,
  lineaMainnet,
  mantleMainnet,
  blastMainnet,
  scrollMainnet,
  taikoMainnet,
  modeMainnet,
  inkMainnet,
  unichainMainnet,
  worldchainMainnet,
  swellchainMainnet,
  soneiumMainnet,
  liskMainnet,
  morphMainnet,
  abstractMainnet,
  megaEthMainnet,
  superpositionMainnet,
  fraxtalMainnet,
  // EVM-compatible L1s & app-chains
  gnosisMainnet,
  fantomMainnet,
  celoMainnet,
  sonicMainnet,
  berachainMainnet,
  moonbeamMainnet,
  metisMainnet,
  bobaMainnet,
  roninMainnet,
  kavaEvmMainnet,
  cronosMainnet,
  kaiaMainnet,
  flareMainnet,
  telosMainnet,
  xdcMainnet,
  fuseMainnet,
  victionMainnet,
  rootstockMainnet,
  hederaMainnet,
  filecoinMainnet,
  flowMainnet,
  opBnbMainnet,
  lensMainnet,
  apechainMainnet,
  etherlinkMainnet,
  hemiMainnet,
  immutableZkEvmMainnet,
  peaqMainnet,
  sophonMainnet,
  gravityMainnet,
  vanaMainnet,
  hyperliquidMainnet,
  hyperEvmMainnet,
  stableMainnet,
  tempoMainnet,
  plasmaMainnet,
  somniaMainnet,
  monadMainnet,
  pharosMainnet,
  bobMainnet,
  plumeMainnet,
  katanaMainnet,
  cornMainnet,
  // Sei EVM
  seiMainnet,
];

// ─── Typed chain registries ───────────────────────────────────────────────────
// Each namespace keeps its own correctly-typed array. This avoids filtering
// through AppKitNetwork (a union that doesn't expose chainNamespace) and
// gives TypeScript full visibility into each chain's shape.

const solanaChains: CustomCaipNetwork<"solana">[] = [solanaMainnet];

const bitcoinChains: CustomCaipNetwork<"bip122">[] = [bitcoinMainnet];

const cosmosChains: CustomCaipNetwork<"cosmos">[] = [seiCosmosMainnet];

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
  {
    namespace: "cosmos" as const,
    chains: cosmosChains,
    methods: ["cosmos_signDirect", "cosmos_signAmino", "cosmos_getAccounts"],
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
