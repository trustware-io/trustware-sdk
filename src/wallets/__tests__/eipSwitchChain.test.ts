import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { EIP1193 } from "src/types/";
import { useEIP1193 } from "src/wallets/eipWallets";
import { registerChainParams } from "src/wallets/chainParams";

const PLUME = 98866;

type Call = { method: string; params?: unknown };

/** Provider double recording every RPC call, with per-method behaviour. */
function makeProvider(handlers: Record<string, () => unknown>) {
  const calls: Call[] = [];
  const eth = {
    request: async (args: { method: string; params?: unknown }) => {
      calls.push({ method: args.method, params: args.params });
      const h = handlers[args.method];
      if (h) return h();
      return undefined;
    },
  } as unknown as EIP1193;
  return { eth, calls };
}

function rpcError(code: number, message: string) {
  return Object.assign(new Error(message), { code });
}

describe("useEIP1193.switchChain", () => {
  // The regression: swallowing 4001 here left ensureWalletOnChain unable to
  // tell a rejection from any other failed switch, so the user saw "wrong
  // network" instead of "cancelled" — and, before the post-switch check
  // existed, the flow carried on and signed on the old chain.
  it("rethrows a user rejection instead of swallowing it", async () => {
    const { eth } = makeProvider({
      wallet_switchEthereumChain: () => {
        throw rpcError(4001, "User rejected the request");
      },
    });
    await assert.rejects(
      () => useEIP1193(eth).switchChain(PLUME),
      (e: unknown) => (e as { code?: number }).code === 4001
    );
  });

  it("rethrows any other provider error", async () => {
    const { eth } = makeProvider({
      wallet_switchEthereumChain: () => {
        throw rpcError(-32603, "Internal error");
      },
    });
    await assert.rejects(
      () => useEIP1193(eth).switchChain(PLUME),
      /Internal error/
    );
  });

  // 4902 = wallet doesn't know the chain. With params registered from the
  // catalog it adds and then switches, which is what makes Plume reachable.
  it("adds then switches on 4902 when params are registered", async () => {
    registerChainParams(PLUME, {
      chainIdHex: "0x18232",
      chainName: "Plume",
      rpcUrls: ["https://rpc.plume.org"],
      nativeCurrency: { name: "PLUME", symbol: "PLUME", decimals: 18 },
    });

    let firstSwitch = true;
    const { eth, calls } = makeProvider({
      wallet_switchEthereumChain: () => {
        if (firstSwitch) {
          firstSwitch = false;
          throw rpcError(4902, "Unrecognized chain ID");
        }
        return null;
      },
      wallet_addEthereumChain: () => null,
    });

    await useEIP1193(eth).switchChain(PLUME);
    assert.deepEqual(
      calls.map((c) => c.method),
      [
        "wallet_switchEthereumChain",
        "wallet_addEthereumChain",
        "wallet_switchEthereumChain",
      ]
    );
  });

  it("surfaces 4902 as an error when no params exist for the chain", async () => {
    const { eth } = makeProvider({
      wallet_switchEthereumChain: () => {
        throw rpcError(4902, "Unrecognized chain ID");
      },
    });
    await assert.rejects(
      () => useEIP1193(eth).switchChain(999_999_331),
      /no params to add/
    );
  });
});
