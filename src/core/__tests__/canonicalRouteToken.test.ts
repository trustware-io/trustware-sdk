import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  canonicalRouteToken,
  SOLANA_NATIVE_ROUTE_TOKEN,
} from "src/core/routes";

const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NATIVE_EVM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const NATIVE_SOLANA_ALIAS = "So11111111111111111111111111111111111111111";

describe("canonicalRouteToken", () => {
  // The token list returns native SOL as the EVM sentinel. Sent verbatim, LiFi
  // routes through an aggregator whose transaction fails on-chain with
  // InstructionError[5, UnbalancedInstruction].
  it("maps every native-SOL spelling to the wrapped-SOL mint", () => {
    for (const chain of ["solana", "solana-mainnet-beta", "1151111081099710"]) {
      assert.equal(
        canonicalRouteToken(NATIVE_EVM, chain),
        SOLANA_NATIVE_ROUTE_TOKEN
      );
      assert.equal(
        canonicalRouteToken(NATIVE_EVM.toUpperCase(), chain),
        SOLANA_NATIVE_ROUTE_TOKEN
      );
      assert.equal(
        canonicalRouteToken(NATIVE_SOLANA_ALIAS, chain),
        SOLANA_NATIVE_ROUTE_TOKEN
      );
      assert.equal(
        canonicalRouteToken(
          "0x0000000000000000000000000000000000000000",
          chain
        ),
        SOLANA_NATIVE_ROUTE_TOKEN
      );
    }
  });

  it("leaves the mint alone when it is already canonical", () => {
    assert.equal(
      canonicalRouteToken(SOLANA_NATIVE_ROUTE_TOKEN, "solana"),
      SOLANA_NATIVE_ROUTE_TOKEN
    );
  });

  it("passes SPL mints through untouched", () => {
    assert.equal(canonicalRouteToken(USDC_SOLANA, "solana"), USDC_SOLANA);
  });

  it("trims stray whitespace on a Solana token", () => {
    assert.equal(
      canonicalRouteToken(` ${USDC_SOLANA} `, "solana"),
      USDC_SOLANA
    );
  });

  // On EVM the sentinel is exactly right — rewriting it would break every
  // native-asset route.
  it("never rewrites a non-Solana token", () => {
    assert.equal(canonicalRouteToken(NATIVE_EVM, "8453"), NATIVE_EVM);
    assert.equal(canonicalRouteToken(NATIVE_EVM, "evm"), NATIVE_EVM);
    assert.equal(canonicalRouteToken(USDC_BASE, "1"), USDC_BASE);
    assert.equal(canonicalRouteToken("usei", "cosmos"), "usei");
  });

  it("defaults a missing Solana token to the mint, and stays empty elsewhere", () => {
    assert.equal(
      canonicalRouteToken(undefined, "solana"),
      SOLANA_NATIVE_ROUTE_TOKEN
    );
    assert.equal(canonicalRouteToken(undefined, "8453"), "");
  });
});
