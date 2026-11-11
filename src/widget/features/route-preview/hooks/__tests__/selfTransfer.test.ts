import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isSameChainSelfTransfer } from "../selfTransfer";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "11111111111111111111111111111111";

describe("isSameChainSelfTransfer", () => {
  it("flags the same token on the same chain, for every kind of chain id", () => {
    const cases: Array<[string | number, string | number, string]> = [
      [8453, 8453, USDC_BASE],
      ["8453", 8453, USDC_BASE],
      [" 8453 ", "8453", USDC_BASE],
      ["solana-mainnet-beta", "solana-mainnet-beta", SOL],
      ["Solana-Mainnet-Beta", "solana-mainnet-beta", USDC_SOLANA],
    ];
    for (const [fromChain, toChain, token] of cases) {
      assert.equal(
        isSameChainSelfTransfer(
          { chainId: fromChain, token },
          { chainId: toChain, token }
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
        { chainId: "8453", token: USDC_BASE.toLowerCase() }
      ),
      true
    );
  });

  it("lets a different chain or a different token through", () => {
    const cases: Array<[string | number, string, string | number, string]> = [
      [8453, USDC_BASE, 42161, USDC_BASE],
      ["solana-mainnet-beta", SOL, 8453, SOL],
      ["solana-mainnet-beta", SOL, "solana-mainnet-beta", USDC_SOLANA],
      [8453, USDC_BASE, 8453, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"],
    ];
    for (const [fromChain, fromToken, toChain, toToken] of cases) {
      assert.equal(
        isSameChainSelfTransfer(
          { chainId: fromChain, token: fromToken },
          { chainId: toChain, token: toToken }
        ),
        false,
        `${fromChain} ${fromToken} -> ${toChain} ${toToken}`
      );
    }
  });
});
