// Parameters for `wallet_addEthereumChain`, and the registry that supplies
// them for chains the wallet doesn't already know.
//
// Why a registry rather than the static table alone: the table only ever
// covered a handful of chains, so `addThenSwitch` threw "Unknown chain N" for
// everything else. Callers treated that as non-fatal and sent the transaction
// anyway — on whatever chain the wallet happened to be on. An approve built
// for Plume went out on Base, hit an address with no code there, and "succeeded"
// while approving nothing. The catalog already knows every chain's RPC and
// native currency, so it registers them here as it loads them.
import type { ChainDef } from "../types/";

export interface AddEthereumChainParams {
  chainIdHex: `0x${string}`;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls?: string[];
}

/** Curated fallbacks. Kept because these RPCs are known-good; the registry
 *  supplies everything else and takes precedence when present. */
const BUILTIN_CHAIN_PARAMS: Record<number, AddEthereumChainParams> = {
  1: {
    chainIdHex: "0x1",
    chainName: "Ethereum",
    rpcUrls: ["https://eth.llamarpc.com"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://etherscan.io"],
  },
  137: {
    chainIdHex: "0x89",
    chainName: "Polygon",
    rpcUrls: ["https://polygon-rpc.com"],
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  8453: {
    chainIdHex: "0x2105",
    chainName: "Base",
    rpcUrls: ["https://mainnet.base.org"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://basescan.org"],
  },
  42161: {
    chainIdHex: "0xa4b1",
    chainName: "Arbitrum One",
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  43114: {
    chainIdHex: "0xa86a",
    chainName: "Avalanche C-Chain",
    rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    blockExplorerUrls: ["https://snowtrace.io"],
  },
};

const registered = new Map<number, AddEthereumChainParams>();

/** Registered params win over the builtin table: they come from the same
 *  catalog that produced the route, so they cannot drift from it. */
export function chainParamsFor(
  chainId: number
): AddEthereumChainParams | undefined {
  return registered.get(chainId) ?? BUILTIN_CHAIN_PARAMS[chainId];
}

export function registerChainParams(
  chainId: number,
  params: AddEthereumChainParams
): void {
  registered.set(chainId, params);
}

/** Only http(s) URLs are usable — MetaMask rejects ws:// in addEthereumChain,
 *  and a placeholder like "" would make the added chain unusable. */
function usableRpcUrls(chain: ChainDef): string[] {
  const candidates = [
    ...(Array.isArray(chain.rpcList) ? chain.rpcList : []),
    ...(chain.rpc ? [chain.rpc] : []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const url = String(raw ?? "").trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Build add-chain params from a catalog entry, or undefined when the entry
 *  lacks what the wallet requires (an RPC URL or a native currency). */
export function chainParamsFromChainDef(
  chain: ChainDef
): AddEthereumChainParams | undefined {
  const chainType = String(
    chain.chainType ?? chain.type ?? "evm"
  ).toLowerCase();
  if (chainType !== "evm") return undefined;

  const numericId = Number(chain.chainId ?? chain.id);
  if (!Number.isFinite(numericId) || numericId <= 0) return undefined;

  const rpcUrls = usableRpcUrls(chain);
  if (rpcUrls.length === 0) return undefined;

  const native = chain.nativeCurrency;
  const symbol = String(native?.symbol ?? "").trim();
  if (!symbol) return undefined;

  // decimals is required by the RPC schema and must be a number; the catalog
  // omits it for a few chains, where 18 is the EVM default.
  const decimals = Number(native?.decimals);

  const chainName = String(
    chain.networkName ?? chain.axelarChainName ?? chain.networkIdentifier ?? ""
  ).trim();

  const explorers = (chain.blockExplorerUrls ?? []).filter((u) =>
    /^https?:\/\//i.test(String(u ?? ""))
  );

  return {
    chainIdHex: `0x${numericId.toString(16)}`,
    chainName: chainName || `Chain ${numericId}`,
    rpcUrls,
    nativeCurrency: {
      name: String(native?.name ?? symbol),
      symbol,
      decimals: Number.isFinite(decimals) ? decimals : 18,
    },
    ...(explorers.length > 0 ? { blockExplorerUrls: explorers } : {}),
  };
}

/** Register every EVM chain in a catalog payload that carries usable params. */
export function registerChainParamsFromCatalog(chains: ChainDef[]): void {
  for (const chain of chains) {
    const params = chainParamsFromChainDef(chain);
    if (!params) continue;
    registerChainParams(Number(chain.chainId ?? chain.id), params);
  }
}
