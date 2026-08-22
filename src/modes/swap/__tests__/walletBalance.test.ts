import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { YourTokenData } from "src/widget/state/deposit/types";
import { findWalletBalanceRow } from "src/modes/swap/walletBalance";

const PUSD = "0xdddd73f5df1f0dc31373357beac77545dc5a6f3f";

// Shape useWalletTokenState produces for the live Plume wallet.
const ROWS = [
  {
    address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    chainId: "98866",
    symbol: "PLUME",
    decimals: 18,
    balance: "937019588321046486",
  },
  {
    address: PUSD,
    chainId: "98866",
    symbol: "pUSD",
    decimals: 6,
    balance: "500000",
  },
] as unknown as YourTokenData[];

describe("findWalletBalanceRow", () => {
  // The bug: the catalog list hands back a plain Token with no `balance`, so
  // the Sell panel read 0 while the row above it showed 0.5 pUSD.
  it("finds the balance for a token selected without one", () => {
    const catalogToken = { address: PUSD, symbol: "pUSD", decimals: 6 };
    const row = findWalletBalanceRow(ROWS, catalogToken, "98866");
    assert.equal(row?.balance, "500000");
  });

  it("matches case-insensitively on address", () => {
    const row = findWalletBalanceRow(
      ROWS,
      { address: PUSD.toUpperCase().replace("0X", "0x") },
      "98866"
    );
    assert.equal(row?.symbol, "pUSD");
  });

  it("accepts a numeric chain id", () => {
    assert.equal(
      findWalletBalanceRow(ROWS, { address: PUSD }, 98866)?.balance,
      "500000"
    );
  });

  // The same ERC20 address is routinely deployed to several chains, so a
  // chain-qualified match must not cross chains.
  it("does not match the same address on a different chain", () => {
    assert.equal(findWalletBalanceRow(ROWS, { address: PUSD }, "1"), undefined);
  });

  it("matches on address alone when no chain is known", () => {
    assert.equal(
      findWalletBalanceRow(ROWS, { address: PUSD })?.balance,
      "500000"
    );
  });

  it("returns undefined for a token the wallet does not hold", () => {
    assert.equal(
      findWalletBalanceRow(ROWS, { address: "0x" + "11".repeat(20) }, "98866"),
      undefined
    );
  });

  it("tolerates missing inputs", () => {
    assert.equal(findWalletBalanceRow(ROWS, null, "98866"), undefined);
    assert.equal(findWalletBalanceRow(ROWS, {}, "98866"), undefined);
    assert.equal(findWalletBalanceRow(undefined, { address: PUSD }), undefined);
    assert.equal(findWalletBalanceRow([], { address: PUSD }), undefined);
  });
});
