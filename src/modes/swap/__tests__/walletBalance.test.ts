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

  // Case is meaningless in a hex EVM address but significant in a Base58 SPL
  // mint: these two differ only by case and are different mints. Folding case
  // would let the first row answer for the second.
  describe("solana addresses", () => {
    const MINT_A = "So11111111111111111111111111111111111111112";
    const MINT_B = "so11111111111111111111111111111111111111112";

    const SOL_ROWS = [
      {
        address: MINT_A,
        chainId: "solana",
        symbol: "WSOL",
        decimals: 9,
        balance: "111",
      },
      {
        address: MINT_B,
        chainId: "solana",
        symbol: "OTHER",
        decimals: 6,
        balance: "222",
      },
    ] as unknown as YourTokenData[];

    it("keeps Base58 case, matching each mint to its own row", () => {
      const a = findWalletBalanceRow(
        SOL_ROWS,
        { address: MINT_A },
        "solana",
        "solana"
      );
      assert.equal(a?.symbol, "WSOL");
      assert.equal(a?.balance, "111");
      assert.equal(a?.decimals, 9);

      const b = findWalletBalanceRow(
        SOL_ROWS,
        { address: MINT_B },
        "solana",
        "solana"
      );
      assert.equal(b?.symbol, "OTHER");
      assert.equal(b?.balance, "222");
      assert.equal(b?.decimals, 6);
    });

    // A caller that can't supply a chain type must not silently fall back to
    // case-folding: the address format already says whether case matters.
    it("keeps Base58 case even when no chain type is supplied", () => {
      assert.equal(
        findWalletBalanceRow(SOL_ROWS, { address: MINT_A }, "solana")?.symbol,
        "WSOL"
      );
      assert.equal(
        findWalletBalanceRow(SOL_ROWS, { address: MINT_B }, "solana")?.symbol,
        "OTHER"
      );
    });

    it("still folds hex case when no chain type is supplied", () => {
      assert.equal(
        findWalletBalanceRow(
          ROWS,
          { address: "0xDDDD73F5DF1F0DC31373357BEAC77545DC5A6F3F" },
          "98866"
        )?.balance,
        "500000"
      );
    });

    it("still folds case for EVM, where the checksum is display-only", () => {
      const checksummed = "0xDDDD73F5DF1F0DC31373357BEAC77545DC5A6F3F";
      const row = findWalletBalanceRow(
        ROWS,
        { address: checksummed },
        "98866",
        "evm"
      );
      assert.equal(row?.balance, "500000");
    });
  });
});
