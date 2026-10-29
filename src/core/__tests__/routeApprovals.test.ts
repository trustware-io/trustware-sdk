import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  approvalAmountWei,
  assertValidRouteApprovals,
} from "src/core/routeApprovals";
import { buildRoute } from "src/core/routes";
import { TrustwareConfigStore } from "src/config/store";
import type { RouteApproval } from "src/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const ROUTER = "0x3333333333333333333333333333333333333333";
const SPENDER = "0xce16f69375520ab01377ce7b88f5ba8c48f8d666";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const MAX_UINT256 = 2n ** 256n - 1n;

function approval(amount: string | undefined): RouteApproval {
  return { chainId: "8453", tokenAddress: USDC, spender: SPENDER, amount };
}

/** Deterministic 64-bit LCG, so a failing case reproduces. */
function* uint256Samples(count: number): Generator<bigint> {
  let state = 0x2545f4914f6cdd1dn;
  for (let i = 0; i < count; i++) {
    let value = 0n;
    for (let limb = 0; limb < 4; limb++) {
      state = (state * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
      value = (value << 64n) | state;
    }
    // Spread the magnitudes too, not just the bits of 256-bit numbers.
    yield value >> BigInt(i % 257);
  }
}

describe("approvalAmountWei", () => {
  it("reads a router approval's amount", () => {
    assert.equal(approvalAmountWei(approval("1000302"), 0), 1_000_302n);
  });

  it("keeps an explicit 0, the reset-to-zero step", () => {
    assert.equal(approvalAmountWei(approval("0"), 0), 0n);
  });

  it("reads an unlimited amount exactly", () => {
    assert.equal(
      approvalAmountWei(approval(MAX_UINT256.toString()), 0),
      MAX_UINT256
    );
  });

  it("returns every decimal uint256 it is given, unchanged", () => {
    const boundaries = [0n, 1n, 2n ** 64n - 1n, 2n ** 64n, MAX_UINT256];
    for (const value of [...boundaries, ...uint256Samples(500)]) {
      assert.equal(approvalAmountWei(approval(value.toString()), 0), value);
    }
  });

  it("refuses a missing amount instead of reading it as 0", () => {
    assert.throws(() => approvalAmountWei(approval(undefined), 2), {
      message: `Route approval 2 (spender ${SPENDER}) has no amount.`,
    });
    assert.throws(() => approvalAmountWei(approval(""), 2), {
      message: `Route approval 2 (spender ${SPENDER}) has no amount.`,
    });
  });

  // BigInt() itself takes several of these (hex, padded, signed), so the
  // check must not lean on it.
  it("refuses every amount that is not a plain decimal integer", () => {
    for (const amount of [
      "abc",
      "1.5",
      "1e6",
      "-1",
      "+1",
      " 5",
      "5 ",
      "0x10",
      "0b1",
      "1_000",
      "１",
    ]) {
      assert.throws(() => approvalAmountWei(approval(amount), 0), {
        message: `Route approval 0 (spender ${SPENDER}) has an invalid amount "${amount}".`,
      });
    }
  });

  it("refuses a sign, padding or fraction around any valid amount", () => {
    for (const value of uint256Samples(200)) {
      const digits = value.toString();
      for (const amount of [`-${digits}`, ` ${digits}`, `${digits}.0`]) {
        assert.throws(() => approvalAmountWei(approval(amount), 0));
      }
    }
  });
});

describe("assertValidRouteApprovals", () => {
  it("accepts a plan with no approvals", () => {
    assertValidRouteApprovals(undefined);
    assertValidRouteApprovals([]);
  });

  it("accepts a plan whose approvals all carry amounts", () => {
    assertValidRouteApprovals([approval("0"), approval("1000302")]);
  });

  it("names the approval that has no amount", () => {
    assert.throws(
      () => assertValidRouteApprovals([approval("0"), approval(undefined)]),
      { message: `Route approval 1 (spender ${SPENDER}) has no amount.` }
    );
  });
});

describe("buildRoute approval amounts", () => {
  const realFetch = globalThis.fetch;
  const body = {
    fromChain: "8453",
    toChain: "8453",
    fromToken: USDC,
    toToken: USDC,
    fromAmount: "1000302",
    fromAddress: OWNER,
    toAddress: OWNER,
  };

  function serveRoute(approvals: RouteApproval[]) {
    const payload = {
      data: {
        intentId: "intent-1",
        route: {
          provider: "squid",
          execution: {
            transaction: {
              to: ROUTER,
              data: "0xdeadbeef",
              value: "0",
              chainId: "8453",
            },
            approvals,
          },
        },
      },
    };
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
  }

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // Every consumer funnels through buildRoute, so refusing here keeps a
  // broken plan out of the widget's render path entirely.
  it("refuses a route whose approval has no amount", async () => {
    serveRoute([approval(undefined)]);
    await assert.rejects(buildRoute(body), {
      message: `Route approval 0 (spender ${SPENDER}) has no amount.`,
    });
  });

  it("refuses a route whose approval amount is not an integer", async () => {
    serveRoute([approval("1000302.5")]);
    await assert.rejects(buildRoute(body), {
      message: `Route approval 0 (spender ${SPENDER}) has an invalid amount "1000302.5".`,
    });
  });

  it("returns a route whose approvals all carry amounts", async () => {
    serveRoute([approval("1000302")]);
    const result = await buildRoute(body);
    assert.deepEqual(result.route?.execution?.approvals, [approval("1000302")]);
  });
});
