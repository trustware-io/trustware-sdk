import type { Chain } from "viem";
import { submitReceipt } from "../core/routes";
import type { BuildRouteResult } from "../types";
import { createTrustwareSmartAccountClient } from "./client";
import {
  PERMIT2,
  randomPermit2Nonce,
  signPermit2,
  encodePermitTransferFrom,
  encodeErc20Approve,
  encodeErc20Allowance,
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

type FeeRequirement = { minFee: bigint; minPriorityFee: bigint };

// Walks the cause chain looking for a PAYMASTER_UNAVAILABLE code, which means the backend's
// sign pipeline had a transient failure (e.g. elros timeout) — distinct from NO_PAYMASTER
// (404: no deployment exists) which is not retryable.
function isPaymasterUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (e.code === "PAYMASTER_UNAVAILABLE") return true;
  return isPaymasterUnavailable(e.cause);
}

// Account Kit wraps the original bundler error inside a SmartAccountUserOperationExecutionError.
// Walk the full cause chain to find a fee requirement from either:
//   -32602 "replacement underpriced" — bundler provides currentMaxFee/currentMaxPriorityFee in data
//   -32000 "precheck failed: maxFeePerGas is X but must be at least Y" — parse Y from message
function extractFeeRequirement(err: unknown): FeeRequirement | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    code?: unknown;
    message?: unknown;
    data?: unknown;
    cause?: unknown;
  };

  if (e.code === -32602 && e.data && typeof e.data === "object") {
    const d = e.data as Record<string, unknown>;
    if (typeof d.currentMaxFee === "string") {
      const fee = BigInt(d.currentMaxFee);
      const priority =
        typeof d.currentMaxPriorityFee === "string"
          ? BigInt(d.currentMaxPriorityFee)
          : fee;
      return { minFee: fee, minPriorityFee: priority };
    }
  }

  if (e.code === -32000 && typeof e.message === "string") {
    // "precheck failed: maxFeePerGas is 8252770 but must be at least 34104859"
    const m = e.message.match(/must be at least (\d+)/);
    if (m) {
      const fee = BigInt(m[1]);
      return { minFee: fee, minPriorityFee: fee };
    }
  }

  return extractFeeRequirement(e.cause);
}

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
        // Prefer caller-supplied decimals (most accurate). Fall back to route step
        // metadata, then to 18 only for WETH which always has 18 decimals.
        const fromDecimals: number =
          callerFromDecimals ??
          (route.route?.steps?.[0] as { action?: { fromToken?: { decimals?: number } } } | undefined)
            ?.action?.fromToken?.decimals ?? 18
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

    // Ensure EOA has approved Permit2 to pull the full amount. One-time EOA transaction.
    await ensurePermit2Allowance(eip1193Request, eoaAddress, token, totalPermit2Amount);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30-minute window
    const nonce = randomPermit2Nonce();

    console.debug("[send] permit2 params", {
      token,
      amount: totalPermit2Amount.toString(),
      nonce: "0x" + nonce.toString(16),
      deadline: "0x" + deadline.toString(16),
      spender: saAddress,
      owner: eoaAddress,
    });

    const sig = await signPermit2(eip1193Request, {
      chainId,
      token,
      amount: totalPermit2Amount,
      spender: saAddress,
      nonce,
      deadline,
      owner: eoaAddress,
    });

    // Build batch: [permit2 pull, relay fee swap (if needed), bridge approve, bridge call]
    batch = [
      {
        target: PERMIT2,
        data: encodePermitTransferFrom(token, totalPermit2Amount, nonce, deadline, saAddress, eoaAddress, sig),
      },
    ];

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

  // Bundler enforces a verificationGasLimit efficiency floor (actual/limit ≥ 0.4 on Base/Alchemy),
  // so an absolute 1.5M floor is rejected with "efficiency too low". 2× multiplier puts efficiency
  // at ~50%, safely above the floor while still giving the LightAccount factory deploy enough
  // headroom for the AA13 OOG case. Pad callGasLimit + preVerificationGas modestly too — OOG can
  // hit any of the three gas fields, not just verification.
  const baseOverrides = {
    verificationGasLimit: { multiplier: 2 },
    callGasLimit: { multiplier: 1.5 },
    preVerificationGas: { multiplier: 1.2 },
  } as const;

  // Retry loop (max 5 attempts) handles three rejection scenarios:
  //   1. -32602 "replacement underpriced": a prior UserOp is stuck in the mempool with the same
  //      nonce; bundler requires the new op to have ≥110% of the stuck op's fees. Account Kit
  //      wraps this error in SmartAccountUserOperationExecutionError, so we walk the cause chain.
  //   2. -32000 "precheck failed: maxFeePerGas must be at least X": the bundler's own minimum
  //      floor (e.g. ~34 gwei on Base) can exceed the replacement bump from step 1.
  //   3. PAYMASTER_UNAVAILABLE: the backend sign pipeline timed out (elros slow/cold start).
  //      This is transient — retry after a short delay without bumping fees.
  // Each fee retry escalates 30% above max(bundler-reported floor, what-we-just-sent). The
  // "what-we-just-sent" anchor matters: some bundlers keep reporting the original stuck op's
  // fee even after we submit a higher replacement, so escalating only off the bundler value
  // would loop forever sending the same number. Anchoring on our previous send guarantees
  // monotonic increase across attempts.
  let result: Awaited<ReturnType<typeof client.sendUserOperation>>;
  let prevSent: { maxFee: bigint; maxPriority: bigint } | null = null;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const sendMaxFee: bigint | undefined = prevSent
      ? (prevSent.maxFee * 130n) / 100n
      : undefined;
    const sendMaxPriority: bigint | undefined = prevSent
      ? (prevSent.maxPriority * 130n) / 100n
      : undefined;
    try {
      const overrides =
        sendMaxFee !== undefined
          ? {
              ...baseOverrides,
              maxFeePerGas: sendMaxFee,
              maxPriorityFeePerGas: sendMaxPriority!,
            }
          : baseOverrides;
      result = await client.sendUserOperation({ uo: batch, overrides });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;

      // PAYMASTER_UNAVAILABLE = transient backend error (sign pipeline timeout). Retry
      // after a short delay without changing gas — the next attempt re-fetches the signature.
      if (isPaymasterUnavailable(err)) {
        console.debug(
          `[send] attempt ${attempt} paymaster unavailable (transient), retrying in 2s`
        );
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const req = extractFeeRequirement(err);
      if (!req) throw err;

      // Anchor next attempt on max(bundler floor, what-we-just-sent).
      const baseFee: bigint = sendMaxFee ?? 0n;
      const basePri: bigint = sendMaxPriority ?? 0n;
      prevSent = {
        maxFee: req.minFee > baseFee ? req.minFee : baseFee,
        maxPriority:
          req.minPriorityFee > basePri ? req.minPriorityFee : basePri,
      };
      console.debug(
        `[send] attempt ${attempt} fee rejection — next attempt will bump from`,
        {
          maxFee: prevSent.maxFee.toString(),
          maxPriority: prevSent.maxPriority.toString(),
        }
      );
    }
  }
  if (lastErr) throw lastErr;
  result = result!;

  // Wait for the UserOp to land in a block so we can pass the real L1 transaction hash to the
  // backend. The backend's status poller uses this hash to query Squid/LiFi/Axelar — those APIs
  // require a real on-chain txHash, not a UserOp hash.
  let txHash: string;
  try {
    txHash = await client.waitForUserOperationTransaction({ hash: result.hash });
    console.debug("[send] UserOp included", { userOpHash: result.hash, txHash });
  } catch (waitErr) {
    // The SDK's wait timed out. Do one final receipt check in case the UO landed just after
    // the timeout window (avoids a false failure on a slow-but-successful inclusion).
    let finalTxHash: string | undefined;
    try {
      const receipt = await eip1193Request({
        method: "eth_getUserOperationReceipt" as never,
        params: [result.hash],
      }) as { receipt?: { transactionHash?: string } } | null;
      finalTxHash = receipt?.receipt?.transactionHash;
    } catch {
      // ignore — receipt check is best-effort
    }

    if (!finalTxHash) {
      // UO was not included — likely dropped by the bundler. Do NOT submit a receipt using the
      // userOpHash as txHash: that would create a ghost transaction in the backend that can never
      // resolve (Axelar/Squid return 404 for a userOpHash).
      throw Object.assign(
        new Error("Transaction was submitted but not confirmed on-chain. The operation may have been dropped. Please try again."),
        { code: "USEROP_NOT_INCLUDED", userOpHash: result.hash }
      );
    }
    txHash = finalTxHash;
    console.debug("[send] UserOp confirmed via fallback receipt check", { userOpHash: result.hash, txHash });
  }

  await submitReceipt(intentId, txHash, getSponsorshipRequestId());

  return { userOpHash: result.hash, txHash, intentId };
}
