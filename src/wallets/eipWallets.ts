 
 
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/wallet.ts
import type { WalletInterFaceAPI, EIP1193 } from "../types/";

/* ---------------- chain params for addChain fallback ---------------- */
const CHAIN_PARAMS: Record<
  number,
  {
    chainIdHex: `0x${string}`;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls?: string[];
  }
> = {
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

async function addThenSwitch(eth: EIP1193, chainId: number) {
  const p = CHAIN_PARAMS[chainId];
  if (!p) throw new Error(`Unknown chain ${chainId} (no params to add)`);
  await eth.request({ method: "wallet_addEthereumChain", params: [p] as any });
  await eth.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: p.chainIdHex }] as any,
  });
}

/* ---------------- EIP-1193 adapter (safe switching) ---------------- */
export function useEIP1193(eth: EIP1193): WalletInterFaceAPI {
  if (!eth?.request) throw new Error("useEIP1193: invalid provider");
  let switching = false;

  return {
    type: "eip1193",
    async getAddress() {
      const [a] = await eth.request({ method: "eth_requestAccounts" });
      if (!a) throw new Error("No connected address");
      return a;
    },
    async getChainId() {
      const hex = await eth.request({ method: "eth_chainId" });
      return parseInt(String(hex), 16);
    },
    async switchChain(chainId: number) {
      if (switching) return; // prevent 4001: already in progress
      switching = true;
      const hex =
        CHAIN_PARAMS[chainId]?.chainIdHex ?? `0x${chainId.toString(16)}`;
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hex }],
        });
      } catch (e: any) {
        if (e?.code === 4902) {
          await addThenSwitch(eth, chainId);
        } else if (e?.code === 4001) {
          // user rejected or wallet busy; don’t crash the flow
          console.warn("switchChain rejected/in-progress:", e);
        } else {
          throw e;
        }
      } finally {
        switching = false;
      }
    },
    request: (args) => eth.request(args),
  };
}

/* ---------------- Wagmi/Viem client adapter (version-agnostic) ---------------- */
export function useWagmi(client: any): WalletInterFaceAPI {
  if (!client) throw new Error("useWagmi: missing client");
  let switching = false;

  async function getAddress(): Promise<`0x${string}`> {
    const addr = client.account?.address as `0x${string}` | undefined;
    if (addr) return addr;
    if (typeof client.getAddresses === "function") {
      const arr = await client.getAddresses();
      if (arr?.[0]) return arr[0];
    }
    throw new Error("No connected address");
  }

  async function getChainId(): Promise<number> {
    const id = client.chain?.id ?? (await client.getChainId?.());
    return typeof id === "number" ? id : 0;
  }

  async function switchChain(target: number) {
    if (switching) return;
    switching = true;
    try {
      if (typeof client.switchChain === "function") {
        try {
          await client.switchChain({ id: target });
        } catch {
          await client.switchChain({ chainId: target });
        }
        return;
      }
      const eth = (globalThis as any).ethereum as EIP1193 | undefined;
      if (!eth?.request) throw new Error("switchChain not available");
      try {
        const hex =
          CHAIN_PARAMS[target]?.chainIdHex ?? `0x${target.toString(16)}`;
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hex }],
        });
      } catch (e: any) {
        if (e?.code === 4902) await addThenSwitch(eth, target);
        else if (e?.code === 4001)
          console.warn("switchChain rejected/in-progress:", e);
        else throw e;
      }
    } finally {
      switching = false;
    }
  }

  async function sendTransaction(tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
    chainId?: number;
  }) {
    if (typeof client.sendTransaction !== "function")
      throw new Error("sendTransaction not available");
    const account = await getAddress();
    const chainId = tx.chainId ?? (await getChainId());
    try {
      const res = await client.sendTransaction({
        account,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chain: { id: chainId },
      });
      return { hash: res.hash as `0x${string}` };
    } catch {
      const res = await client.sendTransaction({
        account,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chainId,
      });
      return { hash: res.hash as `0x${string}` };
    }
  }

  return {
    type: "wagmi",
    getAddress,
    getChainId,
    switchChain,
    sendTransaction,
  };
}

/* ---------------- Provider discovery (prefer Rabby) ---------------- */

type Detected = { id: string; name: string; provider: EIP1193 };

function nameOf(p: any): string {
  return (
    p?.providerInfo?.name ||
    p?.info?.name ||
    (p?.isRabby && "Rabby") ||
    (p?.isMetaMask && "MetaMask") ||
    (p?.isBraveWallet && "Brave Wallet") ||
    (p?.isCoinbaseWallet && "Coinbase Wallet") ||
    "Injected Wallet"
  );
}
function idOf(p: any): string {
  return nameOf(p).toLowerCase().replace(/\s+/g, "-") || "injected";
}

function rank(list: Detected[]): Detected[] {
  const score = (n: string) => {
    const s = n.toLowerCase();
    if (s.includes("rabby")) return 0;
    if (s.includes("metamask")) return 1;
    if (s.includes("coinbase")) return 2;
    if (s.includes("okx")) return 3;
    if (s.includes("brave")) return 99; // de-prioritize Brave
    return 50;
  };
  return [...list].sort((a, b) => score(a.name) - score(b.name));
}

/** Prefer Rabby automatically; fallback to others (no browser setting needed) */
export async function autoDetectWallet(
  timeoutMs = 400
): Promise<{ kind: "eip1193"; wallet: WalletInterFaceAPI } | null> {
  if (typeof window === "undefined") return null;
  const w = window as any;

  const announced: any[] = [];
  const handler = (e: any) => {
    if (e?.detail?.provider?.request) announced.push(e.detail.provider);
  };
  w.addEventListener?.("eip6963:announceProvider", handler);
  w.dispatchEvent?.(new Event("eip6963:requestProvider"));
  await new Promise((res) => setTimeout(res, timeoutMs));
  w.removeEventListener?.("eip6963:announceProvider", handler);

  const candidates: any[] = [];
  if (w.ethereum?.request) {
    const multi = Array.isArray(w.ethereum.providers)
      ? w.ethereum.providers
      : [w.ethereum];
    for (const p of multi) if (p?.request) candidates.push(p);
  }
  for (const p of announced)
    if (p?.request && !candidates.includes(p)) candidates.push(p);

  if (candidates.length === 0) return null;

  const dedup = new Map<string, Detected>();
  for (const p of candidates) {
    const det = { id: idOf(p), name: nameOf(p), provider: p as EIP1193 };
    dedup.set(det.id, det);
  }

  const best = rank(Array.from(dedup.values()))[0];
  return { kind: "eip1193", wallet: useEIP1193(best.provider) };
}
