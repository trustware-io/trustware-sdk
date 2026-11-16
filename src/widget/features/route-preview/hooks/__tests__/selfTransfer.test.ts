import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isSameChainSelfTransfer } from "../selfTransfer";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "11111111111111111111111111111111";

describe("isSameChainSelfTransfer", () => {
  it("flags the same token on the same chain, for every kind of chain id", () => {
    const cases: Array<[string | number, string | number, string, string]> = [
      [8453, 8453, USDC_BASE, "evm"],
      ["8453", 8453, USDC_BASE, "evm"],
      [" 8453 ", "8453", USDC_BASE, "evm"],
      ["solana-mainnet-beta", "solana-mainnet-beta", SOL, "solana"],
      ["Solana-Mainnet-Beta", "solana-mainnet-beta", USDC_SOLANA, "solana"],
    ];
    for (const [fromChain, toChain, token, chainType] of cases) {
      assert.equal(
        isSameChainSelfTransfer(
          { chainId: fromChain, token },
          { chainId: toChain, token },
          chainType
        ),
        true,
        `${fromChain} -> ${toChain} ${token}`
      );
    }
  });

  it("matches an EVM token address whatever its case", () => {
    assert.equal(
      isSameChainSelfTransfer(
        { chainId: 8453, token: USDC_BASE },
        { chainId: "8453", token: USDC_BASE.toLowerCase() },
        "evm"
      ),
      true
    );
  });

  it("keeps Solana mints that differ only in case apart", () => {
    // Base58 is case-sensitive: these are two different mints.
    assert.equal(
      isSameChainSelfTransfer(
        { chainId: "solana-mainnet-beta", token: USDC_SOLANA },
        { chainId: "solana-mainnet-beta", token: USDC_SOLANA.toLowerCase() },
        "solana"
      ),
      false
    );
  });

  it("lets a different chain or a different token through", () => {
    const cases: Array<
      [string | number, string, string | number, string, string]
    > = [
      [8453, USDC_BASE, 42161, USDC_BASE, "evm"],
      ["solana-mainnet-beta", SOL, 8453, SOL, "solana"],
      [
        "solana-mainnet-beta",
        SOL,
        "solana-mainnet-beta",
        USDC_SOLANA,
        "solana",
      ],
      [
        8453,
        USDC_BASE,
        8453,
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "evm",
      ],
    ];
    for (const [fromChain, fromToken, toChain, toToken, chainType] of cases) {
      assert.equal(
        isSameChainSelfTransfer(
          { chainId: fromChain, token: fromToken },
          { chainId: toChain, token: toToken },
          chainType
        ),
        false,
        `${fromChain} ${fromToken} -> ${toChain} ${toToken}`
      );
    }
  });
});
