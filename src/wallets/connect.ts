/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DetectedWallet, WalletInterFaceAPI } from "../types";
import type { WagmiBridge } from "./bridges";
import { toWalletInterfaceFromDetected } from "./adapters";

function pickWagmiConnector(
  wagmi: WagmiBridge,
  metaName: string,
  metaId: string,
  metaCategory: string,
) {
  const lower = metaName.toLowerCase();
  const cons = wagmi.connectors();
  return (
    cons.find((c) => c.name.toLowerCase().includes(lower)) ||
    (metaId === "coinbase" &&
      cons.find((c) => c.name.toLowerCase().includes("coinbase"))) ||
    (metaId === "walletconnect" &&
      cons.find((c) => (c.type ?? "").toLowerCase() === "walletconnect")) ||
    (metaCategory === "injected" &&
      cons.find((c) => (c.type ?? "").toLowerCase() === "injected")) ||
    null
  );
}

/** Try wagmi bridge first (if provided), otherwise return EIP-1193 adapter. */
export async function connectDetectedWallet(
  dw: DetectedWallet,
  opts?: { wagmi?: WagmiBridge; touchAddress?: boolean },
): Promise<{ via: "wagmi" | "eip1193"; api: WalletInterFaceAPI | null }> {
  const { wagmi, touchAddress = true } = opts ?? {};

  if (wagmi) {
    const conn = pickWagmiConnector(
      wagmi,
      dw.meta.name,
      dw.meta.id,
      dw.meta.category,
    );
    if (conn) {
      await wagmi.connect(conn);
      // when the host uses wagmi, you can later wrap the host client using your old useWagmi adapter
      return { via: "wagmi", api: null };
    }
  }

  // fallback: raw EIP-1193
  const api = toWalletInterfaceFromDetected(dw);
  if (touchAddress) await api.getAddress(); // triggers permission prompt
  return { via: "eip1193", api };
}
