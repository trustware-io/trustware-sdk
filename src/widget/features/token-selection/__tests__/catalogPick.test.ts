import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { BalanceRow, ChainDef } from "src/types";
import type { Token } from "src/widget/state/deposit/types";
import {
  catalogPick,
  type CatalogPickBalance,
} from "src/widget/features/token-selection/hooks/useSelectTokenModel";

const SOLANA = {
  chainId: "solana-mainnet-beta",
  chainType: "solana",
} as ChainDef;
const WALLET = "6pWgr6Y4RJ57BDUcRnrhyAUFs2jYiwx864SLoxpju5Ys";
const ANSEM: Token = {
  address: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
  symbol: "ANSEM",
  name: "ANSEM",
  decimals: 6,
  chainId: "solana-mainnet-beta",
  usdPrice: 0.0004,
};

function fetcher(result: BalanceRow[] | Error) {
  const calls: [string | number, string][] = [];
  const fetchBalances = async (chain: string | number, address: string) => {
    calls.push([chain, address]);
    if (result instanceof Error) throw result;
    return result;
  };
  return { calls, fetchBalances };
}

function deposit() {
  const failures: [ChainDef, string][] = [];
  const pickBalance: CatalogPickBalance = {
    fetch: true,
    onFetchFailed: (chain, message) => failures.push([chain, message]),
  };
  return { failures, pickBalance };
}

const ansemRow = { contract: ANSEM.address, balance: "2472" } as BalanceRow;

describe("catalogPick", () => {
  it("selects the token as is in swap mode, without a balance call", async () => {
    const { calls, fetchBalances } = fetcher([ansemRow]);
    const picked = await catalogPick(ANSEM, {
      chain: SOLANA,
      walletAddress: WALLET,
      pickBalance: { fetch: false },
      fetchBalances,
    });
    assert.equal(picked, ANSEM);
    assert.deepEqual(calls, []);
  });

  it("keeps a balance the token already carries", async () => {
    const { calls, fetchBalances } = fetcher([ansemRow]);
    const withBalance = { ...ANSEM, balance: "10" };
    const picked = await catalogPick(withBalance, {
      chain: SOLANA,
      walletAddress: WALLET,
      pickBalance: deposit().pickBalance,
      fetchBalances,
    });
    assert.equal(picked, withBalance);
    assert.deepEqual(calls, []);
  });

  it("attaches the fetched balance in deposit mode", async () => {
    const { calls, fetchBalances } = fetcher([ansemRow]);
    const picked = await catalogPick(ANSEM, {
      chain: SOLANA,
      walletAddress: WALLET,
      pickBalance: deposit().pickBalance,
      fetchBalances,
    });
    assert.deepEqual(picked, { ...ANSEM, balance: "2472", chainData: SOLANA });
    assert.deepEqual(calls, [["solana-mainnet-beta", WALLET]]);
  });

  it("reads a token the wallet doesn't hold as 0", async () => {
    const { fetchBalances } = fetcher([]);
    const picked = await catalogPick(ANSEM, {
      chain: SOLANA,
      walletAddress: WALLET,
      pickBalance: deposit().pickBalance,
      fetchBalances,
    });
    assert.deepEqual(picked, { ...ANSEM, balance: "0", chainData: SOLANA });
  });

  // The pick used to await the fetch with nothing catching it: the picker
  // stayed open and nothing said why. The token still needs its chain: the
  // amount screen renders nothing for a token without chainData.
  it("still selects the token when the balance call fails, and reports why", async () => {
    const { fetchBalances } = fetcher(new Error("balances: HTTP 400"));
    const { failures, pickBalance } = deposit();
    const picked = await catalogPick(ANSEM, {
      chain: SOLANA,
      walletAddress: WALLET,
      pickBalance,
      fetchBalances,
    });
    assert.deepEqual(picked, { ...ANSEM, chainData: SOLANA });
    assert.equal(picked.balance, undefined);
    assert.deepEqual(failures, [[SOLANA, "balances: HTTP 400"]]);
  });

  it("gives a 0 balance without a wallet", async () => {
    const { calls, fetchBalances } = fetcher([ansemRow]);
    const picked = await catalogPick(ANSEM, {
      chain: SOLANA,
      walletAddress: null,
      pickBalance: deposit().pickBalance,
      fetchBalances,
    });
    assert.deepEqual(picked, { ...ANSEM, balance: "0", chainData: SOLANA });
    assert.deepEqual(calls, []);
  });

  it("refuses a pick with no chain selected, wallet or not", async () => {
    const { calls, fetchBalances } = fetcher([]);
    for (const walletAddress of [WALLET, null]) {
      await assert.rejects(
        catalogPick(ANSEM, {
          chain: null,
          walletAddress,
          pickBalance: deposit().pickBalance,
          fetchBalances,
        }),
        { message: `Picked ANSEM (${ANSEM.address}) with no chain selected` },
        String(walletAddress)
      );
    }
    assert.deepEqual(calls, []);
  });
});
