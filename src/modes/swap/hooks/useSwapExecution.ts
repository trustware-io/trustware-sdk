"use client";
import { useCallback, useRef, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { Trustware } from "src/core";
import { submitReceipt, submitStepReceipt, getStatus } from "src/core/routes";
import { isNotFoundError } from "src/core/http";
import { describeTransactionFailure } from "src/core/failure";
import {
  approvalSatisfied,
  ensureWalletOnChain,
  requiredApprovalAmount,
  waitForApprovalConfirmation,
} from "src/core/tx";
import { getEVMAllowance } from "src/core/sdkRpc";
import {
  isEvmAddress,
  isNativeTokenAddress,
  isZeroAddrLike,
  needsErc20Approval,
  normalizeChainType,
} from "src/widget/helpers/chainHelpers";
import type { BuildRouteResult, ChainDef, Transaction } from "src/types";
import type { SwapTxStatus } from "../types";

const FAST_POLL_MS = 1500;
const SLOW_POLL_MS = 2500;
const TIMEOUT_MS = 5 * 60 * 1000;
// How long to avoid the SA path after a transient failure before retrying.
const SA_COOLDOWN_MS = 30_000;

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

function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const e = err as Record<string, unknown>;
  const code = e?.code ?? (e?.data as Record<string, unknown>)?.code;
  if (code === 4001) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("cancelled")
  );
}

// Approval confirmation lives in core/tx so both the widget and direct
// sendRouteTransaction callers get the same not_found handling.

/**
 * The wallet's current account, asserted to still be the one this execution
 * was planned for.
 *
 * Allowance checks read an address the UI captured when the route was built,
 * but every transaction the flow sends is signed by whatever account the
 * wallet is on at that moment. If the user switches accounts mid-flow the two
 * diverge: an allowance satisfied by the old account would wave through a
 * route transaction the new one never approved. The route and its intent
 * belong to the old account either way, so a switch ends the execution rather
 * than silently re-approving for the new one.
 */
export async function requireActiveAddress(
  wallet: { getAddress: () => Promise<string> } | null | undefined,
  plannedFor: string
): Promise<string> {
  if (!wallet) throw new Error("Wallet not connected. Please reconnect.");
  const active = await wallet.getAddress();
  if (active?.toLowerCase() !== plannedFor?.toLowerCase()) {
    throw new Error(
      "Wallet account changed. Please review and confirm the swap again."
    );
  }
  return active;
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

  // Wall-clock time after which the SA path is available again.
  // 0 = always available. Set to Date.now() + SA_COOLDOWN_MS on transient failure.
  const saFailedUntilRef = useRef(0);

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
            const msg = describeTransactionFailure(tx);
            setState((p) => ({ ...p, txStatus: "error", errorMessage: msg }));
            onError(msg);
            return;
          }
          if (tx.status === "bridging") {
            setState((p) => ({ ...p, txStatus: "bridging" }));
          }
        } catch (err) {
          if (abortRef.current) return;
          // 404 = intent doesn't exist; retrying can never succeed. The
          // pre-receipt window is a 200 {"status":"pending"}, not a 404.
          if (isNotFoundError(err)) {
            clearPolling();
            const msg = "Transaction session expired. Please try again.";
            setState((p) => ({ ...p, txStatus: "error", errorMessage: msg }));
            onError(msg);
            return;
          }
          /* transient error — keep retrying */
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

      // Native assets need no allowance, and neither does anything off EVM:
      // an SPL mint is not an ERC20 contract, so reading an allowance against
      // it fails and the failure used to surface as "Approve <TOKEN>" on a
      // Solana swap that has nothing to approve.
      if (!needsErc20Approval(fromTokenAddress, chainType)) {
        setState((p) => ({ ...p, allowanceStatus: "sufficient" }));
        return;
      }

      const txReq = routeResult.txReq;
      const chainIdStr = String(txReq?.chainId ?? fromChain?.chainId ?? "");
      const amountWei = BigInt(routeResult.route?.estimate?.fromAmount ?? "0");

      // Check what the plan says must be approved, against the spender it
      // names. Inferring the spender from the main transaction's `to` is a
      // guess that mislabels the button whenever the route pulls through a
      // different contract — and every allowance in the plan has to be
      // covered, not just the first.
      const plannedApprovals = routeResult.route?.execution?.approvals ?? [];
      const toCheck = plannedApprovals.length
        ? plannedApprovals.flatMap((a) => {
            const token = a.tokenAddress ?? fromTokenAddress;
            const required = requiredApprovalAmount(
              BigInt(a.amount || "0"),
              amountWei
            );
            // Only an ERC20 has an allowance to read. A plan entry naming
            // anything else (an SPL mint, a Cosmos denom) is not one.
            if (!isEvmAddress(token) || !isEvmAddress(a.spender)) return [];
            return [
              {
                chainId: a.chainId || chainIdStr,
                token,
                spender: a.spender,
                required,
              },
            ];
          })
        : (() => {
            const spender = (txReq?.to ?? txReq?.target) as string | undefined;
            if (!spender) return [];
            return [
              {
                chainId: chainIdStr,
                token: fromTokenAddress,
                spender,
                required: amountWei,
              },
            ];
          })();

      if (toCheck.length === 0 || !chainIdStr || amountWei === 0n) {
        setState((p) => ({ ...p, allowanceStatus: "unknown" }));
        return;
      }

      setState((p) => ({ ...p, allowanceStatus: "checking" }));
      try {
        const results = await Promise.all(
          toCheck.map(async (c) => {
            const { allowance } = await getEVMAllowance({
              chainId: c.chainId,
              tokenAddress: c.token,
              ownerAddress: walletAddress,
              spenderAddress: c.spender,
            });
            return approvalSatisfied(BigInt(allowance || "0"), c.required);
          })
        );
        setState((p) => ({
          ...p,
          allowanceStatus: results.every(Boolean) ? "sufficient" : "needed",
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
        Date.now() >= saFailedUntilRef.current &&
        wallet?.ecosystem === "evm" &&
        wallet.type === "eip1193" &&
        !isNative &&
        !!walletAddress &&
        Number.isFinite(numericChainId);

      if (canUseSA) {
        // Switch to the required chain before SA attempt — SA path does a strict
        // chain check and won't switch itself; skipping this causes WRONG_CHAIN →
        // 30s SA cooldown → EOA fallback even when the paymaster is available.
        if (numericChainId && wallet) {
          try {
            const currentChainId = await wallet.getChainId();
            if (currentChainId !== numericChainId) {
              await wallet.switchChain(numericChainId);
            }
          } catch (switchErr) {
            if (isUserRejection(switchErr)) {
              const msg = mapTxError(switchErr);
              setState((p) => ({
                ...p,
                isSubmitting: false,
                txStatus: "error",
                errorMessage: msg,
              }));
              onError(msg);
              return;
            }
            // Non-rejection switch failure — SA path will validate and fall through naturally
          }
        }
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
          // Non-rejection SA failure: cool down SA path, fall through to EOA immediately
          saFailedUntilRef.current = Date.now() + SA_COOLDOWN_MS;
          setState((p) => ({ ...p, txStatus: "confirming" }));
        }
      }

      // ── EOA path (no sponsorship, or SA fallback) ─────────────────────────────
      try {
        // Every allowance this route needs, in the plan's own order. The
        // plan is authoritative: its entries carry the spender the route
        // will actually pull from, and their positions are the step
        // indices the backend seeded (approvals first, main last), so a
        // receipt can only be attributed correctly by reporting the
        // approval's own index. Falling back to a spender inferred from
        // the main transaction's `to` is a guess — kept only for routes
        // whose plan carries no approvals array, and never reported,
        // because index 0 there is the main step, not an approve.
        const plannedApprovals = routeResult.route?.execution?.approvals ?? [];
        const requiredApprovals: {
          stepIndex: number | null;
          token: `0x${string}`;
          spender: `0x${string}`;
          amountWei: bigint;
          chainId: string;
        }[] = plannedApprovals.length
          ? plannedApprovals.flatMap((a, index) => {
              const token = (a.tokenAddress ?? fromTokenAddress) as
                `0x${string}` | undefined;
              const approvalSpender = a.spender as `0x${string}` | undefined;
              // Same guard as checkAllowance: approve() is an ERC20 call, so
              // a plan entry that doesn't name EVM addresses can't be one.
              if (!isEvmAddress(token) || !isEvmAddress(approvalSpender))
                return [];
              // A planned approval of 0 is the reset-to-zero step USDT-style
              // tokens require before an existing allowance can change —
              // dropping it makes the approve that follows revert.
              const amountWei = requiredApprovalAmount(
                BigInt(a.amount || "0"),
                fromAmountWei
              );
              return [
                {
                  stepIndex: index,
                  token,
                  spender: approvalSpender,
                  amountWei,
                  chainId: a.chainId || chainIdStr,
                },
              ];
            })
          : spender && fromTokenAddress
            ? [
                {
                  stepIndex: null,
                  token: fromTokenAddress as `0x${string}`,
                  spender,
                  amountWei: fromAmountWei,
                  chainId: chainIdStr,
                },
              ]
            : [];

        // Ownership is all-or-nothing. Any plan entry the guard above dropped
        // is one this loop will never grant, so claiming ownership after a
        // drop would silently skip it — sendRouteTransaction gets the whole
        // array instead. A plan with no approvals array is covered by
        // definition; the inferred-spender fallback stands in for it.
        const coversEveryPlannedApproval =
          plannedApprovals.length === 0 ||
          requiredApprovals.length === plannedApprovals.length;

        // When this holds, the loop below owns the approval decision for the
        // whole execution and sendRouteTransaction must not second-guess it:
        // its ensureApprovals re-reads the allowance right after our approve
        // confirms, and a stale read from a different RPC node made it prompt
        // for the same approval twice (BVT-330).
        const ownsApprovals =
          coversEveryPlannedApproval &&
          needsErc20Approval(fromTokenAddress, chainType) &&
          !!walletAddress &&
          !!chainIdStr;

        // Read the account the wallet is actually on, rather than trusting the
        // address captured when the route was built — an allowance read
        // against a stale address says nothing about the account that will
        // sign the route's transaction.
        const activeAddress = ownsApprovals
          ? await requireActiveAddress(wallet, walletAddress as string)
          : undefined;

        for (const required of requiredApprovals) {
          if (!ownsApprovals) break;

          let allowanceWei = 0n;
          try {
            const { allowance } = await getEVMAllowance({
              chainId: required.chainId,
              tokenAddress: required.token,
              ownerAddress: activeAddress as string,
              spenderAddress: required.spender,
            });
            allowanceWei = BigInt(allowance || "0");
          } catch {
            /* treat as 0 */
          }

          if (!approvalSatisfied(allowanceWei, required.amountWei)) {
            setState((p) => ({ ...p, txStatus: "approving" }));

            if (!wallet || wallet.ecosystem !== "evm") {
              throw new Error("EVM wallet required for token approval");
            }

            if (!chainIdStr || chainIdStr === "0") {
              throw new Error("Invalid chain ID for token approval");
            }

            // Be on the approval's own chain before signing, and prove it.
            // A failed switch must abort: sending anyway signs against
            // whatever chain the wallet is still on, where the token address
            // usually holds no code and the approve "succeeds" having granted
            // nothing.
            const targetChain = Number(required.chainId ?? txReq.chainId);
            if (!Number.isFinite(targetChain)) {
              throw new Error("Invalid chain ID for token approval");
            }
            await ensureWalletOnChain(wallet, targetChain);

            // Never grant less than the plan asks for, or the route's own
            // transaction reverts. maxApproval only widens.
            const approveAmount = maxApproval
              ? BigInt(
                  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                )
              : required.amountWei;

            const data = encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [required.spender, approveAmount],
            });

            let approvalHash: `0x${string}`;
            if (wallet.type === "eip1193") {
              const from = await wallet.getAddress();
              const params: Record<string, unknown> = {
                from,
                to: required.token,
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
                to: required.token,
                data,
                value: 0n,
                chainId: Number.isFinite(targetChain) ? targetChain : undefined,
              });
              approvalHash = response.hash as `0x${string}`;
            }

            // Report against this approval's own step index so the backend
            // can tell "approve landed, main never followed" apart from a
            // pre-signature abandon (BVT-299). Skipped when the plan
            // carried no approvals: index 0 is the main step there, and
            // the endpoint rejects non-approve steps.
            // Fire-and-forget: must never block or fail the swap.
            if (required.stepIndex !== null) {
              void submitStepReceipt(
                routeResult.intentId,
                required.stepIndex,
                approvalHash
              ).catch(() => {});
            }

            await waitForApprovalConfirmation(required.chainId, approvalHash);

            setState((p) => ({
              ...p,
              txStatus: "confirming",
              allowanceStatus: "sufficient",
            }));
          }
        }

        // Claiming ownership of the approvals is only safe while the account
        // that granted them is still the active one — the approve above can
        // sit in the wallet for a long time, which is ample room to switch
        // accounts. Re-check immediately before handing the flag over, since
        // that flag is what stops sendRouteTransaction re-verifying itself.
        if (ownsApprovals) {
          await requireActiveAddress(wallet, walletAddress as string);
        }

        const hash = await Trustware.sendRouteTransaction(
          routeResult,
          numericChainId,
          { approvalsEnsured: ownsApprovals }
        );

        // The hash is the point of no return: the swap is on-chain and the
        // screen must reflect that immediately. Reporting the receipt is a
        // separate, best-effort concern — `rateLimitedFetch` has no request
        // timeout and will sit out a server-directed 429 wait, so awaiting it
        // here pinned the progress ring at "confirming" while the transaction
        // was already confirming on-chain. Fire it alongside the poll instead;
        // the status endpoint answers 200 {"status":"pending"} in the
        // pre-receipt window, so polling first is safe.
        setState((p) => ({
          ...p,
          isSubmitting: false,
          txHash: hash,
          intentId: routeResult.intentId,
          txStatus: "processing",
        }));

        startPolling(routeResult.intentId, onSuccess, onError);

        void submitReceipt(routeResult.intentId, hash).catch(() => {});
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
    [fromChain, startPolling]
  );

  const resetSmartAccountFailure = useCallback(() => {
    saFailedUntilRef.current = 0;
  }, []);

  const reset = useCallback(() => {
    clearPolling();
    saFailedUntilRef.current = 0;
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

  return { ...state, execute, reset, checkAllowance, resetSmartAccountFailure };
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
