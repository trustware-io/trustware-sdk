import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { plannedErc20Approvals } from "src/widget/helpers/plannedApprovals";

const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const USDT_ETHEREUM = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const SQUID_ROUTER = "0xce16f69375520ab01377ce7b88f5ba8c48f8d666";
const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const UNLIMITED = (2n ** 256n - 1n).toString();

const baseRoute = {
  fromTokenAddress: USDC_BASE,
  chainId: "8453",
  amountWei: 50_000_000n,
};

describe("plannedErc20Approvals", () => {
  // A Squid Intents deposit is transfer(depositAddress, amount) sent to the
  // USDC contract itself; the backend plans no approval for it. Nothing here
  // may stand in for the plan with the transaction's `to`.
  it("needs nothing when the plan names no approvals", () => {
    assert.deepEqual(plannedErc20Approvals(undefined, baseRoute), []);
    assert.deepEqual(plannedErc20Approvals([], baseRoute), []);
  });

  it("returns a router approval exactly as planned", () => {
    assert.deepEqual(
      plannedErc20Approvals(
        [
          {
            chainId: "8453",
            tokenAddress: USDC_BASE,
            spender: SQUID_ROUTER,
            amount: "50000000",
          },
        ],
        baseRoute
      ),
      [
        {
          stepIndex: 0,
          chainId: "8453",
          token: USDC_BASE,
          spender: SQUID_ROUTER,
          amountWei: 50_000_000n,
        },
      ]
    );
  });

  it("sizes an unlimited plan amount down to the route's amount", () => {
    const [approval] = plannedErc20Approvals(
      [
        {
          chainId: "8453",
          tokenAddress: USDC_BASE,
          spender: SQUID_ROUTER,
          amount: UNLIMITED,
        },
      ],
      baseRoute
    );
    assert.equal(approval.amountWei, 50_000_000n);
  });

  it("keeps a USDT reset-to-zero step, in plan order", () => {
    const usdtRoute = {
      fromTokenAddress: USDT_ETHEREUM,
      chainId: "1",
      amountWei: 7_000_000n,
    };
    assert.deepEqual(
      plannedErc20Approvals(
        [
          {
            chainId: "1",
            tokenAddress: USDT_ETHEREUM,
            spender: PERMIT2,
            amount: "0",
          },
          {
            chainId: "1",
            tokenAddress: USDT_ETHEREUM,
            spender: PERMIT2,
            amount: "7000000",
          },
        ],
        usdtRoute
      ),
      [
        {
          stepIndex: 0,
          chainId: "1",
          token: USDT_ETHEREUM,
          spender: PERMIT2,
          amountWei: 0n,
        },
        {
          stepIndex: 1,
          chainId: "1",
          token: USDT_ETHEREUM,
          spender: PERMIT2,
          amountWei: 7_000_000n,
        },
      ]
    );
  });

  it("keeps the chain an approval names over the route's", () => {
    const [approval] = plannedErc20Approvals(
      [
        {
          chainId: "1",
          tokenAddress: USDT_ETHEREUM,
          spender: SQUID_ROUTER,
          amount: "1",
        },
      ],
      baseRoute
    );
    assert.equal(approval.chainId, "1");
  });

  it("fills a missing token and chain from the route", () => {
    assert.deepEqual(
      plannedErc20Approvals(
        [{ spender: SQUID_ROUTER, amount: "50000000" }],
        baseRoute
      ),
      [
        {
          stepIndex: 0,
          chainId: "8453",
          token: USDC_BASE,
          spender: SQUID_ROUTER,
          amountWei: 50_000_000n,
        },
      ]
    );
  });

  // The step index is the backend's, so dropping an entry must not shift
  // the ones after it.
  it("leaves out entries that are not ERC20 allowances, keeping step indices", () => {
    assert.deepEqual(
      plannedErc20Approvals(
        [
          {
            chainId: "solana",
            tokenAddress: USDC_SOLANA,
            spender: SQUID_ROUTER,
            amount: "1",
          },
          {
            chainId: "8453",
            tokenAddress: USDC_BASE,
            spender: "not-an-address",
            amount: "1",
          },
          {
            chainId: "8453",
            tokenAddress: USDC_BASE,
            spender: SQUID_ROUTER,
            amount: "50000000",
          },
        ],
        baseRoute
      ),
      [
        {
          stepIndex: 2,
          chainId: "8453",
          token: USDC_BASE,
          spender: SQUID_ROUTER,
          amountWei: 50_000_000n,
        },
      ]
    );
  });

  // Read as 0, a missing amount would become a reset-to-zero approve and
  // leave the router with no allowance.
  it("refuses an approval with no amount", () => {
    assert.throws(
      () =>
        plannedErc20Approvals(
          [{ chainId: "8453", tokenAddress: USDC_BASE, spender: SQUID_ROUTER }],
          baseRoute
        ),
      {
        message: `Route approval 0 (spender ${SQUID_ROUTER}) has no amount.`,
      }
    );
  });

  it("refuses an approval whose amount is not an integer", () => {
    assert.throws(
      () =>
        plannedErc20Approvals(
          [
            {
              chainId: "8453",
              tokenAddress: USDC_BASE,
              spender: SQUID_ROUTER,
              amount: "50.5",
            },
          ],
          baseRoute
        ),
      {
        message: `Route approval 0 (spender ${SQUID_ROUTER}) has an invalid amount "50.5".`,
      }
    );
  });
});
