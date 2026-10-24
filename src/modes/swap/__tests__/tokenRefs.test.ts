import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChainDef } from "src/types";
import type { SwapTokenRef } from "src/types/config";
import {
  chainForRef,
  chainsWithRefs,
  refIsOnChain,
  refsOnChain,
} from "src/modes/swap/tokenRefs";
import { NATIVE_EVM, NATIVE_SOLANA } from "src/utils/chains";

const BASE = { chainId: "8453", chainType: "evm" } as ChainDef;
const ETHEREUM = { chainId: 1, chainType: "evm" } as ChainDef;
const SOLANA = {
  chainId: "solana-mainnet-beta",
  chainType: "solana",
} as ChainDef;
const CHAINS = [ETHEREUM, BASE, SOLANA];

const USDC_BASE: SwapTokenRef = {
  chainId: 8453,
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};
const SOL: SwapTokenRef = {
  chainId: "solana-mainnet-beta",
  address: NATIVE_SOLANA,
};
const ETH: SwapTokenRef = { chainId: 1, address: NATIVE_EVM };

describe("refIsOnChain", () => {
  it("matches an EVM chain by its number or its string", () => {
    assert.equal(refIsOnChain({ ...USDC_BASE, chainId: 8453 }, BASE), true);
    assert.equal(refIsOnChain({ ...USDC_BASE, chainId: "8453" }, BASE), true);
    assert.equal(refIsOnChain(ETH, ETHEREUM), true);
  });

  it("matches Solana by the catalog's string id", () => {
    assert.equal(refIsOnChain(SOL, SOLANA), true);
  });

  // The catalog lists Solana as "solana-mainnet-beta"; the routing backend's
  // numeric id for it is not a catalog id, so it names no chain here.
  it("does not match Solana by the numeric routing id", () => {
    assert.equal(
      refIsOnChain({ ...SOL, chainId: 1151111081099710 }, SOLANA),
      false
    );
  });

  it("never matches a different chain", () => {
    assert.equal(refIsOnChain(USDC_BASE, ETHEREUM), false);
    assert.equal(refIsOnChain(SOL, BASE), false);
  });
});

describe("chainForRef", () => {
  it("finds the chain a ref names", () => {
    assert.equal(chainForRef(CHAINS, USDC_BASE), BASE);
    assert.equal(chainForRef(CHAINS, SOL), SOLANA);
  });

  it("returns undefined for a chain that isn't loaded", () => {
    assert.equal(chainForRef(CHAINS, { ...ETH, chainId: 10 }), undefined);
  });
});

describe("refsOnChain", () => {
  it("keeps the refs on that chain", () => {
    assert.deepEqual(refsOnChain([USDC_BASE, SOL, ETH], SOLANA), [SOL]);
    assert.deepEqual(refsOnChain([USDC_BASE, SOL, ETH], BASE), [USDC_BASE]);
  });
});

describe("chainsWithRefs", () => {
  it("keeps the referenced chains in their original order", () => {
    assert.deepEqual(chainsWithRefs(CHAINS, [SOL, USDC_BASE]), [BASE, SOLANA]);
  });

  it("is empty when no ref names a loaded chain", () => {
    assert.deepEqual(chainsWithRefs(CHAINS, [{ ...ETH, chainId: 10 }]), []);
  });
});
