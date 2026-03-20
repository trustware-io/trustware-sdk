import type { DetectedWallet, WalletInterFaceAPI } from "../types";
import type { WagmiBridge } from "./bridges";
import { toWalletInterfaceFromDetected } from "./adapters";
// import { connectWalletConnect } from "./walletconnect";

function pickWagmiConnector(
  wagmi: WagmiBridge,
  metaName: string,
  metaId: string,
  metaCategory: string
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
  opts?: { wagmi?: WagmiBridge; touchAddress?: boolean }
): Promise<{
  via: "wagmi" | "eip1193" | "walletconnect";
  api: WalletInterFaceAPI | null;
}> {
  const { wagmi, touchAddress = true } = opts ?? {};

  // Handle WalletConnect specially
  if (dw.meta.id === "walletconnect" || dw.via === "walletconnect") {
    // First try wagmi if available (host may have WC configured in wagmi)
    if (wagmi) {
      const conn = pickWagmiConnector(
        wagmi,
        dw.meta.name,
        dw.meta.id,
        dw.meta.category
      );
      if (conn) {
        await wagmi.connect(conn);
        return { via: "wagmi", api: null };
      }
    }

    // Use our native WalletConnect integration (built-in, always available)
    // const api = await connectWalletConnect();
    // if (api) {
    //   if (touchAddress) await api.getAddress();
    //   return { via: "walletconnect", api };
    // }

    throw new Error("WalletConnect connection failed. Please try again.");
  }

  if (dw.via === "solana-window" || dw.meta.ecosystem === "solana") {
    const api = toWalletInterfaceFromDetected(dw);
    if (touchAddress) await api.getAddress();
    return { via: "eip1193", api };
  }

  if (wagmi) {
    const conn = pickWagmiConnector(
      wagmi,
      dw.meta.name,
      dw.meta.id,
      dw.meta.category
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
