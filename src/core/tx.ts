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

async function waitForTxConfirmation(chainId: string, txHash: string) {
  const timeoutMs = 120_000;
  const intervalMs = 2_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await getEVMTxStatus({ chainId, txHash });
    if (status.status === "success") return;
    if (status.status === "reverted") {
      throw new Error("Approval transaction reverted");
    }
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for approval confirmation");
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
async function ensureApprovals(
  w: EvmWalletInterface,
  approvals: RouteApproval[] | undefined,
  fallbackChainId?: number,
  /** Intent to report approve step receipts against (BVT-299). The step
   *  index is the approval's position in the plan's approvals array —
   *  the backend seeds its step plan in the same order. */
  intentId?: string
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
    const amountWei = BigInt(amount);
    if (amountWei === 0n) continue;

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
    if (currentAllowance >= amountWei) continue;

    const data = encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [spender as `0x${string}`, amountWei],
    });
    const hash = await sendEvmTx(w, {
      to: tokenAddress as `0x${string}`,
      data,
      value: 0n,
      chainId: Number.isFinite(Number(chainId)) ? Number(chainId) : undefined,
    });
    if (intentId) {
      // Fire-and-forget: the report must never block or fail the payment
      // flow; the backend's reaper self-heals a missed one.
      void submitStepReceipt(intentId, stepIndex, hash).catch(() => {});
    }
    await waitForTxConfirmation(chainId, hash);
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

export async function sendRouteTransaction(
  b: BuildRouteResult,
  fallbackChainId?: number | string
): Promise<string> {
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

    if (Number.isFinite(target)) {
      const current = await w.getChainId();
      if (current !== target) {
        try {
          await w.switchChain(target);
        } catch {
          // switchChain failed/skipped — non-fatal
        }
      }
    }

    // A sponsored (Account Kit) route grants its allowance internally via
    // Permit2 — skip the separate approve step entirely in that case.
    if (!validatedSponsorship) {
      await ensureApprovals(
        w,
        b.route?.execution?.approvals,
        Number.isFinite(target) ? target : undefined,
        b.intentId
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
