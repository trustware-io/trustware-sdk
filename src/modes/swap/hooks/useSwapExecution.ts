"use client";
import { useCallback, useRef, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { Trustware } from "src/core";
import { submitReceipt, getStatus } from "src/core/routes";
import { getEVMAllowance, getEVMTxStatus } from "src/core/sdkRpc";
import {
  isNativeTokenAddress,
  isZeroAddrLike,
  normalizeChainType,
} from "src/widget/helpers/chainHelpers";
import type { BuildRouteResult, ChainDef, Transaction } from "src/types";
import type { SwapTxStatus } from "../types";

const FAST_POLL_MS = 1500;
const SLOW_POLL_MS = 2500;
const TIMEOUT_MS = 5 * 60 * 1000;

// The API returns snake_case but Transaction type is camelCase — normalize both forms.
function normalizeTx(raw: Transaction): Transaction {
  const r = raw as unknown as Record<string, unknown>;
  return {
    ...raw,
    sourceTxHash:
      (r.sourceTxHash as string) || (r.source_tx_hash as string) || "",
    destTxHash: (r.destTxHash as string) || (r.dest_tx_hash as string) || "",
    fromChainTxUrl:
      (r.fromChainTxUrl as string) ||
      (r.from_chain_tx_url as string) ||
      undefined,
    toChainTxUrl:
      (r.toChainTxUrl as string) || (r.to_chain_tx_url as string) || undefined,
  };
}

export type AllowanceStatus = "unknown" | "checking" | "needed" | "sufficient";

export type SwapExecutionState = {
  txStatus: SwapTxStatus;
  txHash: string | null;
  intentId: string | null;
  errorMessage: string | null;
  pollingTx: Transaction | null;
  isSubmitting: boolean;
  allowanceStatus: AllowanceStatus;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: number })?.code;
  if (code === 4001) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("cancelled")
  );
}

async function waitForApprovalConfirmation(
  chainId: string,
  txHash: `0x${string}`
) {
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    const status = await getEVMTxStatus({ chainId, txHash });
    if (status.status === "success") return;
    if (status.status === "reverted")
      throw new Error("Approval transaction reverted");
    await sleep(2_000);
  }
  throw new Error("Timed out waiting for approval confirmation");
}

export function useSwapExecution(fromChain: ChainDef | null) {
  const [state, setState] = useState<SwapExecutionState>({
    txStatus: "idle",
    txHash: null,
    intentId: null,
    errorMessage: null,
    pollingTx: null,
    isSubmitting: false,
    allowanceStatus: "unknown",
  });

  // Tracks whether the SA path failed non-rejection this session.
  // When true the next execute() call skips directly to EOA.
  const [smartAccountFailed, setSmartAccountFailed] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);
  const pollCountRef = useRef(0);

  const clearPolling = useCallback(() => {
    abortRef.current = true;
    if (pollingRef.current) clearTimeout(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollingRef.current = null;
    timeoutRef.current = null;
  }, []);

  const startPolling = useCallback(
    (
      intentIdVal: string,
      onSuccess: () => void,
      onError: (msg: string) => void
    ) => {
      clearPolling();
      abortRef.current = false;
      pollCountRef.current = 0;

      timeoutRef.current = setTimeout(() => {
        if (abortRef.current) return;
        clearPolling();
        const msg =
          "Transaction is taking longer than expected. Please check your block explorer.";
        setState((p) => ({ ...p, txStatus: "error", errorMessage: msg }));
        onError(msg);
      }, TIMEOUT_MS);

      const poll = async () => {
        if (abortRef.current) return;
        try {
          const tx = normalizeTx(await getStatus(intentIdVal));
          if (abortRef.current) return;
          setState((p) => ({ ...p, pollingTx: tx }));
          if (tx.status === "success") {
            clearPolling();
            setState((p) => ({ ...p, txStatus: "success" }));
            onSuccess();
            return;
          }
          if (tx.status === "failed") {
            clearPolling();
            const msg = "Transaction failed on-chain. Please try again.";
            setState((p) => ({ ...p, txStatus: "error", errorMessage: msg }));
            onError(msg);
            return;
          }
          if (tx.status === "bridging") {
            setState((p) => ({ ...p, txStatus: "bridging" }));
          }
        } catch {
          /* keep retrying */
        }

        if (abortRef.current) return;
        pollCountRef.current += 1;
        const interval =
          pollCountRef.current <= 10 ? FAST_POLL_MS : SLOW_POLL_MS;
        pollingRef.current = setTimeout(poll, interval);
      };

      poll();
    },
    [clearPolling]
  );

  // Check allowance upfront so the review button shows the right label before execute() is called.
  const checkAllowance = useCallback(
    async (params: {
      fromTokenAddress: string;
      walletAddress: string;
      routeResult: BuildRouteResult;
    }) => {
      const { fromTokenAddress, walletAddress, routeResult } = params;

      // SA path handles approval internally via Permit2 — no separate approve step
      if (routeResult.sponsorship) {
        setState((p) => ({ ...p, allowanceStatus: "sufficient" }));
        return;
      }

      const chainType = normalizeChainType(fromChain);
      const isNative =
        !fromTokenAddress ||
        isNativeTokenAddress(fromTokenAddress, chainType) ||
        isZeroAddrLike(fromTokenAddress, chainType);

      if (isNative) {
        setState((p) => ({ ...p, allowanceStatus: "sufficient" }));
        return;
      }

      const txReq = routeResult.txReq;
      const chainIdStr = String(txReq?.chainId ?? fromChain?.chainId ?? "");
      const spender = (txReq?.to ?? txReq?.target) as string | undefined;
      const amountWei = BigInt(routeResult.route?.estimate?.fromAmount ?? "0");

      if (!spender || !chainIdStr || amountWei === 0n) {
        setState((p) => ({ ...p, allowanceStatus: "unknown" }));
        return;
      }

      setState((p) => ({ ...p, allowanceStatus: "checking" }));
      try {
        const { allowance } = await getEVMAllowance({
          chainId: chainIdStr,
          tokenAddress: fromTokenAddress,
          ownerAddress: walletAddress,
          spenderAddress: spender,
        });
        const allowanceWei = BigInt(allowance || "0");
        setState((p) => ({
          ...p,
          allowanceStatus: allowanceWei >= amountWei ? "sufficient" : "needed",
        }));
      } catch {
        setState((p) => ({ ...p, allowanceStatus: "needed" }));
      }
    },
    [fromChain]
  );

  const execute = useCallback(
    async (
      routeResult: BuildRouteResult,
      fromTokenAddress: string | undefined,
      fromTokenDecimals: number | undefined,
      walletAddress: string | undefined,
      maxApproval: boolean,
      onSuccess: () => void,
      onError: (msg: string) => void
    ) => {
      if (!routeResult?.txReq) {
        const msg = "Invalid route data. Please try again.";
        setState((p) => ({ ...p, txStatus: "error", errorMessage: msg }));
        onError(msg);
        return;
      }

      setState((p) => ({
        ...p,
        isSubmitting: true,
        txStatus: "confirming",
        errorMessage: null,
      }));

      const wallet = Trustware.getWallet();
      const txReq = routeResult.txReq;
      const numericChainId =
        Number(txReq.chainId ?? fromChain?.chainId) || undefined;
      const chainIdStr = String(txReq.chainId ?? fromChain?.chainId ?? "");
      const spender = (txReq.to ?? txReq.target) as `0x${string}` | undefined;
      const chainType = normalizeChainType(fromChain);
      const isNative =
        !fromTokenAddress ||
        isNativeTokenAddress(fromTokenAddress, chainType) ||
        isZeroAddrLike(fromTokenAddress, chainType);
      const fromAmountWei = BigInt(
        routeResult.route?.estimate?.fromAmount ?? "0"
      );

      // ── Smart Account path (UserOp + Permit2, gas sponsored) ─────────────────
      // Mirrors deposit mode's handleConfirm exactly: same conditions, same import,
      // same viemChain minimal shape, same fallback-on-non-rejection pattern.
      const canUseSA =
        !!routeResult.sponsorship &&
        !smartAccountFailed &&
        wallet?.ecosystem === "evm" &&
        wallet.type === "eip1193" &&
        !isNative &&
        !!walletAddress &&
        Number.isFinite(numericChainId);

      if (canUseSA) {
        try {
          const mod = await import("src/smart-account");
          const result = await mod.sendRouteAsUserOperation({
            route: routeResult,
            fromToken: (fromTokenAddress ?? "") as string,
            fromAmountWei,
            fromDecimals: fromTokenDecimals,
            eoaAddress: walletAddress as `0x${string}`,
            chainId: numericChainId!,
            // Minimal viem Chain — RPC calls go through the backend bundler proxy,
            // so http can be empty. Account Kit only needs id + name.
            viemChain: {
              id: numericChainId!,
              name:
                (
                  fromChain as {
                    networkName?: string;
                    axelarChainName?: string;
                    name?: string;
                  } | null
                )?.networkName ??
                (
                  fromChain as {
                    networkName?: string;
                    axelarChainName?: string;
                    name?: string;
                  } | null
                )?.axelarChainName ??
                String(numericChainId),
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: {
                default: {
                  http: [] as unknown as readonly [string, ...string[]],
                },
              },
            },
            eip1193Request: (args) => wallet!.request(args),
          });

          // submitReceipt is called inside sendRouteAsUserOperation
          setState((p) => ({
            ...p,
            isSubmitting: false,
            txHash: result.txHash ?? result.userOpHash,
            intentId: result.intentId,
            txStatus: "processing",
            allowanceStatus: "sufficient",
          }));
          startPolling(result.intentId, onSuccess, onError);
          return;
        } catch (err) {
          if (isUserRejection(err)) {
            const msg = mapTxError(err);
            setState((p) => ({
              ...p,
              isSubmitting: false,
              txStatus: "error",
              errorMessage: msg,
            }));
            onError(msg);
            return;
          }
          // Non-rejection SA failure: mark failed, fall through to EOA immediately
          setSmartAccountFailed(true);
          setState((p) => ({ ...p, txStatus: "confirming" }));
        }
      }

      // ── EOA path (no sponsorship, or SA fallback) ─────────────────────────────
      try {
        if (
          !isNative &&
          walletAddress &&
          spender &&
          chainIdStr &&
          fromTokenAddress
        ) {
          let allowanceWei = 0n;
          try {
            const { allowance } = await getEVMAllowance({
              chainId: chainIdStr,
              tokenAddress: fromTokenAddress,
              ownerAddress: walletAddress,
              spenderAddress: spender,
            });
            allowanceWei = BigInt(allowance || "0");
          } catch {
            /* treat as 0 */
          }

          if (allowanceWei < fromAmountWei) {
            setState((p) => ({ ...p, txStatus: "approving" }));

            if (!wallet || wallet.ecosystem !== "evm") {
              throw new Error("EVM wallet required for token approval");
            }

            // Switch to correct chain first
            const targetChain = Number(txReq.chainId ?? fromChain?.chainId);
            if (Number.isFinite(targetChain)) {
              const current = await wallet.getChainId();
              if (current !== targetChain) {
                try {
                  await wallet.switchChain(targetChain);
                } catch {
                  /* non-fatal */
                }
              }
            }

            const approveAmount = maxApproval
              ? BigInt(
                  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                )
              : fromAmountWei;

            const data = encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [spender, approveAmount],
            });

            let approvalHash: `0x${string}`;
            if (wallet.type === "eip1193") {
              const from = await wallet.getAddress();
              const params: Record<string, unknown> = {
                from,
                to: fromTokenAddress as `0x${string}`,
                data,
                value: "0x0",
              };
              if (Number.isFinite(targetChain)) {
                params.chainId = `0x${targetChain.toString(16)}`;
              }
              approvalHash = (await wallet.request({
                method: "eth_sendTransaction",
                params: [params],
              })) as `0x${string}`;
            } else {
              const response = await wallet.sendTransaction({
                to: fromTokenAddress as `0x${string}`,
                data,
                value: 0n,
                chainId: Number.isFinite(targetChain) ? targetChain : undefined,
              });
              approvalHash = response.hash as `0x${string}`;
            }

            if (chainIdStr) {
              await waitForApprovalConfirmation(chainIdStr, approvalHash);
            }

            setState((p) => ({
              ...p,
              txStatus: "confirming",
              allowanceStatus: "sufficient",
            }));
          }
        }

        const hash = await Trustware.sendRouteTransaction(
          routeResult,
          numericChainId
        );

        try {
          await submitReceipt(routeResult.intentId, hash);
        } catch {
          /* non-fatal */
        }

        setState((p) => ({
          ...p,
          isSubmitting: false,
          txHash: hash,
          intentId: routeResult.intentId,
          txStatus: "processing",
        }));

        startPolling(routeResult.intentId, onSuccess, onError);
      } catch (err) {
        const msg = mapTxError(err);
        setState((p) => ({
          ...p,
          isSubmitting: false,
          txStatus: "error",
          errorMessage: msg,
        }));
        onError(msg);
      }
    },
    [fromChain, startPolling, smartAccountFailed]
  );

  const reset = useCallback(() => {
    clearPolling();
    setSmartAccountFailed(false);
    setState({
      txStatus: "idle",
      txHash: null,
      intentId: null,
      errorMessage: null,
      pollingTx: null,
      isSubmitting: false,
      allowanceStatus: "unknown",
    });
  }, [clearPolling]);

  return { ...state, execute, reset, checkAllowance };
}

function mapTxError(err: unknown): string {
  if (!err) return "Transaction failed. Please try again.";
  const rec = err as Record<string, unknown>;
  if (rec?.code === 4001) return "Transaction cancelled in wallet.";
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("cancelled")
  )
    return "Transaction cancelled in wallet.";
  if (lower.includes("wrong network") || lower.includes("wrong chain"))
    return msg;
  if (
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance")
  )
    return "Insufficient funds. Please check your balance.";
  if (lower.includes("gas") || lower.includes("execution reverted"))
    return "Transaction would fail. Try a different amount.";
  return msg.length > 150
    ? msg.slice(0, 147) + "..."
    : msg || "Transaction failed.";
}
