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
const WSOL_MINT = "So11111111111111111111111111111111111111112";

describe("canonicalRouteToken", () => {
  // The token list returns native SOL as the EVM sentinel. The wSOL mint is a
  // distinct SPL token the caller may not hold — sending it for a native-SOL
  // swap routes against a balance that doesn't exist. The backend translates
  // the sentinel into each provider's own native-SOL spelling for a Solana
  // leg (LiFi/Relay: the System Program id; Squid: the sentinel itself).
  it("maps every native-SOL spelling to the EVM sentinel", () => {
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

  // A number reaches normalizeChainType as a would-be ChainDef, whose .type
  // and .chainId are undefined — so without an explicit conversion the whole
  // mapping silently no-ops for numeric callers.
  it("handles a numeric chain id", () => {
    assert.equal(
      canonicalRouteToken(NATIVE_EVM, 1151111081099710),
      SOLANA_NATIVE_ROUTE_TOKEN
    );
    assert.equal(canonicalRouteToken(NATIVE_EVM, 8453), NATIVE_EVM);
    assert.equal(
      canonicalRouteToken(USDC_SOLANA, 1151111081099710),
      USDC_SOLANA
    );
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

  // wSOL is a real, distinct SPL token (you only hold it once you've
  // wrapped) — it must never be conflated with native SOL on the wire.
  it("passes the wSOL mint through untouched, distinct from native SOL", () => {
    assert.equal(canonicalRouteToken(WSOL_MINT, "solana"), WSOL_MINT);
    assert.notEqual(WSOL_MINT, SOLANA_NATIVE_ROUTE_TOKEN);
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
