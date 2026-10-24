import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runTopUp } from "src/core/tx";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import type { WalletInterFaceAPI } from "src/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const ROUTER = "0x3333333333333333333333333333333333333333";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const HASH = `0x${"a".repeat(64)}`;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// runTopUp no longer posts its own receipt: the send step delivers it the
// moment the wallet returns the hash, and runTopUp waits for that before
// polling.
describe("runTopUp receipt", () => {
  const realFetch = globalThis.fetch;
  let order: string[];

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    order = [];
    walletManager.attachWallet({
      ecosystem: "evm",
      type: "eip1193",
      getAddress: async () => OWNER,
      getChainId: async () => 8453,
      switchChain: async () => {},
      request: async (args: { method: string }) => {
        assert.equal(args.method, "eth_sendTransaction");
        order.push("sign");
        return HASH;
      },
    } as unknown as WalletInterFaceAPI);
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const url = String(input);
      if (
        url.endsWith("/v1/routes/chains") ||
        url.endsWith("/v1/routes/tokens")
      ) {
        return json({ data: [] });
      }
      if (url.endsWith("/v1/routes/route")) {
        order.push("build");
        return json({
          data: {
            intentId: "intent-topup",
            route: {
              estimate: { toAmountUsd: "1.00", totalFeesUsd: "0.01" },
              execution: {
                transaction: {
                  to: ROUTER,
                  data: "0xdead",
                  value: "0",
                  chainId: "8453",
                },
              },
            },
          },
        });
      }
      if (url.endsWith("/v1/route-intent/intent-topup/receipt")) {
        order.push(`receipt:${JSON.parse(String(init?.body)).txHash}`);
        return json({ data: { ok: true } });
      }
      if (url.endsWith("/v1/route-intent/intent-topup/status")) {
        order.push("status");
        return json({
          data: {
            intent_id: "intent-topup",
            status: "success",
            source_tx_hash: HASH,
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("posts exactly one receipt, at acceptance, before polling", async () => {
    const tx = await runTopUp({
      fromChain: "8453",
      toChain: "8453",
      fromToken: USDC_BASE,
      toToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      toAddress: OWNER,
      fromAmount: "1000000",
    });
    assert.equal(tx.status, "success");
    assert.deepEqual(order, ["build", "sign", `receipt:${HASH}`, "status"]);
  });
});
