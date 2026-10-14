import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChainDef } from "src/types";
import {
  canBecomeDest,
  canFlip,
  flipSides,
  pickToken,
  type DestRules,
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

const OPEN: DestRules = { lockDestToken: false, allowedDestTokens: null };
const LOCKED: DestRules = { lockDestToken: true, allowedDestTokens: null };
const ONLY_BASE_USDC: DestRules = {
  lockDestToken: false,
  allowedDestTokens: [{ chainId: 8453, address: USDC_BASE.address }],
};

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
    const rules: DestRules = {
      lockDestToken: false,
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
