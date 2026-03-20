import type { BuildRouteResult } from "../types";
import { walletManager } from "../wallets/";
import {
  buildRoute,
  submitReceipt,
  pollStatus,
  isEvmTxRequest,
  isSerializedSolanaTxRequest,
} from "./routes";

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

    if (w.type === "eip1193") {
      const from = await w.getAddress();
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

    const response = await w.sendTransaction({
      to,
      data,
      value,
      chainId: Number.isFinite(target) ? target : undefined,
    });
    return response.hash as string;
  }

  if (isSerializedSolanaTxRequest(txReq)) {
    if (w.ecosystem !== "solana") {
      throw new Error("A Solana wallet is required for this route");
    }

    const { Registry } = await import("../registry");
    const { apiBase } = await import("./http");
    const registry = new Registry(apiBase());
    await registry.ensureLoaded();

    const chain = registry.chain(
      String(fallbackChainId ?? txReq.chainId ?? "")
    );
    const rpcUrl = chain?.rpc ?? chain?.rpcList?.[0];
    return w.sendSerializedTransaction(txReq.data, rpcUrl);
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

  const { Registry } = await import("../registry");
  const { apiBase } = await import("./http");

  const reg = new Registry(apiBase());
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
