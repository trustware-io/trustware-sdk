// src/wallet.ts
import type { WalletInterFaceAPI, EIP1193 } from "./types";

// create EIP-1193 adapter
export function useEIP1193(eth: EIP1193): WalletInterFaceAPI {
  if (!eth?.request) throw new Error("useEIP1193: invalid provider");
  return {
    type: "eip1193",
    async getAddress() {
      const [a] = await eth.request({ method: "eth_requestAccounts" });
      return a;
    },
    async getChainId() {
      const hex = await eth.request({ method: "eth_chainId" });
      return parseInt(String(hex), 16);
    },
    async switchChain(chainId: number) {
      const hex = `0x${chainId.toString(16)}`;
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hex }],
      });
    },
    request: (args) => eth.request(args),
  };
}

// wagmi adapter
export function useWagmi(client: {
  getAddresses: () => Promise<readonly `0x${string}`[]>;
  sendTransaction: (tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
    chainId?: number;
  }) => Promise<{ hash: `0x${string}` }>;
  chain?: { id: number };
  getChainId?: () => Promise<number>;
  switchChain?: (args: { chainId: number }) => Promise<void>;
}): WalletInterFaceAPI {
  if (!client?.sendTransaction) throw new Error("useWagmi: invalid client");
  return {
    type: "wagmi",
    async getAddress() {
      const [a] = await client.getAddresses();
      if (!a) throw new Error("No connected address");
      return a;
    },
    async getChainId() {
      return client.chain?.id ?? (await client.getChainId?.()) ?? 0;
    },
    async switchChain(chainId: number) {
      if (!client.switchChain) throw new Error("switchChain not available");
      await client.switchChain({ chainId });
    },
    sendTransaction: client.sendTransaction,
  };
}

/** Try EIP-6963 (multi-provider) for ≤timeoutMs, else fallback to window.ethereum */
export async function autoDetectWallet(
  timeoutMs = 400,
): Promise<{ kind: "eip1193"; wallet: WalletInterFaceAPI } | null> {
  if (typeof window === "undefined") return null;
  const w = window as any;

  // collect announced providers
  const found: EIP1193[] = [];
  const handler = (e: any) => {
    if (e?.detail?.provider?.request) found.push(e.detail.provider);
  };
  w.addEventListener?.("eip6963:announceProvider", handler);
  w.dispatchEvent?.(new Event("eip6963:requestProvider"));

  // short wait then cleanup
  await new Promise((res) => setTimeout(res, timeoutMs));
  w.removeEventListener?.("eip6963:announceProvider", handler);

  const eth: EIP1193 | undefined = found[0] ?? w.ethereum;
  if (!eth?.request) return null;
  return { kind: "eip1193", wallet: useEIP1193(eth) };
}
