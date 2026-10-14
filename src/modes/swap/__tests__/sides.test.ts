import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChainDef } from "src/types";
import {
  automaticSellToken,
  canBecomeDest,
  canFlip,
  flipSides,
  hiddenFromSellPicker,
  isSameToken,
  pickToken,
  type SwapRules,
  type SwapSides,
} from "src/modes/swap/sides";
import { NATIVE_EVM, NATIVE_SOLANA } from "src/utils/chains";

type T = { address: string; chainId: string | number; symbol: string };

const SOLANA = {
  chainId: "solana-mainnet-beta",
  chainType: "solana",
} as ChainDef;
const BASE = { chainId: "8453", chainType: "evm" } as ChainDef;
const ETHEREUM = { chainId: "1", chainType: "evm" } as ChainDef;

const SOL: T = {
  chainId: SOLANA.chainId,
  address: NATIVE_SOLANA,
  symbol: "SOL",
};
const SOL_AS_SENTINEL: T = { ...SOL, address: NATIVE_EVM };
const USDC_SOLANA: T = {
  chainId: SOLANA.chainId,
  address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
};
const ETH_BASE: T = {
  chainId: BASE.chainId,
  address: NATIVE_EVM,
  symbol: "ETH",
};
const USDC_BASE: T = {
  chainId: BASE.chainId,
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  symbol: "USDC",
};

const OPEN: SwapRules = {
  lockDestToken: false,
  allowedDestTokens: null,
  depositsIntoVault: false,
};
const LOCKED: SwapRules = { ...OPEN, lockDestToken: true };
const ONLY_BASE_USDC: SwapRules = {
  ...OPEN,
  allowedDestTokens: [{ chainId: 8453, address: USDC_BASE.address }],
};
const VAULT: SwapRules = { ...OPEN, depositsIntoVault: true };

function sides(
  from: [T | null, ChainDef | null],
  to: [T | null, ChainDef | null]
): SwapSides<T> {
  return {
    from: { token: from[0], chain: from[1] },
    to: { token: to[0], chain: to[1] },
  };
}

describe("pickToken on the sell side", () => {
  // The recording behind this: Buy held native SOL, and the user went to
  // pick SOL to sell.
  it("flips the sides when the buy token is picked, whichever spelling", () => {
    const start = sides([USDC_BASE, BASE], [SOL, SOLANA]);
    for (const picked of [SOL, SOL_AS_SENTINEL]) {
      assert.deepEqual(
        pickToken(start, "from", { token: picked, chain: SOLANA }, OPEN),
        {
          sides: sides([picked, SOLANA], [USDC_BASE, BASE]),
          flipped: true,
        },
        picked.address
      );
    }
  });

  it("empties the buy side when the sell side was empty", () => {
    const start = sides([null, SOLANA], [SOL, SOLANA]);
    assert.deepEqual(
      pickToken(start, "from", { token: SOL, chain: SOLANA }, OPEN),
      { sides: sides([SOL, SOLANA], [null, SOLANA]), flipped: true }
    );
  });

  it("just sets the sell token when it differs from the buy token", () => {
    const start = sides([USDC_BASE, BASE], [SOL, SOLANA]);
    assert.deepEqual(
      pickToken(start, "from", { token: USDC_SOLANA, chain: SOLANA }, OPEN),
      { sides: sides([USDC_SOLANA, SOLANA], [SOL, SOLANA]), flipped: false }
    );
  });

  it("treats the same address on another chain as a different token", () => {
    const start = sides([null, null], [USDC_BASE, BASE]);
    const usdcEthereum = { ...USDC_BASE, chainId: ETHEREUM.chainId };
    assert.deepEqual(
      pickToken(start, "from", { token: usdcEthereum, chain: ETHEREUM }, OPEN),
      {
        sides: sides([usdcEthereum, ETHEREUM], [USDC_BASE, BASE]),
        flipped: false,
      }
    );
  });

  it("refuses a flip the rules forbid, since the picker hides that token", () => {
    const start = sides([ETH_BASE, BASE], [USDC_BASE, BASE]);
    for (const rules of [LOCKED, ONLY_BASE_USDC]) {
      assert.throws(
        () =>
          pickToken(start, "from", { token: USDC_BASE, chain: BASE }, rules),
        {
          message:
            `Picked the buy token ${USDC_BASE.address} on chain 8453 as the ` +
            `sell token, but the sides can't flip; the sell picker should ` +
            `have hidden it`,
        }
      );
    }
  });

  // BVT-398's "move to a better vault": the vault's own asset on the sell
  // side, deposited into a vault for that asset.
  it("sells a vault's own asset into it without flipping", () => {
    const start = sides([ETH_BASE, BASE], [USDC_BASE, BASE]);
    for (const rules of [VAULT, { ...VAULT, lockDestToken: true }]) {
      assert.deepEqual(
        pickToken(start, "from", { token: USDC_BASE, chain: BASE }, rules),
        { sides: sides([USDC_BASE, BASE], [USDC_BASE, BASE]), flipped: false }
      );
    }
  });
});

describe("hiddenFromSellPicker", () => {
  const start = sides([ETH_BASE, BASE], [USDC_BASE, BASE]);

  it("hides nothing when picking the buy token would flip", () => {
    assert.equal(hiddenFromSellPicker(start, OPEN), null);
  });

  it("hides the buy token when the flip is refused", () => {
    assert.equal(hiddenFromSellPicker(start, LOCKED), USDC_BASE);
    assert.equal(hiddenFromSellPicker(start, ONLY_BASE_USDC), USDC_BASE);
  });

  it("hides nothing during a vault deposit, where the asset is a valid sell", () => {
    assert.equal(
      hiddenFromSellPicker(start, { ...VAULT, lockDestToken: true }),
      null
    );
  });

  // The picker and pickToken must agree, or a visible row could throw.
  it("hides exactly the buy tokens pickToken refuses", () => {
    const held: [T | null, ChainDef | null][] = [
      [null, null],
      [null, BASE],
      [SOL, SOLANA],
      [ETH_BASE, BASE],
      [USDC_BASE, BASE],
    ];
    const allRules: SwapRules[] = [];
    for (const lockDestToken of [false, true]) {
      for (const allowedDestTokens of [
        null,
        ONLY_BASE_USDC.allowedDestTokens,
      ]) {
        for (const depositsIntoVault of [false, true]) {
          allRules.push({
            lockDestToken,
            allowedDestTokens,
            depositsIntoVault,
          });
        }
      }
    }
    for (const from of held) {
      for (const to of held) {
        if (!to[0] || !to[1]) continue;
        const start = sides(from, to);
        const buy = { token: to[0], chain: to[1] };
        for (const rules of allRules) {
          let refused = false;
          try {
            pickToken(start, "from", buy, rules);
          } catch {
            refused = true;
          }
          assert.equal(
            hiddenFromSellPicker(start, rules) !== null,
            refused,
            `${JSON.stringify({ from: from[0]?.symbol, to: to[0].symbol, rules })}`
          );
        }
      }
    }
  });
});

describe("automaticSellToken", () => {
  it("keeps a candidate that differs from the buy token", () => {
    assert.equal(
      automaticSellToken(
        { token: SOL, chain: SOLANA },
        { token: USDC_BASE, chain: BASE },
        OPEN
      ),
      SOL
    );
  });

  // The wallet test behind this: Buy held SOL, the wallet connected, and its
  // largest balance (SOL) became the sell token too: "1 SOL = 1 SOL".
  it("drops a candidate that repeats the buy token, whichever spelling", () => {
    for (const buy of [SOL, SOL_AS_SENTINEL]) {
      assert.equal(
        automaticSellToken(
          { token: SOL, chain: SOLANA },
          { token: buy, chain: SOLANA },
          OPEN
        ),
        null
      );
    }
  });

  it("keeps a candidate that repeats a vault's own asset", () => {
    assert.equal(
      automaticSellToken(
        { token: USDC_BASE, chain: BASE },
        { token: USDC_BASE, chain: BASE },
        VAULT
      ),
      USDC_BASE
    );
  });

  it("keeps a candidate when the buy side is empty", () => {
    assert.equal(
      automaticSellToken(
        { token: SOL, chain: SOLANA },
        { token: null, chain: null },
        OPEN
      ),
      SOL
    );
  });
});

describe("isSameToken", () => {
  it("is false when either side is empty or chainless", () => {
    const sol = { token: SOL, chain: SOLANA };
    assert.equal(isSameToken(sol, { token: null, chain: SOLANA }), false);
    assert.equal(isSameToken(sol, { token: SOL, chain: null }), false);
    assert.equal(isSameToken({ token: null, chain: null }, sol), false);
  });
});

describe("pickToken on the buy side", () => {
  it("flips the sides when the sell token is picked", () => {
    const start = sides([SOL, SOLANA], [USDC_BASE, BASE]);
    assert.deepEqual(
      pickToken(start, "to", { token: SOL_AS_SENTINEL, chain: SOLANA }, OPEN),
      {
        sides: sides([USDC_BASE, BASE], [SOL_AS_SENTINEL, SOLANA]),
        flipped: true,
      }
    );
  });

  it("empties the sell side, keeping its chain, when the buy side was empty", () => {
    const start = sides([SOL, SOLANA], [null, null]);
    assert.deepEqual(
      pickToken(start, "to", { token: SOL, chain: SOLANA }, OPEN),
      { sides: sides([null, SOLANA], [SOL, SOLANA]), flipped: true }
    );
  });

  it("just sets the buy token when it differs from the sell token", () => {
    const start = sides([SOL, SOLANA], [null, null]);
    assert.deepEqual(
      pickToken(start, "to", { token: USDC_BASE, chain: BASE }, OPEN),
      { sides: sides([SOL, SOLANA], [USDC_BASE, BASE]), flipped: false }
    );
  });

  it("flips onto an allowlisted buy token", () => {
    const start = sides([USDC_BASE, BASE], [SOL, SOLANA]);
    assert.deepEqual(
      pickToken(start, "to", { token: USDC_BASE, chain: BASE }, ONLY_BASE_USDC),
      { sides: sides([SOL, SOLANA], [USDC_BASE, BASE]), flipped: true }
    );
  });

  it("refuses a buy token the rules forbid, since the picker never offers it", () => {
    const start = sides([ETH_BASE, BASE], [USDC_BASE, BASE]);
    assert.throws(
      () =>
        pickToken(
          start,
          "to",
          { token: ETH_BASE, chain: BASE },
          ONLY_BASE_USDC
        ),
      {
        message:
          `Picked ${NATIVE_EVM} on chain 8453 as the buy token, but it isn't ` +
          `allowed there; the buy picker should not have offered it`,
      }
    );
  });
});

describe("canFlip", () => {
  it("allows a flip with no rules", () => {
    assert.equal(canFlip(sides([SOL, SOLANA], [USDC_BASE, BASE]), OPEN), true);
  });

  it("never allows a flip when the buy token is locked", () => {
    assert.equal(
      canFlip(sides([SOL, SOLANA], [USDC_BASE, BASE]), LOCKED),
      false
    );
    assert.equal(
      canFlip(sides([null, null], [USDC_BASE, BASE]), LOCKED),
      false
    );
  });

  it("allows a flip only when the sell token is on the allowlist", () => {
    assert.equal(
      canFlip(sides([USDC_BASE, BASE], [SOL, SOLANA]), ONLY_BASE_USDC),
      true
    );
    assert.equal(
      canFlip(sides([ETH_BASE, BASE], [USDC_BASE, BASE]), ONLY_BASE_USDC),
      false
    );
  });

  it("allows moving an empty sell side under an allowlist", () => {
    assert.equal(
      canFlip(sides([null, BASE], [USDC_BASE, BASE]), ONLY_BASE_USDC),
      true
    );
  });
});

describe("canBecomeDest", () => {
  it("matches an allowlisted native token by any spelling", () => {
    const rules: SwapRules = {
      ...OPEN,
      allowedDestTokens: [
        { chainId: "solana-mainnet-beta", address: NATIVE_EVM },
      ],
    };
    assert.equal(canBecomeDest({ token: SOL, chain: SOLANA }, rules), true);
  });
});

describe("flipSides", () => {
  it("trades the two sides", () => {
    assert.deepEqual(
      flipSides(sides([SOL, SOLANA], [USDC_BASE, BASE])),
      sides([USDC_BASE, BASE], [SOL, SOLANA])
    );
  });

  // The old flip button left the sell token in place here, so both sides
  // held the same token.
  it("never leaves one token on both sides when the buy side is empty", () => {
    assert.deepEqual(
      flipSides(sides([SOL, SOLANA], [null, null])),
      sides([null, SOLANA], [SOL, SOLANA])
    );
  });

  it("is its own inverse whenever both sides hold a token", () => {
    const held: [T, ChainDef][] = [
      [SOL, SOLANA],
      [USDC_SOLANA, SOLANA],
      [ETH_BASE, BASE],
      [USDC_BASE, BASE],
    ];
    for (const from of held) {
      for (const to of held) {
        const start = sides(from, to);
        assert.deepEqual(flipSides(flipSides(start)), start);
      }
    }
  });
});
