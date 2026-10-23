import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isAllowedToken, onlyAllowedTokens } from "src/modes/swap/tokenFilters";
import { EVM_ZERO_ADDRESS, NATIVE_EVM, NATIVE_SOLANA } from "src/utils/chains";

const SOLANA = "solana-mainnet-beta";
const BASE = "8453";

const SOL = { chainId: SOLANA, address: NATIVE_SOLANA, symbol: "SOL" };
const WSOL = {
  chainId: SOLANA,
  address: "So11111111111111111111111111111111111111112",
  symbol: "WSOL",
};
const ETH_BASE = { chainId: BASE, address: NATIVE_EVM, symbol: "ETH" };
const USDC_BASE = {
  chainId: BASE,
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  symbol: "USDC",
};

const BASE_LIST = [ETH_BASE, USDC_BASE];

describe("isAllowedToken", () => {
  const allowed = [{ chainId: SOLANA, address: NATIVE_EVM }, USDC_BASE];

  it("allows a listed token, natives by any spelling", () => {
    assert.equal(isAllowedToken(SOL, allowed, "solana"), true);
    assert.equal(isAllowedToken(USDC_BASE, allowed, "evm"), true);
  });

  it("refuses a token the list doesn't name", () => {
    assert.equal(isAllowedToken(WSOL, allowed, "solana"), false);
    assert.equal(isAllowedToken(ETH_BASE, allowed, "evm"), false);
  });

  it("allows every token without a list", () => {
    for (const none of [null, undefined, []]) {
      assert.equal(isAllowedToken(WSOL, none, "solana"), true);
    }
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
