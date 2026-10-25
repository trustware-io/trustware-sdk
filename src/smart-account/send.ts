import type { Chain } from "viem";
import {
  deliverReceipt,
  type ReceiptDeliveryOutcome,
} from "../core/intentTracking";
import type { UserOpReceiptReport } from "../core/receipt";
import type { BuildRouteResult } from "../types";
import { createTrustwareSmartAccountClient } from "./client";
import { isPaymasterUnavailable, extractFeeRequirement } from "./fee-utils";
import {
  PERMIT2,
  randomPermit2Nonce,
  signPermit2,
  encodePermitTransferFrom,
  encodeErc20Approve,
  encodeErc20Allowance,
  encodeErc20BalanceOf,
  encodeWethWithdraw,
} from "./permit2";
import {
  WETH_BY_CHAIN,
  UNISWAP_V3_ROUTER,
  DEFAULT_POOL_FEE,
  encodeUniswapExactOutputSingle,
  estimateRelayFeeInToken,
} from "./uniswap";

const NATIVE_ADDRS = new Set([
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
]);

function isNativeToken(addr: string): boolean {
  return NATIVE_ADDRS.has(addr.toLowerCase());
}

type Eip1193Request = (args: {
  method: string;
  params?: object | unknown[];
}) => Promise<unknown>;

// Permits Permit2 to pull `token` from `owner` up to max uint256 if the current
// allowance is below `requiredAmount`. Sends a regular EOA transaction (not a
// UserOp — the SA cannot sign on behalf of the EOA) and waits for confirmation.
async function ensurePermit2Allowance(
  eip1193Request: Eip1193Request,
  owner: `0x${string}`,
  token: `0x${string}`,
  requiredAmount: bigint | string
): Promise<void> {
  const required = BigInt(requiredAmount as string | bigint);

  const allowanceCalldata = encodeErc20Allowance(owner, PERMIT2);
  const raw = (await eip1193Request({
    method: "eth_call",
    params: [{ to: token, data: allowanceCalldata }, "latest"],
  })) as string;

  const currentAllowance = raw && raw !== "0x" ? BigInt(raw) : 0n;
  console.debug("[send] PERMIT2 allowance", {
    token,
    currentAllowance: currentAllowance.toString(),
    required: required.toString(),
  });
  if (currentAllowance >= required) return;

  console.debug("[send] requesting PERMIT2 max approval from EOA", {
    owner,
    token,
  });
  const approveCalldata = encodeErc20Approve(
    PERMIT2,
    BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
  );
  const txHash = (await eip1193Request({
    method: "eth_sendTransaction",
    params: [{ from: owner, to: token, data: approveCalldata }],
  })) as string;

  console.debug("[send] waiting for PERMIT2 approval tx", { txHash });
  await waitForTransaction(eip1193Request, txHash);
  console.debug("[send] PERMIT2 approval confirmed", { txHash });
}

async function waitForTransaction(
  eip1193Request: Eip1193Request,
  txHash: string,
  timeoutMs = 120_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = (await eip1193Request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status?: string } | null;
    if (receipt !== null) {
      if (receipt.status === "0x0")
        throw new Error(`Approval transaction reverted: ${txHash}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Approval transaction confirmation timeout: ${txHash}`);
}

export type SendRouteAsUserOperationParams = {
  route: BuildRouteResult;
  fromToken: string;
  fromAmountWei: bigint;
  /** Token decimals for the from-token (e.g. 6 for USDC). Used for relay fee estimation when
   *  the route's step metadata doesn't include it. Omit only for native/WETH routes. */
  fromDecimals?: number;
  eoaAddress: `0x${string}`;
  chainId: number;
  viemChain: Chain;
  eip1193Request: Eip1193Request;
};

export type SendRouteAsUserOperationResult = {
  userOpHash: string;
  /** The bundle transaction's hash, once the userOp was seen in a block
   *  within USER_OP_INCLUSION_WAIT_MS; undefined when it wasn't yet. The
   *  userOp is committed either way, and the backend tracks it. */
  txHash?: string;
  intentId: string;
  /** The receipt committed the moment the bundler accepted the userOp:
   *  its hash and the sponsorship request that sponsored it. */
  receipt: UserOpReceiptReport;
  /** That commit's delivery (`deliverReceipt`): don't post it again. */
  receiptDelivery: Promise<ReceiptDeliveryOutcome>;
};

/** How long a send waits to see the userOp's bundle transaction, only so
 *  the caller can show an explorer link. The commit doesn't wait for it. */
export const USER_OP_INCLUSION_WAIT_MS = 45_000;
const USER_OP_INCLUSION_POLL_MS = 3_000;

type BundlerRequest = (method: string, params?: unknown[]) => Promise<unknown>;

/** Time source for the inclusion wait; tests drive it virtually. */
export type InclusionClock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

const systemInclusionClock: InclusionClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * The bundler accepted the userOp: commit its hash at once, then wait up to
 * USER_OP_INCLUSION_WAIT_MS for its bundle transaction. The commit's first
 * POST goes out before the first inclusion poll. Never throws once the
 * userOp is accepted: a caller that saw a throw would send the route again
 * from the EOA, paying twice. Exported for tests.
 */
export async function commitAcceptedUserOperation(
  receipt: UserOpReceiptReport,
  bundlerRequest: BundlerRequest,
  clock: InclusionClock = systemInclusionClock
): Promise<{
  receiptDelivery: Promise<ReceiptDeliveryOutcome>;
  txHash: string | undefined;
}> {
  const receiptDelivery = deliverReceipt(receipt);
  const deadline = clock.now() + USER_OP_INCLUSION_WAIT_MS;
  while (clock.now() < deadline) {
    try {
      const included = (await bundlerRequest("eth_getUserOperationReceipt", [
        receipt.userOpHash,
      ])) as { receipt?: { transactionHash?: string } } | null;
      if (included?.receipt?.transactionHash) {
        return { receiptDelivery, txHash: included.receipt.transactionHash };
      }
    } catch (err) {
      console.debug("[send] inclusion poll failed; polling again", err);
    }
    const remaining = deadline - clock.now();
    if (remaining <= 0) break;
    await clock.sleep(Math.min(USER_OP_INCLUSION_POLL_MS, remaining));
  }
  console.debug("[send] UserOp not seen in a block yet; it is committed", {
    userOpHash: receipt.userOpHash,
  });
  return { receiptDelivery, txHash: undefined };
}

export async function sendRouteAsUserOperation(
  params: SendRouteAsUserOperationParams
): Promise<SendRouteAsUserOperationResult> {
  const {
    route,
    fromToken,
    fromAmountWei,
    fromDecimals: callerFromDecimals,
    chainId,
    viemChain,
    eip1193Request,
  } = params;
  const { txReq, intentId } = route;

  const target = (txReq.to ?? txReq.target) as `0x${string}` | undefined;
  if (!txReq?.data || !target) {
    throw new Error("Route is missing transaction data or target address");
  }

  const callData = txReq.data as `0x${string}`;
  const value = txReq.value ? BigInt(txReq.value) : 0n;

  const paymasterAddress = (route.sponsorship?.paymaster ??
    "") as `0x${string}`;
  if (!paymasterAddress)
    throw new Error("Route sponsorship is missing paymaster address");

  // Derive the EOA from the wallet provider rather than trusting the caller's
  // walletAddress — it may be stale if the user switched accounts after connect.
  // All signing, SA derivation, and Permit2 owner must use the same key.
  const walletAccounts = (await eip1193Request({
    method: "eth_accounts",
  })) as string[];
  if (!walletAccounts?.[0])
    throw new Error("No connected wallet account available");
  const eoaAddress = walletAccounts[0].toLowerCase() as `0x${string}`;

  const walletChainHex = (await eip1193Request({
    method: "eth_chainId",
  })) as string;
  const walletChainId = parseInt(walletChainHex, 16);
  if (walletChainId !== chainId) {
    throw Object.assign(
      new Error(
        `Wrong network: wallet is on chain ${walletChainId}, route requires chain ${chainId}. Switch your wallet to the correct network and try again.`
      ),
      { code: "WRONG_CHAIN", walletChainId, requiredChainId: chainId }
    );
  }

  const { client, getSponsorshipRequestId } =
    await createTrustwareSmartAccountClient(
      eoaAddress,
      chainId,
      viemChain,
      eip1193Request,
      paymasterAddress
    );
  const saAddress = client.account.address;
  console.debug("[send] saAddress:", saAddress, "eoaAddress:", eoaAddress);

  // Detect first-time deployment — factory will be included in the UO, so
  // verificationGasLimit and callGasLimit need more headroom.
  const saCode = (await eip1193Request({
    method: "eth_getCode",
    params: [saAddress, "latest"],
  })) as string;
  const isNewAccount = !saCode || saCode === "0x";
  if (isNewAccount)
    console.debug(
      "[send] new account — SA factory deployment will be included in UO"
    );

  type BatchCall = {
    target: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
  };
  let batch: BatchCall[];

  if (isNativeToken(fromToken)) {
    // Native token route: no Permit2 needed. Pass value directly.
    batch = [{ target, data: callData, value }];
  } else {
    // ERC-20 route: pull tokens from EOA via Permit2 SignatureTransfer, then execute.
    const token = fromToken as `0x${string}`;
    const weth = WETH_BY_CHAIN[chainId];
    const swapRouter = UNISWAP_V3_ROUTER[chainId];

    // --- Relay fee strategy (Axelar requires native ETH as msg.value) ---
    // When the route has a non-zero relay fee and the SA doesn't already hold enough ETH,
    // we cover it atomically inside the UserOp batch by swapping a slice of the from-token
    // into ETH. No extra user signature is needed — only the single Permit2 sig below.
    //
    // Special case: if the from-token IS WETH we skip the swap and withdraw directly.
    //
    // The Permit2 amount is expanded to fromAmountWei + amountInMaximum so the SA
    // receives enough tokens to both fund the swap and pay the bridge.
    type RelayFeeStrategy = "none" | "weth-withdraw" | "swap";
    let relayFeeStrategy: RelayFeeStrategy = "none";
    let amountInMaximum = 0n;

    if (value > 0n) {
      const saBalHex = (await eip1193Request({
        method: "eth_getBalance",
        params: [saAddress, "latest"],
      })) as string;
      const saEthBal = BigInt(saBalHex as string);

      console.debug("[send] relay fee check", {
        value: value.toString(),
        saEthBal: saEthBal.toString(),
      });

      if (saEthBal >= value) {
        // SA already holds enough ETH from a prior refund or top-up — nothing extra needed.
        console.debug("[send] SA has enough ETH for relay fee");
      } else if (weth && token.toLowerCase() === weth.toLowerCase()) {
        // from-token IS WETH: pull value extra and withdraw directly — no DEX needed.
        amountInMaximum = value;
        relayFeeStrategy = "weth-withdraw";
        console.debug("[send] relay fee via WETH withdraw", {
          amountInMaximum: value.toString(),
        });
      } else if (weth && swapRouter) {
        // Swap a slice of the from-token → WETH → ETH inside the UserOp.
        // Prefer caller-supplied decimals (most accurate), then fall back to route metadata.
        const fromDecimals: number =
          callerFromDecimals ??
          (
            route.route?.steps?.[0] as
              { action?: { fromToken?: { decimals?: number } } } | undefined
          )?.action?.fromToken?.decimals ??
          (() => {
            throw Object.assign(
              new Error(
                `Cannot estimate relay fee: token decimals unavailable for ${token}. ` +
                  "Provide fromDecimals in the route params."
              ),
              { code: "MISSING_TOKEN_DECIMALS", tokenAddress: token }
            );
          })();
        amountInMaximum = await estimateRelayFeeInToken(
          value,
          fromAmountWei,
          route.finalExchangeRate.fromAmountUSD,
          chainId,
          token,
          fromDecimals
        );
        if (amountInMaximum === 0n) {
          throw Object.assign(
            new Error(
              "Cannot estimate relay fee token amount — ETH price unavailable. Ensure the smart account has native ETH for the bridge relay fee."
            ),
            { code: "RELAY_FEE_ESTIMATE_FAILED" }
          );
        }
        relayFeeStrategy = "swap";
        console.debug("[send] relay fee via in-batch swap", {
          swapRouter,
          weth,
          amountInMaximum: amountInMaximum.toString(),
          valueWei: value.toString(),
        });
      } else {
        throw Object.assign(
          new Error(
            `Chain ${chainId} has no configured swap router. Ensure the smart account has native ETH for the bridge relay fee.`
          ),
          { code: "NO_SWAP_ROUTER" }
        );
      }
    }

    // Total Permit2 amount includes the bridge amount plus any tokens needed for the relay fee swap.
    const totalPermit2Amount = fromAmountWei + amountInMaximum;

    // Check the SA's existing token balance. Refunds from failed swaps/bridges land in the SA,
    // so on a retry the SA may already hold some (or all) of what we need. Only pull the shortfall
    // from the EOA — avoids a redundant EOA approval tx and prevents draining more than necessary.
    const saTokenBalHex = (await eip1193Request({
      method: "eth_call",
      params: [{ to: token, data: encodeErc20BalanceOf(saAddress) }, "latest"],
    })) as string;
    const saTokenBalance =
      saTokenBalHex && saTokenBalHex !== "0x" ? BigInt(saTokenBalHex) : 0n;
    const permitNeeded =
      totalPermit2Amount > saTokenBalance
        ? totalPermit2Amount - saTokenBalance
        : 0n;
    console.debug("[send] SA token balance check", {
      token,
      saTokenBalance: saTokenBalance.toString(),
      totalPermit2Amount: totalPermit2Amount.toString(),
      permitNeeded: permitNeeded.toString(),
    });

    // Build batch: [permit2 pull if needed, relay fee swap (if needed), bridge approve, bridge call]
    batch = [];

    if (permitNeeded > 0n) {
      await ensurePermit2Allowance(
        eip1193Request,
        eoaAddress,
        token,
        permitNeeded
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30-minute window
      const nonce = randomPermit2Nonce();

      console.debug("[send] permit2 params", {
        token,
        amount: permitNeeded.toString(),
        nonce: "0x" + nonce.toString(16),
        deadline: "0x" + deadline.toString(16),
        spender: saAddress,
        owner: eoaAddress,
      });

      const sig = await signPermit2(eip1193Request, {
        chainId,
        token,
        amount: permitNeeded,
        spender: saAddress,
        nonce,
        deadline,
        owner: eoaAddress,
      });

      batch.push({
        target: PERMIT2,
        data: encodePermitTransferFrom(
          token,
          permitNeeded,
          nonce,
          deadline,
          saAddress,
          eoaAddress,
          sig
        ),
      });
    } else {
      console.debug(
        "[send] SA already holds sufficient token balance — skipping Permit2 pull"
      );
    }

    if (relayFeeStrategy === "weth-withdraw") {
      // from-token is WETH: withdraw exactly value wei to convert to ETH.
      batch.push({ target: weth!, data: encodeWethWithdraw(value) });
    } else if (relayFeeStrategy === "swap") {
      // Swap amountInMaximum of from-token → exactly value WETH, then unwrap to ETH.
      // exactOutputSingle only takes what it needs (≤ amountInMaximum), so the SA
      // retains any unused from-tokens for the bridge call.
      batch.push(
        {
          target: token,
          data: encodeErc20Approve(swapRouter!, amountInMaximum),
        },
        {
          target: swapRouter!,
          data: encodeUniswapExactOutputSingle(
            token,
            weth!,
            DEFAULT_POOL_FEE,
            saAddress,
            value,
            amountInMaximum
          ),
        },
        { target: weth!, data: encodeWethWithdraw(value) }
      );
    }

    batch.push(
      { target: token, data: encodeErc20Approve(target, fromAmountWei) },
      { target, data: callData, value }
    );
  }

  // Bundler enforces a verificationGasLimit efficiency floor: actual_preOpGas / limit ≥ 0.4.
  // That means the multiplier must be ≤ 1/0.4 = 2.5×. We use 2× (efficiency ≈ 50%) for all
  // accounts — this holds true regardless of whether the account is new (factory deploy adds
  // gas, but Account Kit's estimator captures that; ratio stays the same). Using 3× violates
  // the floor and is rejected with "-32602 efficiency too low" before simulation even runs.
  // callGasLimit uses 2× for new accounts because first-time storage slot writes cost more;
  // preVerificationGas gets a modest 20% pad for calldata variance.
  const baseOverrides = {
    verificationGasLimit: { multiplier: 2 },
    callGasLimit: { multiplier: isNewAccount ? 2 : 1.5 },
    preVerificationGas: { multiplier: 1.2 },
  };

  // Route bundler-specific RPC calls through the client's transport (not the wallet's
  // eip1193 — MetaMask doesn't support ERC-4337 bundler methods).
  type BundlerClient = {
    request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
  };
  const bundlerReq: BundlerRequest = (method, params = []) =>
    (client as unknown as BundlerClient).request({ method, params });

  // Fetch the fast-tier fee from rundler right before each send attempt so we always
  // use fresh fees (base fee moves block-to-block on L2). Alchemy explicitly recommends
  // calling this before every eth_sendUserOperation — stale fees are the primary cause
  // of pool-accept / builder-reject ghost UOs. Fast tier: 2× base fee, 1.5× priority.
  // Returns undefined on failure so callers fall back to Account Kit's own estimation.
  type GasTier = { maxFeePerGas: string; maxPriorityFeePerGas: string };
  const fetchFreshFees = async (): Promise<
    { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined
  > => {
    try {
      const gasPrice = (await bundlerReq(
        "rundler_getUserOperationGasPrice"
      )) as { slow?: GasTier; standard?: GasTier; fast?: GasTier } | null;
      const tier = gasPrice?.fast ?? gasPrice?.standard ?? gasPrice?.slow;
      if (tier?.maxFeePerGas && tier?.maxPriorityFeePerGas) {
        return {
          maxFeePerGas: BigInt(tier.maxFeePerGas) * 2n,
          maxPriorityFeePerGas: BigInt(tier.maxPriorityFeePerGas) * 2n,
        };
      }
    } catch {
      /* non-fatal */
    }
    return undefined;
  };

  // Send loop (max 5 attempts). Handles:
  //   1. -32602 "replacement underpriced": a prior UO is stuck in the mempool with the same nonce.
  //      Bundler requires >110% of the stuck op's fees. We use 112% to clear the floor.
  //   2. -32000 "precheck failed: maxFeePerGas must be at least X": exact bundler floor.
  //      We use 101% (tiny rounding buffer only).
  //   3. PAYMASTER_UNAVAILABLE: transient sign pipeline timeout — retry after 2s, fresh fees.
  // Gas price is re-fetched fresh on every non-fee-error attempt (Alchemy's recommendation).
  let result: Awaited<ReturnType<typeof client.sendUserOperation>>;
  let nextFee: { maxFee: bigint; maxPriority: bigint } | null = null;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      let feeOverrides:
        { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined;
      if (nextFee !== null) {
        // Fee error on last attempt — use the calculated required fee directly.
        feeOverrides = {
          maxFeePerGas: nextFee.maxFee,
          maxPriorityFeePerGas: nextFee.maxPriority,
        };
      } else {
        // First attempt or paymaster retry — fetch fresh fees from the bundler.
        feeOverrides = await fetchFreshFees();
        console.debug(
          `[send] attempt ${attempt} fresh fees`,
          feeOverrides
            ? {
                maxFeePerGas: feeOverrides.maxFeePerGas.toString(),
                maxPriorityFeePerGas:
                  feeOverrides.maxPriorityFeePerGas.toString(),
              }
            : "unavailable — using AK estimation"
        );
      }
      const overrides = feeOverrides
        ? { ...baseOverrides, ...feeOverrides }
        : baseOverrides;
      result = await client.sendUserOperation({ uo: batch, overrides });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;

      if (isPaymasterUnavailable(err)) {
        console.debug(
          `[send] attempt ${attempt} paymaster unavailable (transient), retrying in 2s`
        );
        await new Promise((r) => setTimeout(r, 2000));
        nextFee = null; // trigger fresh fee fetch on next attempt
        continue;
      }

      const req = extractFeeRequirement(err);
      if (!req) throw err;

      // Anchor next fee on max(bundler-reported floor, what we just sent) then apply the
      // minimum bump the protocol requires for each error type.
      const bumpNumerator = req.isReplacement ? 112n : 101n;
      const prevFee: bigint = nextFee?.maxFee ?? 0n;
      const prevPri: bigint = nextFee?.maxPriority ?? 0n;
      nextFee = {
        maxFee:
          ((req.minFee > prevFee ? req.minFee : prevFee) * bumpNumerator) /
          100n,
        maxPriority:
          ((req.minPriorityFee > prevPri ? req.minPriorityFee : prevPri) *
            bumpNumerator) /
          100n,
      };
      console.debug(
        `[send] attempt ${attempt} fee rejection (isReplacement=${req.isReplacement}) — next fees`,
        {
          maxFee: nextFee.maxFee.toString(),
          maxPriority: nextFee.maxPriority.toString(),
        }
      );
    }
  }
  if (lastErr) throw lastErr;
  result = result!;

  // The bundler accepted it: from here the swap may happen, so it is
  // committed at once rather than after inclusion. Waiting for inclusion
  // first lost the payment whenever the bundle didn't land within the wait.
  const userOpHash = result.hash as string;
  const receipt: UserOpReceiptReport = {
    intentId,
    userOpHash,
    sponsorshipRequestId: getSponsorshipRequestId(),
    eoaAddress,
  };
  const { receiptDelivery, txHash } = await commitAcceptedUserOperation(
    receipt,
    bundlerReq
  );
  return { userOpHash, txHash, intentId, receipt, receiptDelivery };
}
