import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { onlyAllowedTokens, withoutToken } from "src/modes/swap/tokenFilters";
import { EVM_ZERO_ADDRESS, NATIVE_EVM, NATIVE_SOLANA } from "src/utils/chains";

const SOLANA = "solana-mainnet-beta";
const BASE = "8453";

const SOL = { chainId: SOLANA, address: NATIVE_SOLANA, symbol: "SOL" };
const WSOL = {
  chainId: SOLANA,
  address: "So11111111111111111111111111111111111111112",
  symbol: "WSOL",
};
const USDC_SOLANA = {
  chainId: SOLANA,
  address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
};
const ETH_BASE = { chainId: BASE, address: NATIVE_EVM, symbol: "ETH" };
const USDC_BASE = {
  chainId: BASE,
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  symbol: "USDC",
};

const SOLANA_LIST = [SOL, WSOL, USDC_SOLANA];
const BASE_LIST = [ETH_BASE, USDC_BASE];

describe("withoutToken", () => {
  // The recording behind this: Buy held native SOL, and the Sell picker on
  // Solana still offered a second SOL row because it only compared raw
  // lowercased addresses.
  it("hides native SOL from Sell when Buy holds it, whichever spelling", () => {
    for (const address of [NATIVE_SOLANA, NATIVE_EVM, EVM_ZERO_ADDRESS]) {
      assert.deepEqual(
        withoutToken(SOLANA_LIST, { chainId: SOLANA, address }, "solana"),
        [WSOL, USDC_SOLANA],
        address
      );
    }
  });

  it("hides the counterpart when the list carries the sentinel spelling", () => {
    const sentinelSol = { ...SOL, address: NATIVE_EVM };
    assert.deepEqual(withoutToken([sentinelSol, WSOL], SOL, "solana"), [WSOL]);
  });

  it("hides an SPL token only in its exact case", () => {
    assert.deepEqual(withoutToken(SOLANA_LIST, USDC_SOLANA, "solana"), [
      SOL,
      WSOL,
    ]);
    assert.deepEqual(
      withoutToken(
        SOLANA_LIST,
        { ...USDC_SOLANA, address: USDC_SOLANA.address.toLowerCase() },
        "solana"
      ),
      SOLANA_LIST
    );
  });

  it("hides an EVM token in any case", () => {
    assert.deepEqual(
      withoutToken(
        BASE_LIST,
        {
          chainId: 8453,
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
        "evm"
      ),
      [ETH_BASE]
    );
  });

  it("hides EVM native whether it's given as the sentinel or zero address", () => {
    assert.deepEqual(
      withoutToken(
        BASE_LIST,
        { chainId: BASE, address: EVM_ZERO_ADDRESS },
        "evm"
      ),
      [USDC_BASE]
    );
  });

  it("keeps everything when the counterpart is on another chain", () => {
    assert.deepEqual(
      withoutToken(SOLANA_LIST, ETH_BASE, "solana"),
      SOLANA_LIST
    );
    assert.deepEqual(
      withoutToken(BASE_LIST, { ...USDC_BASE, chainId: "1" }, "evm"),
      BASE_LIST
    );
  });

  it("keeps everything when the other side holds nothing", () => {
    assert.deepEqual(withoutToken(SOLANA_LIST, null, "solana"), SOLANA_LIST);
  });
});

describe("onlyAllowedTokens", () => {
  it("keeps exactly the allowlisted tokens", () => {
    assert.deepEqual(
      onlyAllowedTokens(
        BASE_LIST,
        [
          {
            chainId: 8453,
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          },
        ],
        "evm"
      ),
      [USDC_BASE]
    );
  });

  it("matches an allowlisted native token by any spelling", () => {
    assert.deepEqual(
      onlyAllowedTokens(
        BASE_LIST,
        [{ chainId: 8453, address: EVM_ZERO_ADDRESS }],
        "evm"
      ),
      [ETH_BASE]
    );
  });

  it("drops an allowlisted address that's on another chain", () => {
    assert.deepEqual(
      onlyAllowedTokens(
        BASE_LIST,
        [{ chainId: 1, address: USDC_BASE.address }],
        "evm"
      ),
      []
    );
  });

  it("keeps everything without an allowlist", () => {
    assert.deepEqual(onlyAllowedTokens(BASE_LIST, undefined, "evm"), BASE_LIST);
    assert.deepEqual(onlyAllowedTokens(BASE_LIST, [], "evm"), BASE_LIST);
  });
});
