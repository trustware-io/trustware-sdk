import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { knownTokenBalance } from "src/widget/features/amount/hooks/useDepositAmountModel";
import type { Token } from "src/widget/state/deposit/types";

const USDC: Token = {
  address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  chainId: "solana-mainnet-beta",
  usdPrice: 1,
};

describe("knownTokenBalance", () => {
  it("reads a raw balance in whole tokens", () => {
    assert.equal(knownTokenBalance({ ...USDC, balance: "2472000" }), 2.472);
    assert.equal(knownTokenBalance({ ...USDC, balance: "1" }), 0.000001);
  });

  it("reads an empty wallet's balance as 0", () => {
    assert.equal(knownTokenBalance({ ...USDC, balance: "0" }), 0);
  });

  // A catalog pick whose balance fetch failed carries no balance. Reading it
  // as 0 refused every amount with "Balance: 0 USDC".
  it("is null when the balance is unknown", () => {
    assert.equal(knownTokenBalance(USDC), null);
    assert.equal(knownTokenBalance(null), null);
  });

  it("is finite for any raw balance up to a u64 at any decimals", () => {
    for (let decimals = 0; decimals <= 30; decimals++) {
      for (const balance of ["0", "1", "18446744073709551615"]) {
        const value = knownTokenBalance({ ...USDC, decimals, balance });
        assert.ok(
          typeof value === "number" && Number.isFinite(value) && value >= 0,
          `${balance} at ${decimals} decimals gave ${value}`
        );
      }
    }
  });
});
