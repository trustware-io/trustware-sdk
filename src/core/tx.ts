import { assertRouteDeliversValue } from "./routeValue";
import type {
  BuildRouteResult,
  RouteApproval,
  RouteSponsorship,
} from "../types";
import type { ChainDef, EvmWalletInterface } from "../types";
import { walletManager } from "../wallets/";
import {
  buildRoute,
  submitReceipt,
  submitStepReceipt,
  pollStatus,
  isEvmTxRequest,
  isSerializedSolanaTxRequest,
} from "./routes";
import { getEVMAllowance, getEVMTxStatus } from "./sdkRpc";
import { keccak256, encodeFunctionData, parseAbi } from "viem";

function backendChainId(chain?: ChainDef, fallback?: number | string): string {
  const preferred = chain?.networkIdentifier ?? chain?.chainId ?? chain?.id;
  return String(preferred ?? fallback ?? "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Put the wallet on `target` and confirm it landed there, throwing if not.
 *
 * The confirmation is the point. `switchChain` can silently do nothing — the
 * user dismisses the prompt (4001), a switch is already in flight so the
 * adapter's re-entrancy guard returns early, the wallet has no params for an
 * unknown chain, or it simply ignores the request. Callers used to treat all
 * of that as non-fatal and send anyway, which signs against whichever chain
 * the wallet is still on. That is not a degraded outcome: an approve built for
 * one chain, sent on another, hits a different (often codeless) address, and
 * the EVM reports success for a call to an address with no code. The user
 * spends gas, approves nothing, and the SDK then polls for the hash on a chain
 * that never saw it.
 *
 * A wrong-chain send cannot be undone, so this fails closed.
 */
export async function ensureWalletOnChain(
  wallet: Pick<EvmWalletInterface, "getChainId" | "switchChain">,
  target: number
): Promise<void> {
  // Safe-integer, not merely finite: 1.5 and 1e21 are both finite, and both
  // produce a garbage `0x…` when hex-encoded for wallet_switchEthereumChain.
  if (!Number.isSafeInteger(target) || target <= 0) {
    throw new Error(`Invalid chain id: ${target}`);
  }

  if ((await wallet.getChainId()) === target) return;

  let switchError: unknown;
  try {
    await wallet.switchChain(target);
  } catch (e) {
    switchError = e;
  }

  // Re-read rather than trusting the call to have thrown on failure: the
  // adapters swallow 4001 and the early-return guard resolves without doing
  // anything, so a resolved promise is not evidence the chain changed.
  if ((await wallet.getChainId()) === target) return;

  if (switchError && isUserRejected(switchError)) {
    throw switchError;
  }
  throw new Error(
    `Wallet is on the wrong network. Switch to chain ${target} and try again.`
  );
}

const erc20ApproveAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

async function sendEvmTx(
  w: EvmWalletInterface,
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
    chainId?: number;
  }
): Promise<string> {
  if (w.type === "eip1193") {
    const from = (await w.getAddress()) as `0x${string}`;
    const params: Record<string, unknown> = {
      from,
      to: tx.to,
      data: tx.data,
      value: tx.value ? `0x${tx.value.toString(16)}` : "0x0",
    };
    if (tx.chainId !== undefined) {
      params.chainId = `0x${tx.chainId.toString(16)}`;
    }
    const hash = await w.request({
      method: "eth_sendTransaction",
      params: [params],
    });
    return hash as string;
  }
  const response = await w.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
    chainId: tx.chainId,
  });
  return response.hash as string;
}

/**
 * How long a hash may keep reading `not_found` before we call it absent.
 *
 * A freshly broadcast transaction is legitimately unknown for a moment: the
 * wallet's RPC and the RPC the backend reads are different nodes, so there is
 * real propagation lag. Past this window, though, continued absence means the
 * chain never saw it — and polling the remaining ~100s only delays a failure
 * that has already happened.
 */
const NOT_FOUND_GRACE_MS = 20_000;

/**
 * Poll until a transaction confirms, distinguishing "not on this chain" from
 * "not yet mined".
 *
 * The backend already reports `not_found` separately from `pending`; treating
 * them alike is what turned a wrong-chain send into a silent two-minute wait
 * ending in a generic timeout. Naming the real problem lets the UI say the
 * transaction isn't on the chain it was expected on.
 */
/** Overridable so the polling loop can be exercised without real timers or a
 *  live backend. Production callers pass nothing. */
export type TxConfirmationOptions = {
  readStatus?: (params: {
    chainId: string;
    txHash: string;
  }) => Promise<{ status: string }>;
  timeoutMs?: number;
  intervalMs?: number;
  notFoundGraceMs?: number;
};

async function waitForEvmTxConfirmation(
  chainId: string,
  txHash: string,
  label: string,
  options: TxConfirmationOptions = {}
) {
  const {
    readStatus = getEVMTxStatus,
    timeoutMs = 120_000,
    intervalMs = 2_000,
    notFoundGraceMs = NOT_FOUND_GRACE_MS,
  } = options;

  const started = Date.now();
  let notFoundSince: number | null = null;

  while (Date.now() - started < timeoutMs) {
    const status = await readStatus({ chainId, txHash });
    if (status.status === "success") return;
    if (status.status === "reverted") {
      throw new Error(`${label} transaction reverted`);
    }

    if (status.status === "not_found") {
      notFoundSince ??= Date.now();
      if (Date.now() - notFoundSince >= notFoundGraceMs) {
        throw new Error(
          `${label} transaction ${txHash} was not found on chain ${chainId}. ` +
            `It may have been sent on a different network — check your wallet's ` +
            `selected network and try again.`
        );
      }
    } else {
      // Seen in the mempool: propagation is no longer in question, so a later
      // not_found (reorg, eviction) restarts the grace window rather than
      // inheriting a stale one.
      notFoundSince = null;
    }

    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label.toLowerCase()} confirmation`);
}

export function waitForApprovalConfirmation(
  chainId: string,
  txHash: string,
  options?: TxConfirmationOptions
) {
  return waitForEvmTxConfirmation(chainId, txHash, "Approval", options);
}

/**
 * Grants any ERC20 allowance `route.execution.approvals` says is needed
 * before the route's own transaction can succeed (e.g. bridging from USDC
 * instead of a native asset) — checks current allowance first, only sends
 * approve() when it's actually insufficient, and waits for confirmation
 * before returning so the caller's next transaction doesn't race it.
 * Mirrors the widget's own internal approval flow
 * (src/modes/swap/hooks/useSwapExecution.ts), now available to any direct
 * `sendRouteTransaction` caller too.
 */
/**
 * Anything at or above this is a provider saying "approve everything"
 * rather than naming a real amount — 2^255, far beyond any token supply.
 */
const UNLIMITED_APPROVAL_FLOOR = 1n << 255n;

/**
 * How much allowance this approval really needs.
 *
 * Providers routinely plan an unlimited approve (Khalani returns 2^256-1)
 * even though the route only ever pulls the trade amount. Requesting that
 * verbatim asks the user for an unlimited allowance they did not opt into,
 * and checking against it treats an adequate exact-amount allowance as
 * missing — which is what produced a duplicate approve on every ERC20 swap.
 * An unlimited plan amount is therefore sized down to the route's own
 * amount; a plan that names a real amount is honoured as-is.
 */
export function requiredApprovalAmount(
  planAmountWei: bigint,
  routeAmountWei?: bigint
): bigint {
  if (
    planAmountWei >= UNLIMITED_APPROVAL_FLOOR &&
    routeAmountWei !== undefined &&
    routeAmountWei > 0n
  ) {
    return routeAmountWei;
  }
  return planAmountWei;
}

/**
 * Whether the current allowance already satisfies a planned approval.
 *
 * A required amount of 0 is a reset-to-zero instruction (USDT-style tokens
 * refuse to move a non-zero allowance to another non-zero value), so it is
 * satisfied only when the allowance is already 0 — the opposite of the
 * "have we got enough?" test every other approval uses.
 */
export function approvalSatisfied(
  currentAllowance: bigint,
  requiredWei: bigint
): boolean {
  if (requiredWei === 0n) return currentAllowance === 0n;
  return currentAllowance >= requiredWei;
}

async function ensureApprovals(
  w: EvmWalletInterface,
  approvals: RouteApproval[] | undefined,
  fallbackChainId?: number,
  /** Intent to report approve step receipts against (BVT-299). The step
   *  index is the approval's position in the plan's approvals array —
   *  the backend seeds its step plan in the same order. */
  intentId?: string,
  /** The route's own source amount, used to size an unlimited plan
   *  approval down to what the trade actually needs. */
  routeAmountWei?: bigint
) {
  if (!approvals || approvals.length === 0) return;
  const owner = await w.getAddress();
  for (const [stepIndex, approval] of approvals.entries()) {
    const spender = approval.spender;
    const tokenAddress = approval.tokenAddress;
    const amount = approval.amount;
    if (!spender || !tokenAddress || !amount) continue;
    const chainId = approval.chainId || String(fallbackChainId ?? "");
    if (!chainId) continue;
    // A planned approval of 0 is not a no-op: it is the reset-to-zero step
    // tokens like USDT require before an existing non-zero allowance can be
    // changed. Skipping it leaves the following approve to revert.
    const amountWei = requiredApprovalAmount(BigInt(amount), routeAmountWei);

    let currentAllowance = 0n;
    try {
      const { allowance } = await getEVMAllowance({
        chainId,
        tokenAddress,
        ownerAddress: owner,
        spenderAddress: spender,
      });
      currentAllowance = BigInt(allowance || "0");
    } catch {
      // Allowance check failed (e.g. an RPC hiccup) — fall through and
      // approve anyway rather than risk sending a transaction we already
      // know would revert.
    }
    if (approvalSatisfied(currentAllowance, amountWei)) continue;

    const data = encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [spender as `0x${string}`, amountWei],
    });
    // Each approval carries its own chainId, which need not match the route's
    // — the caller switched to the route target, not to this. Signing an
    // approve on the wrong chain hits an address that usually holds no code
    // there and "succeeds" having granted nothing, so put the wallet on this
    // approval's chain and confirm before sending.
    const approvalChainId = Number(chainId);
    if (!Number.isSafeInteger(approvalChainId) || approvalChainId <= 0) {
      throw new Error(`Approval has an invalid chain id: ${chainId}`);
    }
    await ensureWalletOnChain(w, approvalChainId);

    const hash = await sendEvmTx(w, {
      to: tokenAddress as `0x${string}`,
      data,
      value: 0n,
      chainId: approvalChainId,
    });
    if (intentId) {
      // Fire-and-forget: the report must never block or fail the payment
      // flow; the backend's reaper self-heals a missed one.
      void submitStepReceipt(intentId, stepIndex, hash).catch(() => {});
    }
    await waitForApprovalConfirmation(chainId, hash);
  }
}

function isUserRejected(e: unknown): boolean {
  const code =
    (e as Record<string, unknown>)?.code ??
    ((e as Record<string, Record<string, unknown>>)?.data?.code as number);
  if (code === 4001) return true;
  const msg = String((e as Error)?.message || e)?.toLowerCase?.() || "";
  return msg.includes("user rejected") || msg.includes("user denied");
}

export type SendRouteTransactionOptions = {
  /**
   * The caller has already run the plan's approval flow (checked allowances,
   * sent any approves, waited for confirmation). Skips the internal
   * ensureApprovals pass entirely — re-reading an allowance immediately
   * after its approve confirms can return pre-block state from a different
   * RPC node, which made the SDK prompt for the same approval twice
   * (BVT-330). Exactly one path must own the approval decision per
   * execution; this flag is how a caller claims that ownership.
   */
  approvalsEnsured?: boolean;
};

export async function sendRouteTransaction(
  b: BuildRouteResult,
  fallbackChainId?: number | string,
  options?: SendRouteTransactionOptions
): Promise<string> {
  // buildRoute already refused a losing route, so one can only arrive here
  // assembled by hand — and signing it is the irreversible step. Refused
  // before the wallet is consulted.
  assertRouteDeliversValue(b.route);

  const w = walletManager.wallet;
  if (!w) throw new Error("Trustware.wallet not configured");

  const txReq = b.txReq;
  if (isEvmTxRequest(txReq)) {
    if (w.ecosystem !== "evm") {
      throw new Error("An EVM wallet is required for this route");
    }

    const to = (txReq.to ?? txReq.target) as `0x${string}`;
    const data = txReq.data as `0x${string}`;
    const value = txReq.value ? BigInt(txReq.value) : 0n;
    const target = Number(txReq.chainId ?? fallbackChainId);

    // Validate sponsorship calldata hash. The backend signs
    // keccak256(route.execution.transaction.data) — if wrapping occurs the
    // paymaster contract will revert on-chain, so we never skip this check.
    let validatedSponsorship: RouteSponsorship | undefined;
    if (b.sponsorship) {
      if (keccak256(data) === b.sponsorship.callDataHash) {
        validatedSponsorship = b.sponsorship;
      }
      // Mismatch: validatedSponsorship stays undefined; tx proceeds without paymaster.
    }

    // An EVM route with no usable chain id cannot be placed on a chain, and
    // sending it would sign against whatever the wallet happens to be on —
    // the failure this guard exists to prevent. Refuse instead of skipping.
    if (!Number.isSafeInteger(target) || target <= 0) {
      throw new Error(
        `Route is missing a usable chain id (got ${String(
          txReq.chainId ?? fallbackChainId
        )}).`
      );
    }
    await ensureWalletOnChain(w, target);

    // A sponsored (Account Kit) route grants its allowance internally via
    // Permit2 — skip the separate approve step entirely in that case.
    // Likewise when the caller already ran the approval flow itself.
    if (!validatedSponsorship && !options?.approvalsEnsured) {
      await ensureApprovals(
        w,
        b.route?.execution?.approvals,
        Number.isFinite(target) ? target : undefined,
        b.intentId,
        BigInt(b.route?.estimate?.fromAmount ?? "0")
      );
    }

    if (w.type === "eip1193") {
      const from = (await w.getAddress()) as `0x${string}`;

      const hexValue = value ? `0x${value.toString(16)}` : "0x0";
      const params: Record<string, unknown> = {
        from,
        to,
        data,
        value: hexValue,
      };
      if (Number.isFinite(target)) {
        params.chainId = `0x${target.toString(16)}`;
      }
      const hash = await w.request({
        method: "eth_sendTransaction",
        params: [params],
      });
      return hash as string;
    }

    // wagmi path — Account Kit wallets pick up paymasterAndData on sendTransaction
    const response = await w.sendTransaction({
      to,
      data,
      value,
      chainId: Number.isFinite(target) ? target : undefined,
      ...(validatedSponsorship
        ? {
            paymasterAndData:
              validatedSponsorship.paymasterAndData as `0x${string}`,
          }
        : {}),
    });
    return response.hash as string;
  }

  if (isSerializedSolanaTxRequest(txReq)) {
    if (w.ecosystem !== "solana") {
      throw new Error("A Solana wallet is required for this route");
    }

    // Only a chain lookup is needed here, so reuse the shared registry (already
    // warmed by useChains/useTokens) and load chains only — a fresh Registry +
    // ensureLoaded() would refetch the full cross-chain token list on every send.
    const { getSharedRegistry } = await import("./registryClient");
    const registry = getSharedRegistry();
    await registry.ensureChainsLoaded();

    const chain = registry.chain(
      String(fallbackChainId ?? txReq.chainId ?? "")
    );
    return w.sendSerializedTransaction(
      txReq.data,
      backendChainId(chain, fallbackChainId ?? txReq.chainId)
    );
  }

  throw new Error("Invalid route transaction payload");
}

export async function runTopUp(params: {
  fromChain?: string;
  toChain?: string;
  fromToken?: string;
  toToken?: string;
  toAddress?: string;
  fromAmount: string | number;
}) {
  const w = walletManager.wallet;
  if (!w) throw new Error("Trustware.wallet not configured");

  const { getSharedRegistry } = await import("./registryClient");

  const reg = getSharedRegistry();
  await reg.ensureLoaded();

  const fromAddress = await w.getAddress();
  const currentChainRef =
    w.ecosystem === "evm"
      ? String(await w.getChainId())
      : ((await w.getChainKey?.()) ?? "solana-mainnet-beta");
  const originalChain =
    w.ecosystem === "evm" ? await w.getChainId() : undefined;

  const fromChain = params.fromChain ?? currentChainRef;

  const { TrustwareConfigStore } = await import("../config/store");
  const cfg = TrustwareConfigStore.get();
  const toChain = params.toChain ?? String(cfg.routes.toChain);

  const fromToken =
    reg.resolveToken(
      fromChain,
      params.fromToken ?? (cfg.routes.fromToken as string) ?? undefined
    ) ?? params.fromToken;
  const toToken =
    reg.resolveToken(
      toChain,
      params.toToken ?? (cfg.routes.toToken as string) ?? undefined
    ) ?? params.toToken;

  if (!fromToken || !toToken) {
    throw new Error("Unable to resolve route tokens");
  }

  try {
    const build = await buildRoute({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount: String(params.fromAmount),
      fromAddress,
      toAddress:
        params.toAddress ??
        cfg.routes.toAddress ??
        (cfg.routes.fromAddress as string | undefined) ??
        fromAddress,
      slippage: cfg.routes.defaultSlippage,
    });

    const hash = await sendRouteTransaction(build, fromChain);
    await submitReceipt(build.intentId, hash);
    return await pollStatus(build.intentId);
  } catch (e: unknown) {
    if (isUserRejected(e)) throw new Error("Transaction cancelled by user");
    throw e;
  } finally {
    try {
      if (
        w.ecosystem === "evm" &&
        originalChain &&
        originalChain !== Number(fromChain)
      ) {
        await w.switchChain(originalChain);
      }
    } catch {
      // switch back skipped — non-fatal
    }
  }
}
