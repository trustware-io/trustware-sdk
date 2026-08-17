import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { sendRouteTransaction } from "src/core/tx";
import { walletManager } from "src/wallets/";
import { TrustwareConfigStore } from "src/config/store";
import type { BuildRouteResult, WalletInterFaceAPI } from "src/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const SPENDER = "0x09aea4b2242abc8bb4bb78d537a67a245a7bec64";
const ROUTER = "0x3333333333333333333333333333333333333333";
const MAIN_TX_DATA = "0xdeadbeef";

type SentTx = { to: string; data: string };

/**
 * A minimal eip1193 EVM wallet that records every transaction it is asked
 * to send and returns a fake hash.
 */
function makeFakeWallet(sent: SentTx[]): WalletInterFaceAPI {
  return {
    ecosystem: "evm",
    type: "eip1193",
    getAddress: async () => OWNER,
    getChainId: async () => 8453,
    switchChain: async () => {},
    request: async (args: { method: string; params?: unknown[] }) => {
      if (args.method === "eth_sendTransaction") {
        const tx = (args.params as Record<string, string>[])[0];
        sent.push({ to: tx.to, data: tx.data });
        return `0x${String(sent.length).padStart(64, "0")}`;
      }
      throw new Error(`Unexpected wallet request: ${args.method}`);
    },
  } as unknown as WalletInterFaceAPI;
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Serve the SDK RPC endpoints ensureApprovals touches. Reports a zero
 * allowance, so any allowance check that runs leads straight to an
 * approve prompt — exactly the stale-read shape from BVT-330.
 */
function stubFetch(calls: { allowanceChecks: number }) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes("/v1/sdk/rpc/evm/allowance")) {
      calls.allowanceChecks += 1;
      return jsonResponse({ success: true, data: { allowance: "0" } });
    }
    if (url.includes("/v1/sdk/rpc/evm/tx-status")) {
      return jsonResponse({ success: true, data: { status: "success" } });
    }
    return jsonResponse({ success: true, data: {} });
  };
}

function makeBuild(): BuildRouteResult {
  return {
    intentId: "intent-bvt-330",
    txReq: { to: ROUTER, data: MAIN_TX_DATA, value: "0", chainId: "8453" },
    actions: [],
    finalExchangeRate: {},
    route: {
      estimate: { fromAmount: "1000302", toAmount: "1000000" },
      execution: {
        approvals: [
          {
            chainId: "8453",
            tokenAddress: TOKEN,
            spender: SPENDER,
            amount: "1000302",
          },
        ],
      },
    },
  } as BuildRouteResult;
}

describe("sendRouteTransaction approvals ownership (BVT-330)", () => {
  const realFetch = globalThis.fetch;
  let sent: SentTx[];
  let calls: { allowanceChecks: number };

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    sent = [];
    calls = { allowanceChecks: 0 };
    globalThis.fetch = stubFetch(calls) as typeof fetch;
    walletManager.attachWallet(makeFakeWallet(sent));
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // The double-prompt bug: a caller (the swap hook) that has already run the
  // plan's approval flow calls sendRouteTransaction, whose own ensureApprovals
  // re-reads the allowance — and a stale read right after the approve
  // confirms makes it prompt for the same approval again. The caller must be
  // able to declare approvals handled so only one path ever owns them.
  it("skips its own approval pass when the caller declares approvals ensured", async () => {
    const hash = await sendRouteTransaction(makeBuild(), 8453, {
      approvalsEnsured: true,
    });

    assert.equal(hash.length, 66);
    assert.equal(
      calls.allowanceChecks,
      0,
      "must not re-read the allowance the caller just verified"
    );
    assert.equal(sent.length, 1, "only the main transaction may be sent");
    assert.equal(sent[0].to, ROUTER);
    assert.equal(sent[0].data, MAIN_TX_DATA);
  });

  // Callers that never ran an approval flow (deposit widget, runTopUp,
  // direct API users) still rely on sendRouteTransaction to grant the
  // plan's allowances itself.
  it("still ensures approvals itself when the caller gives no signal", async () => {
    const hash = await sendRouteTransaction(makeBuild(), 8453);

    assert.equal(hash.length, 66);
    assert.equal(calls.allowanceChecks, 1);
    assert.equal(sent.length, 2, "approve then main transaction");
    assert.equal(sent[0].to, TOKEN, "first tx is the ERC20 approve");
    assert.equal(sent[1].to, ROUTER);
    assert.equal(sent[1].data, MAIN_TX_DATA);
  });
});
