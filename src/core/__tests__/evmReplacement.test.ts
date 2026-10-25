import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { watchForReplacement } from "src/core/evmReplacement";
import {
  sendRouteTransactionReporting,
  type AcceptedTransaction,
} from "src/core/tx";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import type { BuildRouteResult, EIP1193, WalletInterFaceAPI } from "src/types";
import {
  EVM_OWNER,
  json,
  minedReceipt,
  REVIEWED_ESTIMATE,
  ROUTER,
} from "./routeBackendStub";

const ORIGINAL = `0x${"1".repeat(64)}`;
const REPLACEMENT = `0x${"2".repeat(64)}`;
const ROUTE_DATA = "0xaabbccdd";
const FAST = { timeoutMs: 3_000, pollingIntervalMs: 5 };

type ChainTx = {
  hash: string;
  to: string;
  input: string;
  value: string;
  chainId: number;
};

function rpcTransaction(tx: ChainTx, mined: boolean) {
  return {
    hash: tx.hash,
    from: EVM_OWNER,
    to: tx.to,
    nonce: "0x7",
    value: tx.value,
    input: tx.input,
    gas: "0x5208",
    maxFeePerGas: "0x2",
    maxPriorityFeePerGas: "0x1",
    type: "0x2",
    chainId: `0x${tx.chainId.toString(16)}`,
    blockHash: mined ? `0x${"b".repeat(64)}` : null,
    blockNumber: mined ? "0x11" : null,
    transactionIndex: mined ? "0x0" : null,
  };
}

/**
 * One account's view of a chain through its wallet. `ORIGINAL` is sent at
 * block 0x10 and stays pending; at 0x11 either it is mined, or `replacement`
 * (same sender, same nonce) is mined in its place.
 */
function chainProvider(
  outcome: { mined: "original" } | { replacement: ChainTx }
) {
  const original: ChainTx = {
    hash: ORIGINAL,
    to: ROUTER,
    input: ROUTE_DATA,
    value: "0x0",
    chainId: 8453,
  };
  const minedTx = "replacement" in outcome ? outcome.replacement : original;
  const methods: string[] = [];
  const provider: EIP1193 = {
    async request({ method, params }) {
      methods.push(method);
      const args = (params ?? []) as unknown[];
      switch (method) {
        case "eth_blockNumber":
          return "0x11";
        case "eth_getTransactionByHash":
          if (args[0] === ORIGINAL) {
            return rpcTransaction(original, "mined" in outcome);
          }
          if (args[0] === minedTx.hash) return rpcTransaction(minedTx, true);
          return null;
        case "eth_getTransactionReceipt":
          return args[0] === minedTx.hash ? minedReceipt(minedTx.hash) : null;
        case "eth_getBlockByNumber":
          return {
            number: args[0],
            hash: `0x${"b".repeat(64)}`,
            parentHash: `0x${"a".repeat(64)}`,
            timestamp: "0x6700",
            gasLimit: "0x1c9c380",
            gasUsed: "0x5208",
            baseFeePerGas: "0x1",
            transactions:
              args[0] === "0x11" ? [rpcTransaction(minedTx, true)] : [],
          };
        default:
          throw new Error(`Unexpected provider request: ${method}`);
      }
    },
  };
  return { provider, methods };
}

const realWarn = console.warn;
let warnings: unknown[][];
beforeEach(() => {
  warnings = [];
  console.warn = (...args: unknown[]) => void warnings.push(args);
});
afterEach(() => {
  console.warn = realWarn;
});

describe("watchForReplacement", () => {
  it("reports a sped-up replacement's hash once it is mined", async () => {
    const { provider } = chainProvider({
      replacement: {
        hash: REPLACEMENT,
        to: ROUTER,
        input: ROUTE_DATA,
        value: "0x0",
        chainId: 8453,
      },
    });
    const reported: string[] = [];
    await watchForReplacement(
      provider,
      { hash: ORIGINAL, chainId: 8453 },
      (hash) => reported.push(hash),
      FAST
    );
    assert.deepEqual(reported, [REPLACEMENT]);
    assert.deepEqual(warnings, []);
  });

  it("reports a cancellation's hash too: it is the transaction that took the nonce", async () => {
    const { provider } = chainProvider({
      replacement: {
        hash: REPLACEMENT,
        to: EVM_OWNER,
        input: "0x",
        value: "0x0",
        chainId: 8453,
      },
    });
    const reported: string[] = [];
    await watchForReplacement(
      provider,
      { hash: ORIGINAL, chainId: 8453 },
      (hash) => reported.push(hash),
      FAST
    );
    assert.deepEqual(reported, [REPLACEMENT]);
  });

  it("reports nothing when the transaction itself is mined", async () => {
    const { provider, methods } = chainProvider({ mined: "original" });
    const reported: string[] = [];
    await watchForReplacement(
      provider,
      { hash: ORIGINAL, chainId: 8453 },
      (hash) => reported.push(hash),
      FAST
    );
    assert.deepEqual(reported, []);
    assert.deepEqual(methods, ["eth_blockNumber", "eth_getTransactionReceipt"]);
  });

  it("ignores a replacement on another chain, and says so", async () => {
    const { provider } = chainProvider({
      replacement: {
        hash: REPLACEMENT,
        to: ROUTER,
        input: ROUTE_DATA,
        value: "0x0",
        chainId: 10,
      },
    });
    const reported: string[] = [];
    await watchForReplacement(
      provider,
      { hash: ORIGINAL, chainId: 8453 },
      (hash) => reported.push(hash),
      FAST
    );
    assert.deepEqual(reported, []);
    assert.equal(warnings.length, 1);
    assert.equal(
      warnings[0][0],
      "[Trustware] ignored a replacement on another chain"
    );
    assert.deepEqual(warnings[0][1], {
      hash: ORIGINAL,
      replacement: REPLACEMENT,
      reason: "repriced",
      chainId: 8453,
      replacementChainId: 10,
    });
  });

  it("stops, logged and without rejecting, when the provider can't read blocks", async () => {
    const thrown = new Error("method not supported");
    const reported: string[] = [];
    await watchForReplacement(
      {
        request: async () => {
          throw thrown;
        },
      },
      { hash: ORIGINAL, chainId: 8453 },
      (hash) => reported.push(hash),
      FAST
    );
    assert.deepEqual(reported, []);
    assert.equal(warnings.length, 1);
    assert.equal(
      warnings[0][0],
      "[Trustware] stopped watching for a replacement"
    );
    const detail = warnings[0][1] as { hash: string; chainId: number };
    assert.equal(detail.hash, ORIGINAL);
    assert.equal(detail.chainId, 8453);
  });
});

describe("a replaced EVM send commits the replacement", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("commits the original hash at acceptance, then the replacement's", async () => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
    const { provider } = chainProvider({
      replacement: {
        hash: REPLACEMENT,
        to: ROUTER,
        input: ROUTE_DATA,
        value: "0x0",
        chainId: 8453,
      },
    });
    walletManager.attachWallet({
      ecosystem: "evm",
      type: "eip1193",
      getAddress: async () => EVM_OWNER,
      getChainId: async () => 8453,
      switchChain: async () => {},
      request: async (args: { method: string; params?: unknown[] }) =>
        args.method === "eth_sendTransaction"
          ? ORIGINAL
          : provider.request(args),
    } as unknown as WalletInterFaceAPI);
    const commits: { url: string; body: unknown; key: string }[] = [];
    let committed: () => void = () => {};
    const bothCommitted = new Promise<void>((resolve) => (committed = resolve));
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      commits.push({
        url,
        body: JSON.parse(String(init.body)),
        key: (init.headers as Record<string, string>)["Idempotency-Key"],
      });
      if (commits.length === 2) committed();
      return json(200, { data: { ok: true, transaction_id: "tx-1" } });
    }) as unknown as typeof fetch;
    const route: BuildRouteResult = {
      intentId: "intent-replaced",
      txReq: { to: ROUTER, data: ROUTE_DATA, value: "0", chainId: "8453" },
      actions: [],
      finalExchangeRate: {},
      route: { estimate: REVIEWED_ESTIMATE },
      expiresAt: new Date("2099-01-01T00:00:00Z"),
    };
    const accepted: AcceptedTransaction[] = [];

    const hash = await sendRouteTransactionReporting(
      route,
      8453,
      { approvalsEnsured: true },
      (a) => accepted.push(a),
      FAST
    );
    await bothCommitted;

    assert.equal(hash, ORIGINAL);
    assert.equal(accepted.length, 1);
    assert.deepEqual(accepted[0].receipt, {
      intentId: "intent-replaced",
      txHash: ORIGINAL,
    });
    assert.deepEqual(await accepted[0].receiptDelivery, { kind: "recorded" });
    const receiptUrl =
      "https://api.trustware.io/api/v1/route-intent/intent-replaced/receipt";
    assert.deepEqual(commits, [
      { url: receiptUrl, body: { txHash: ORIGINAL }, key: ORIGINAL },
      { url: receiptUrl, body: { txHash: REPLACEMENT }, key: REPLACEMENT },
    ]);
  });
});
