import type { Chain } from "viem";
import { submitReceipt } from "../core/routes";
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
  /** On-chain transaction hash. Populated once the UserOp lands in a block; undefined if
   *  the inclusion wait timed out (the UserOp may still land later). */
  txHash?: string;
  intentId: string;
};

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

  const { client, getSponsorshipRequestId } = await createTrustwareSmartAccountClient(
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
  const saCode = await eip1193Request({
    method: "eth_getCode",
    params: [saAddress, "latest"],
  }) as string;
  const isNewAccount = !saCode || saCode === "0x";
  if (isNewAccount) console.debug("[send] new account — SA factory deployment will be included in UO");

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
        console.debug("[send] relay fee via WETH withdraw", { amountInMaximum: value.toString() });
      } else if (weth && swapRouter) {
        // Swap a slice of the from-token → WETH → ETH inside the UserOp.
        // Prefer caller-supplied decimals (most accurate), then fall back to route metadata.
        const fromDecimals: number =
          callerFromDecimals ??
          (route.route?.steps?.[0] as { action?: { fromToken?: { decimals?: number } } } | undefined)
            ?.action?.fromToken?.decimals ??
          (() => {
            throw Object.assign(
              new Error(
                `Cannot estimate relay fee: token decimals unavailable for ${token}. ` +
                  "Provide fromDecimals in the route params."
              ),
              { code: "MISSING_TOKEN_DECIMALS", tokenAddress: token }
            );
          })()
        amountInMaximum = await estimateRelayFeeInToken(
          value,
          fromAmountWei,
          route.finalExchangeRate.fromAmountUSD,
          chainId,
          token,
          fromDecimals,
        );
        if (amountInMaximum === 0n) {
          throw Object.assign(
            new Error("Cannot estimate relay fee token amount — ETH price unavailable. Ensure the smart account has native ETH for the bridge relay fee."),
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
          new Error(`Chain ${chainId} has no configured swap router. Ensure the smart account has native ETH for the bridge relay fee.`),
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
    const saTokenBalance = saTokenBalHex && saTokenBalHex !== "0x" ? BigInt(saTokenBalHex) : 0n;
    const permitNeeded = totalPermit2Amount > saTokenBalance ? totalPermit2Amount - saTokenBalance : 0n;
    console.debug("[send] SA token balance check", {
      token,
      saTokenBalance: saTokenBalance.toString(),
      totalPermit2Amount: totalPermit2Amount.toString(),
      permitNeeded: permitNeeded.toString(),
    });

    // Build batch: [permit2 pull if needed, relay fee swap (if needed), bridge approve, bridge call]
    batch = [];

    if (permitNeeded > 0n) {
      await ensurePermit2Allowance(eip1193Request, eoaAddress, token, permitNeeded);

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
        data: encodePermitTransferFrom(token, permitNeeded, nonce, deadline, saAddress, eoaAddress, sig),
      });
    } else {
      console.debug("[send] SA already holds sufficient token balance — skipping Permit2 pull");
    }

    if (relayFeeStrategy === "weth-withdraw") {
      // from-token is WETH: withdraw exactly value wei to convert to ETH.
      batch.push({ target: weth!, data: encodeWethWithdraw(value) });
    } else if (relayFeeStrategy === "swap") {
      // Swap amountInMaximum of from-token → exactly value WETH, then unwrap to ETH.
      // exactOutputSingle only takes what it needs (≤ amountInMaximum), so the SA
      // retains any unused from-tokens for the bridge call.
      batch.push(
        { target: token, data: encodeErc20Approve(swapRouter!, amountInMaximum) },
        {
          target: swapRouter!,
          data: encodeUniswapExactOutputSingle(token, weth!, DEFAULT_POOL_FEE, saAddress, value, amountInMaximum),
        },
        { target: weth!, data: encodeWethWithdraw(value) },
      );
    }

    batch.push(
      { target: token, data: encodeErc20Approve(target, fromAmountWei) },
      { target, data: callData, value },
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
  type BundlerClient = { request: (args: { method: string; params: unknown[] }) => Promise<unknown> };
  const bundlerReq = (method: string, params: unknown[] = []) =>
    (client as unknown as BundlerClient).request({ method, params });

  // Fetch the fast-tier fee from rundler right before each send attempt so we always
  // use fresh fees (base fee moves block-to-block on L2). Alchemy explicitly recommends
  // calling this before every eth_sendUserOperation — stale fees are the primary cause
  // of pool-accept / builder-reject ghost UOs. Fast tier: 2× base fee, 1.5× priority.
  // Returns undefined on failure so callers fall back to Account Kit's own estimation.
  type GasTier = { maxFeePerGas: string; maxPriorityFeePerGas: string };
  const fetchFreshFees = async (): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined> => {
    try {
      const gasPrice = await bundlerReq("rundler_getUserOperationGasPrice") as { slow?: GasTier; standard?: GasTier; fast?: GasTier } | null;
      const tier = gasPrice?.fast ?? gasPrice?.standard ?? gasPrice?.slow;
      if (tier?.maxFeePerGas && tier?.maxPriorityFeePerGas) {
        return { maxFeePerGas: BigInt(tier.maxFeePerGas) * 2n, maxPriorityFeePerGas: BigInt(tier.maxPriorityFeePerGas) * 2n };
      }
    } catch { /* non-fatal */ }
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
      let feeOverrides: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined;
      if (nextFee !== null) {
        // Fee error on last attempt — use the calculated required fee directly.
        feeOverrides = { maxFeePerGas: nextFee.maxFee, maxPriorityFeePerGas: nextFee.maxPriority };
      } else {
        // First attempt or paymaster retry — fetch fresh fees from the bundler.
        feeOverrides = await fetchFreshFees();
        console.debug(`[send] attempt ${attempt} fresh fees`, feeOverrides
          ? { maxFeePerGas: feeOverrides.maxFeePerGas.toString(), maxPriorityFeePerGas: feeOverrides.maxPriorityFeePerGas.toString() }
          : "unavailable — using AK estimation");
      }
      const overrides = feeOverrides ? { ...baseOverrides, ...feeOverrides } : baseOverrides;
      result = await client.sendUserOperation({ uo: batch, overrides });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;

      if (isPaymasterUnavailable(err)) {
        console.debug(`[send] attempt ${attempt} paymaster unavailable (transient), retrying in 2s`);
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
        maxFee: (req.minFee > prevFee ? req.minFee : prevFee) * bumpNumerator / 100n,
        maxPriority: (req.minPriorityFee > prevPri ? req.minPriorityFee : prevPri) * bumpNumerator / 100n,
      };
      console.debug(`[send] attempt ${attempt} fee rejection (isReplacement=${req.isReplacement}) — next fees`, {
        maxFee: nextFee.maxFee.toString(),
        maxPriority: nextFee.maxPriority.toString(),
      });
    }
  }
  if (lastErr) throw lastErr;
  result = result!;

  // Poll for receipt via the bundler transport (NOT eip1193 — wallet providers don't support
  // eth_getUserOperationReceipt). Alchemy's builder drops ghost ops immediately; accepted ops
  // land within 2-5 seconds on Base. We poll every 3s for up to 45s, then give up and throw
  // USEROP_NOT_INCLUDED — this is far faster than Account Kit's 60-100s wait and avoids the
  // "4 polls then connection timeout" pattern that comes from its internal polling loop.
  const userOpHash = result.hash as string;
  let txHash: string | undefined;
  {
    const pollInterval = 3_000;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      try {
        const r = await bundlerReq("eth_getUserOperationReceipt", [userOpHash]) as { receipt?: { transactionHash?: string } } | null;
        if (r?.receipt?.transactionHash) {
          txHash = r.receipt.transactionHash;
          break;
        }
      } catch { /* bundler hiccup — keep polling */ }
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await new Promise((res) => setTimeout(res, Math.min(pollInterval, remaining)));
    }
  }

  if (!txHash) {
    // Pool accepted the UO (we got a hash) but the builder dropped it — common when maxFeePerGas
    // is below the builder's inclusion floor even after pool acceptance. Do NOT submit using the
    // userOpHash as txHash: Squid/LiFi/Axelar return 404 for a userOpHash.
    throw Object.assign(
      new Error("Transaction was submitted but not included on-chain. The operation was likely dropped by the bundler — please try again."),
      { code: "USEROP_NOT_INCLUDED", userOpHash }
    );
  }
  console.debug("[send] UserOp included", { userOpHash, txHash });

  await submitReceipt(intentId, txHash!, getSponsorshipRequestId());

  return { userOpHash, txHash: txHash!, intentId };
}
