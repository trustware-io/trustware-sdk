import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChainDef } from "src/types/";
import {
  chainParamsFor,
  chainParamsFromChainDef,
  registerChainParams,
} from "src/wallets/chainParams";

// Shape the backend actually returns for Plume on /v1/routes/chains.
const PLUME: ChainDef = {
  chainId: "98866",
  chainType: "evm",
  networkName: "Plume",
  networkIdentifier: "plume",
  nativeCurrency: { name: "PLUME", symbol: "PLUME", decimals: 18 },
  blockExplorerUrls: ["https://explorer.plume.org/"],
  rpc: "https://rpc.plume.org",
  rpcList: ["https://rpc.plume.org"],
} as ChainDef;

describe("chainParamsFromChainDef", () => {
  it("derives add-chain params from a catalog entry", () => {
    const p = chainParamsFromChainDef(PLUME);
    assert.ok(p);
    assert.equal(p.chainIdHex, "0x18232");
    assert.equal(p.chainName, "Plume");
    assert.deepEqual(p.rpcUrls, ["https://rpc.plume.org"]);
    assert.deepEqual(p.nativeCurrency, {
      name: "PLUME",
      symbol: "PLUME",
      decimals: 18,
    });
  });

  it("dedupes rpc and rpcList rather than listing the same URL twice", () => {
    const p = chainParamsFromChainDef(PLUME);
    assert.equal(p?.rpcUrls.length, 1);
  });

  // wallet_addEthereumChain requires at least one http(s) RPC. Returning
  // params without one would add a chain the wallet cannot use.
  it("returns undefined when no usable http rpc is present", () => {
    assert.equal(
      chainParamsFromChainDef({
        ...PLUME,
        rpc: undefined,
        rpcList: ["wss://rpc.plume.org"],
      } as ChainDef),
      undefined
    );
  });

  it("skips non-EVM chains", () => {
    assert.equal(
      chainParamsFromChainDef({ ...PLUME, chainType: "solana" } as ChainDef),
      undefined
    );
  });

  it("returns undefined without a native currency symbol", () => {
    assert.equal(
      chainParamsFromChainDef({
        ...PLUME,
        nativeCurrency: undefined,
      } as ChainDef),
      undefined
    );
  });

  it("defaults decimals to 18 when the catalog omits them", () => {
    const p = chainParamsFromChainDef({
      ...PLUME,
      nativeCurrency: { name: "PLUME", symbol: "PLUME" },
    } as ChainDef);
    assert.equal(p?.nativeCurrency.decimals, 18);
  });

  it("falls back to a synthetic name when the catalog has none", () => {
    const p = chainParamsFromChainDef({
      ...PLUME,
      networkName: undefined,
      networkIdentifier: undefined,
      axelarChainName: undefined,
    } as ChainDef);
    assert.equal(p?.chainName, "Chain 98866");
  });
});

describe("chainParamsFor", () => {
  it("still serves the builtin table", () => {
    assert.equal(chainParamsFor(8453)?.chainName, "Base");
  });

  it("returns undefined for a chain nobody registered", () => {
    assert.equal(chainParamsFor(987654321), undefined);
  });

  // Registered entries come from the same catalog that produced the route, so
  // they must win over a stale builtin.
  it("prefers a registered entry over the builtin table", () => {
    registerChainParams(8453, {
      chainIdHex: "0x2105",
      chainName: "Base (from catalog)",
      rpcUrls: ["https://example.invalid"],
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    });
    assert.equal(chainParamsFor(8453)?.chainName, "Base (from catalog)");
  });

  it("serves a chain the builtin table never covered once registered", () => {
    assert.equal(chainParamsFor(98866), undefined);
    registerChainParams(98866, chainParamsFromChainDef(PLUME)!);
    assert.equal(chainParamsFor(98866)?.chainName, "Plume");
  });
});
