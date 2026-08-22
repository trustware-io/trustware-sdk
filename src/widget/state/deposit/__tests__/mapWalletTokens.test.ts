import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChainDef } from "src/types";
import { NATIVE_SOLANA } from "src/widget/helpers/chainHelpers";
import { mapWalletTokens } from "src/widget/state/deposit/useWalletTokenState";

const NATIVE_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Tempo lists its native PathUSD at a real contract address rather than the
// sentinel, so the sentinel lookup finds nothing for it.
const TEMPO = {
  chainId: "4217",
  networkName: "Tempo",
  networkIdentifier: "tempo",
  chainType: "evm",
  type: "evm",
  nativeCurrency: { name: "PathUSD", symbol: "PUSD", decimals: 18 },
} as unknown as ChainDef;

const PLUME = {
  chainId: "98866",
  networkName: "Plume",
  networkIdentifier: "plume",
  chainType: "evm",
  type: "evm",
  nativeCurrency: { name: "PLUME", symbol: "PLUME", decimals: 18 },
} as unknown as ChainDef;

const TOKENS = [
  {
    chainId: "4217",
    address: "0x20c0000000000000000000000000000000000000",
    symbol: "PathUSD",
    name: "PathUSD",
    decimals: 18,
  },
  {
    chainId: "98866",
    address: NATIVE_SENTINEL,
    symbol: "PLUME",
    name: "Plume",
    decimals: 18,
  },
  {
    chainId: "98866",
    address: "0xdddd73f5df1f0dc31373357beac77545dc5a6f3f",
    symbol: "pUSD",
    name: "Plume USD",
    decimals: 6,
  },
] as unknown as Parameters<typeof mapWalletTokens>[2];

function balances(rows: Array<[string, object[]]>) {
  return rows.map(([chain_id, balances]) => ({
    chain_id,
    balances,
  })) as unknown as Parameters<typeof mapWalletTokens>[0];
}

describe("mapWalletTokens", () => {
  // The regression: the backend reported native PUSD on Tempo and the widget
  // showed nothing, because no catalog entry sits at the native sentinel.
  it("keeps a native balance whose chain lists no token at the sentinel", () => {
    const out = mapWalletTokens(
      balances([
        [
          "4217",
          [
            {
              category: "native",
              symbol: "PUSD",
              decimals: 18,
              balance: "123",
            },
          ],
        ],
      ]),
      [TEMPO],
      TOKENS
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].symbol, "PUSD");
    assert.equal(out[0].name, "PathUSD");
    assert.equal(out[0].decimals, 18);
    assert.equal(out[0].balance, "123");
    assert.equal(out[0].chainId, "4217");
  });

  it("still maps a native balance that does resolve from the catalog", () => {
    const out = mapWalletTokens(
      balances([
        [
          "98866",
          [
            {
              category: "native",
              symbol: "PLUME",
              decimals: 18,
              balance: "937019588321046486",
            },
          ],
        ],
      ]),
      [PLUME],
      TOKENS
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].symbol, "PLUME");
    assert.equal(out[0].balance, "937019588321046486");
  });

  it("maps an erc20 balance that is in the catalog", () => {
    const out = mapWalletTokens(
      balances([
        [
          "98866",
          [
            {
              category: "erc20",
              contract: "0xdddd73f5df1f0dc31373357beac77545dc5a6f3f",
              symbol: "pUSD",
              decimals: 6,
              balance: "500000",
            },
          ],
        ],
      ]),
      [PLUME],
      TOKENS
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].symbol, "pUSD");
    assert.equal(out[0].balance, "500000");
  });

  // Unroutable ERC20s stay filtered: the wallet collects airdropped spam by
  // the dozen, and a token the router has never heard of cannot be swapped.
  it("still drops an erc20 that is not in the catalog", () => {
    const out = mapWalletTokens(
      balances([
        [
          "98866",
          [
            {
              category: "erc20",
              contract: "0x" + "ab".repeat(20),
              symbol: "www.spam.cfd",
              decimals: 18,
              balance: "1000000",
            },
          ],
        ],
      ]),
      [PLUME],
      TOKENS
    );
    assert.equal(out.length, 0);
  });

  it("drops a balance for a chain the hub does not know", () => {
    const out = mapWalletTokens(
      balances([
        [
          "999999",
          [{ category: "native", symbol: "X", decimals: 18, balance: "5" }],
        ],
      ]),
      [PLUME],
      TOKENS
    );
    assert.equal(out.length, 0);
  });

  // ChainDef declares both `type` and `chainType` optional ("some payloads use
  // both"), and getNativeTokenAddress defaults to the EVM sentinel when given
  // nothing. Reading only `type` would hand a Solana chain an EVM address.
  it("picks the Solana native address when only chainType is set", () => {
    const solana = {
      chainId: "solana-mainnet-beta",
      networkName: "Solana",
      chainType: "solana",
      nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
    } as unknown as ChainDef;

    const out = mapWalletTokens(
      balances([
        [
          "solana-mainnet-beta",
          [
            {
              category: "native",
              symbol: "SOL",
              decimals: 9,
              balance: "1000000000",
            },
          ],
        ],
      ]),
      [solana],
      TOKENS
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].symbol, "SOL");
    assert.equal(
      out[0].address,
      NATIVE_SOLANA,
      "should be the Solana native address, not the EVM sentinel"
    );
  });

  // Without a symbol there is nothing meaningful to render.
  it("drops a native balance when the chain names no native currency", () => {
    const noNative = { ...TEMPO, nativeCurrency: undefined } as ChainDef;
    const out = mapWalletTokens(
      balances([
        ["4217", [{ category: "native", symbol: "PUSD", balance: "123" }]],
      ]),
      [noNative],
      TOKENS
    );
    assert.equal(out.length, 0);
  });
});
