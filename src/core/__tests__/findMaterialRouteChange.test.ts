import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  findMaterialRouteChange,
  type MaterialRouteChange,
} from "src/core/signTimeRoute";
import { requestSlippageBps } from "src/core/routes";
import type { BuildRouteResult } from "src/types";

function route(
  intentId: string,
  fromAmount: string | undefined,
  toAmount: string | undefined
): BuildRouteResult {
  return {
    intentId,
    txReq: { data: "AA==" },
    actions: [],
    finalExchangeRate: {},
    route: { estimate: { fromAmount, toAmount } },
  };
}

/** mulberry32: a fixed seed makes every run test the same cases. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A non-negative bigint of 0 to 256 bits, so tiny, token-sized and
 *  uint256-sized amounts all occur. */
function randomAmount(random: () => number): bigint {
  const words = Math.floor(random() * 9);
  let value = 0n;
  for (let i = 0; i < words; i++) {
    value = (value << 32n) | BigInt(Math.floor(random() * 4294967296));
  }
  return value;
}

function randomBps(random: () => number): number {
  const edge = random();
  if (edge < 0.1) return 0;
  if (edge < 0.2) return 10_000;
  return Math.floor(random() * 10_001);
}

describe("findMaterialRouteChange", () => {
  it("allows a drop down to the slippage floor and no further", () => {
    const reviewed = route("a", "1000000", "990000");
    assert.equal(
      findMaterialRouteChange(reviewed, route("b", "1000000", "985050"), 50),
      null
    );
    assert.deepEqual(
      findMaterialRouteChange(reviewed, route("b", "1000000", "985049"), 50),
      {
        kind: "output_below_accepted_slippage",
        reviewedToAmount: 990000n,
        floorToAmount: 985050n,
        rebuiltToAmount: 985049n,
        slippageBps: 50,
      }
    );
  });

  it("rounds the floor up, so an output a fraction below it is material", () => {
    // 999 less 0.5% is 994.005: 994 is below it, 995 is not.
    const reviewed = route("a", "10", "999");
    assert.deepEqual(
      findMaterialRouteChange(reviewed, route("b", "10", "994"), 50),
      {
        kind: "output_below_accepted_slippage",
        reviewedToAmount: 999n,
        floorToAmount: 995n,
        rebuiltToAmount: 994n,
        slippageBps: 50,
      }
    );
    assert.equal(
      findMaterialRouteChange(reviewed, route("b", "10", "995"), 50),
      null
    );
  });

  it("treats any drop as material at zero slippage, and none at 100%", () => {
    const reviewed = route("a", "10", "1000");
    assert.equal(
      findMaterialRouteChange(reviewed, route("b", "10", "999"), 0)?.kind,
      "output_below_accepted_slippage"
    );
    assert.equal(
      findMaterialRouteChange(reviewed, route("b", "10", "0"), 10_000),
      null
    );
  });

  it("calls a higher input material even when the output rose", () => {
    assert.deepEqual(
      findMaterialRouteChange(
        route("a", "100", "1000"),
        route("b", "101", "2000"),
        50
      ),
      {
        kind: "input_increased",
        reviewedFromAmount: 100n,
        rebuiltFromAmount: 101n,
      }
    );
  });

  it("accepts a lower input", () => {
    assert.equal(
      findMaterialRouteChange(
        route("a", "100", "1000"),
        route("b", "99", "1000"),
        50
      ),
      null
    );
  });

  // The claim: material exactly when the rebuild spends more, or else when
  // rebuilt * 10000 < reviewed * (10000 - bps), with the floor reported as
  // the smallest integer output the slippage allows. Each sample also probes
  // the floor itself and its two neighbours, where an off-by-one would hide.
  it("matches the exact-arithmetic definition across the input range", () => {
    const random = seededRandom(0x5eed_2026);
    let materialOutputs = 0;
    let materialInputs = 0;
    let accepted = 0;

    for (let sample = 0; sample < 2_000; sample++) {
      const reviewedFrom = randomAmount(random);
      const reviewedTo = randomAmount(random);
      const bps = randomBps(random);
      const kept = 10_000n - BigInt(bps);
      const ceilingFloor = (reviewedTo * kept + 9_999n) / 10_000n;

      const rebuiltFroms = [
        reviewedFrom,
        reviewedFrom + 1n,
        reviewedFrom > 0n ? reviewedFrom - 1n : 0n,
        randomAmount(random),
      ];
      const rebuiltTos = [
        ceilingFloor,
        ceilingFloor + 1n,
        ceilingFloor > 0n ? ceilingFloor - 1n : 0n,
        randomAmount(random),
      ];

      for (const rebuiltFrom of rebuiltFroms) {
        for (const rebuiltTo of rebuiltTos) {
          const change = findMaterialRouteChange(
            route("a", reviewedFrom.toString(), reviewedTo.toString()),
            route("b", rebuiltFrom.toString(), rebuiltTo.toString()),
            bps
          );

          let expected: MaterialRouteChange | null = null;
          if (rebuiltFrom > reviewedFrom) {
            expected = {
              kind: "input_increased",
              reviewedFromAmount: reviewedFrom,
              rebuiltFromAmount: rebuiltFrom,
            };
          } else if (rebuiltTo * 10_000n < reviewedTo * kept) {
            expected = {
              kind: "output_below_accepted_slippage",
              reviewedToAmount: reviewedTo,
              floorToAmount: ceilingFloor,
              rebuiltToAmount: rebuiltTo,
              slippageBps: bps,
            };
          }
          assert.deepEqual(change, expected);

          if (change?.kind === "output_below_accepted_slippage") {
            materialOutputs++;
            // The smallest integer the slippage allows, and no smaller.
            assert.ok(change.floorToAmount * 10_000n >= reviewedTo * kept);
            assert.ok(
              change.floorToAmount === 0n ||
                (change.floorToAmount - 1n) * 10_000n < reviewedTo * kept
            );
          } else if (change?.kind === "input_increased") {
            materialInputs++;
          } else {
            accepted++;
          }
        }
      }
    }

    // Every regime is actually exercised, not just one.
    assert.ok(materialOutputs > 1_000, `${materialOutputs} output changes`);
    assert.ok(materialInputs > 1_000, `${materialInputs} input changes`);
    assert.ok(accepted > 1_000, `${accepted} accepted`);
  });

  it("rejects a slippage that isn't 0 to 10000 whole basis points", () => {
    const reviewed = route("a", "1", "1");
    for (const bps of [-1, 10_001, 0.5, Number.NaN, Infinity]) {
      assert.throws(() => findMaterialRouteChange(reviewed, reviewed, bps), {
        message: `Slippage must be a whole number of basis points from 0 to 10000 (got ${bps}).`,
      });
    }
  });

  it("refuses to judge an estimate without integer amounts", () => {
    const good = route("good", "100", "100");
    const cases: [BuildRouteResult, BuildRouteResult, string][] = [
      [
        route("rev", undefined, "100"),
        good,
        'Can\'t compare the reviewed route (intent "rev") with the other one: its estimate.fromAmount is undefined, not an integer amount.',
      ],
      [
        good,
        route("reb", "1.5", "100"),
        'Can\'t compare the rebuilt route (intent "reb") with the other one: its estimate.fromAmount is "1.5", not an integer amount.',
      ],
      [
        route("rev", "100", "-1"),
        good,
        'Can\'t compare the reviewed route (intent "rev") with the other one: its estimate.toAmount is "-1", not an integer amount.',
      ],
      [
        good,
        route("reb", "100", "0x10"),
        'Can\'t compare the rebuilt route (intent "reb") with the other one: its estimate.toAmount is "0x10", not an integer amount.',
      ],
      [
        good,
        route("reb", "100", " 7"),
        'Can\'t compare the rebuilt route (intent "reb") with the other one: its estimate.toAmount is " 7", not an integer amount.',
      ],
    ];
    for (const [reviewed, rebuilt, message] of cases) {
      assert.throws(() => findMaterialRouteChange(reviewed, rebuilt, 50), {
        message,
      });
    }
  });
});

describe("requestSlippageBps", () => {
  it("converts a percentage to basis points", () => {
    assert.equal(requestSlippageBps({ slippage: 0.5 }), 50);
    assert.equal(requestSlippageBps({ slippage: 1 }), 100);
    assert.equal(requestSlippageBps({ slippage: 0 }), 0);
  });

  it("prefers an explicit slippageBps", () => {
    assert.equal(requestSlippageBps({ slippage: 3, slippageBps: 75 }), 75);
  });

  it("is undefined when the request names neither", () => {
    assert.equal(requestSlippageBps({}), undefined);
  });
});
