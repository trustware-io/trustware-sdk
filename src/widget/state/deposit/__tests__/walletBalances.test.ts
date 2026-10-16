import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChainDef, WalletAddressBalanceWrapper } from "src/types";
import type { YourTokenData } from "src/widget/state/deposit/types";
import {
  sortWalletTokensByValue,
  walletBalanceErrors,
  walletTokenUsdValue,
} from "src/widget/state/deposit/walletBalances";
import { NATIVE_SOLANA } from "src/utils/chains";
import { mulberry32 } from "src/__tests__/seededRandom";
import { rawToDecimal } from "src/widget/helpers/tokenAmount";

function token(
  symbol: string,
  balance: string,
  decimals: number,
  usdPrice: number | undefined,
  address = symbol
): YourTokenData {
  return {
    chainIconURI: "",
    chainData: undefined,
    symbol,
    decimals,
    name: symbol,
    iconUrl: "",
    chainId: "solana-mainnet-beta",
    usdPrice,
    address,
    chain_key: "solana",
    category: "spl",
    balance,
  };
}

const SOL = token("SOL", "2000000000", 9, 104.5, NATIVE_SOLANA); // $209
const USDC = token("USDC", "100000000", 6, 1); // $100
// A large wallet's spam: a vast base-unit count and no price.
const SPAM = token("SPAM", "900000000000000000", 9, undefined);
const DUST = token("DUST", "5", 0, undefined);

describe("walletTokenUsdValue", () => {
  it("multiplies the human amount by the price", () => {
    assert.equal(walletTokenUsdValue(SOL), 209);
    assert.equal(walletTokenUsdValue(USDC), 100);
  });

  it("is null without a usable price", () => {
    for (const usdPrice of [undefined, 0, -1, Number.NaN, Infinity]) {
      assert.equal(
        walletTokenUsdValue({ ...USDC, usdPrice }),
        null,
        String(usdPrice)
      );
    }
  });
});

describe("sortWalletTokensByValue", () => {
  it("puts real holdings above unpriced spam with a bigger raw balance", () => {
    assert.deepEqual(sortWalletTokensByValue([SPAM, USDC, DUST, SOL]), [
      SOL,
      USDC,
      SPAM,
      DUST,
    ]);
  });

  it("breaks ties by chain and address, not input order", () => {
    const a = token("A", "1", 0, undefined, "AAA");
    const b = token("B", "1", 0, undefined, "BBB");
    assert.deepEqual(sortWalletTokensByValue([b, a]), [a, b]);
    assert.deepEqual(sortWalletTokensByValue([a, b]), [a, b]);
  });

  it("returns a permutation with priced tokens first by value, then unpriced by amount", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const random = mulberry32(seed);
      const tokens = Array.from(
        { length: 1 + Math.floor(random() * 25) },
        (_, i) =>
          token(
            `T${i}`,
            String(Math.floor(random() * 1e12)),
            Math.floor(random() * 19),
            random() < 0.5 ? random() * 5000 : undefined,
            `addr${seed}-${i}`
          )
      );
      const sorted = sortWalletTokensByValue(tokens);
      assert.deepEqual(
        [...sorted].map((t) => t.address).sort(),
        [...tokens].map((t) => t.address).sort(),
        `seed ${seed}: not a permutation`
      );
      const values = sorted.map(walletTokenUsdValue);
      const firstUnpriced = values.indexOf(null);
      const priced =
        firstUnpriced === -1 ? values : values.slice(0, firstUnpriced);
      assert.ok(
        values.slice(priced.length).every((v) => v === null),
        `seed ${seed}: a priced token follows an unpriced one`
      );
      for (let i = 1; i < priced.length; i++) {
        assert.ok(
          (priced[i - 1] as number) >= (priced[i] as number),
          `seed ${seed}: priced values out of order at ${i}`
        );
      }
      const unpricedAmounts = sorted
        .slice(priced.length)
        .map((t) => Number(rawToDecimal(t.balance, t.decimals)));
      for (let i = 1; i < unpricedAmounts.length; i++) {
        assert.ok(
          unpricedAmounts[i - 1] >= unpricedAmounts[i],
          `seed ${seed}: unpriced amounts out of order at ${i}`
        );
      }
    }
  });
});

describe("walletBalanceErrors", () => {
  const SOLANA = {
    chainId: "solana-mainnet-beta",
    chainType: "solana",
  } as ChainDef;
  const BASE = { chainId: "8453", chainType: "evm" } as ChainDef;
  const BITCOIN = { chainId: "bitcoin", chainType: "bitcoin" } as ChainDef;
  const CHAINS = [SOLANA, BASE, BITCOIN];
  const SOLANA_WALLET = "6pWgr6Y4RJ57BDUcRnrhyAUFs2jYiwx864SLoxpju5Ys";
  const EVM_WALLET = "0xa5cc6f03b19b7528d34e19c7cdb918bdbe6ccbf1";

  const result = (
    chain_id: string,
    error: string | null
  ): WalletAddressBalanceWrapper => ({
    chain_id,
    balances: [],
    count: 0,
    error,
    source: "fallback",
  });
  // The backend answers a failed chain with one of three fixed messages
  // (iluvatar services/balances/public_errors.go). It also reports chains
  // the address can't exist on as failed, which the widget must not show.
  const RESULTS = [
    result("solana-mainnet-beta", "balance lookup timed out"),
    result("8453", "balance lookup failed"),
    result("bitcoin", "invalid address for chain"),
    result("42161", "balance lookup failed"),
    result("137", null),
  ];

  it("keeps only failures on chains a Solana wallet can hold tokens on", () => {
    assert.deepEqual(walletBalanceErrors(RESULTS, CHAINS, SOLANA_WALLET), {
      "solana-mainnet-beta": "balance lookup timed out",
    });
  });

  it("keeps only failures on chains an EVM wallet can hold tokens on", () => {
    assert.deepEqual(walletBalanceErrors(RESULTS, CHAINS, EVM_WALLET), {
      "8453": "balance lookup failed",
    });
  });

  it("is empty when every chain loaded", () => {
    assert.deepEqual(
      walletBalanceErrors(
        [result("solana-mainnet-beta", null)],
        CHAINS,
        SOLANA_WALLET
      ),
      {}
    );
  });
});
