/* core/tx.ts */
import type { BuildRouteResult } from "../types";
import { walletManager } from "../wallets/";
import { buildRoute, submitReceipt, pollStatus } from "./routes";

function isUserRejected(e: any): boolean {
  const code = e?.code ?? e?.data?.code;
  if (code === 4001) return true;
  const msg = String(e?.message || e)?.toLowerCase?.() || "";
  return msg.includes("user rejected") || msg.includes("user denied");
}

export async function sendRouteTransaction(
  b: BuildRouteResult,
  fallbackChainId?: number
): Promise<`0x${string}`> {
  const w = walletManager.wallet;
  if (!w) throw new Error("Trustware.wallet not configured");
  const tr = b.route.transactionRequest;
  const to = tr.to as `0x${string}`;
  const data = tr.data as `0x${string}`;
  const value = tr.value ? BigInt(tr.value) : 0n;

  const target = Number(tr.chainId ?? fallbackChainId);
  if (Number.isFinite(target)) {
    const current = await w.getChainId();
    if (current !== target) {
      try {
        await w.switchChain(target);
      } catch (e) {
        console.warn("switchChain failed / skipped:", e);
      }
    }
  }

  if (w.type === "eip1193") {
    const from = await w.getAddress();
    const hexValue = value ? `0x${value.toString(16)}` : "0x0";
    const params: any = { from, to, data, value: hexValue };
    if (Number.isFinite(target)) params.chainId = `0x${target!.toString(16)}`;

    const hash = await w.request({
      method: "eth_sendTransaction",
      params: [params],
    });
    return hash as `0x${string}`;
  } else {
    const resp = await w.sendTransaction({
      to,
      data,
      value,
      chainId: Number.isFinite(target) ? target : undefined,
    });
    return resp.hash as `0x${string}`;
  }
}

/** One-shot flow that mirrors your old runTopUp */
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

  // lazy import to avoid circular import with Registry users
  const { Registry, NATIVE } = await import("../registry");
  const { apiBase } = await import("./http");

  const reg = new Registry(apiBase());
  await reg.ensureLoaded();

  const fromAddress = await w.getAddress();
  const currentChainId = await w.getChainId();
  const originalChain = currentChainId;

  const fromChain = params.fromChain ?? String(currentChainId);

  // get default toChain/toToken from config
  const { TrustwareConfigStore } = await import("../config/store");
  const cfg = TrustwareConfigStore.get();
  const toChain = params.toChain ?? String(cfg.routes.toChain);

  const fromToken =
    reg.resolveToken(
      fromChain,
      params.fromToken ?? (cfg.routes.fromToken as string) ?? undefined
    ) ?? NATIVE;
  const toToken =
    reg.resolveToken(
      toChain,
      params.toToken ?? (cfg.routes.toToken as string) ?? undefined
    ) ?? NATIVE;

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

    const hash = await sendRouteTransaction(build, Number(fromChain));
    await submitReceipt(build.intentId, hash);
    const tx = await pollStatus(build.intentId);
    return tx;
  } catch (e: any) {
    if (isUserRejected(e)) throw new Error("Transaction cancelled by user");
    throw e;
  } finally {
    try {
      if (originalChain && originalChain !== Number(fromChain)) {
        await w.switchChain(originalChain);
      }
    } catch (swErr) {
      console.warn("switch back skipped:", swErr);
    }
  }
}
