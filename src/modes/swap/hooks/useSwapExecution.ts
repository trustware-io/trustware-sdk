"use client";
import { useCallback, useRef, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { Trustware } from "src/core";
import { submitStepReceipt } from "src/core/routes";
import {
  sendSignableRoute,
  type BuiltRoute,
  type MaterialRouteChange,
} from "src/core/signTimeRoute";
import {
  prepareConfirmedSend,
  type PAYMENT_INITIATED,
} from "src/widget/lib/confirmedSend";
import {
  trackIntent,
  type ReceiptDeliveryOutcome,
} from "src/core/intentTracking";
import type { ReceiptReport } from "src/core/receipt";
import { RouteExpiredError } from "src/core/routeExpiry";
import { describeTrackingFailure } from "src/widget/lib/trackingFailure";
import {
  approvalSatisfied,
  ensureWalletOnChain,
  waitForApprovalConfirmation,
} from "src/core/tx";
import { getEVMAllowance } from "src/core/sdkRpc";
import { needsErc20Approval } from "src/widget/helpers/chainHelpers";
import { plannedErc20Approvals } from "src/widget/helpers/plannedApprovals";
import { isNativeTokenAddress, normalizeChainType } from "src/utils/chains";
import type { BuildRouteResult, ChainDef, Transaction } from "src/types";
import type { SwapTxStatus } from "../types";

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
  /** Set while the wallet is asked to sign a second time because signing
   *  outlasted the Solana blockhash. Shown with that prompt. */
  signingRetryMessage: string | null;
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
    signingRetryMessage: null,
  });

  // Wall-clock time after which the SA path is available again.
  // 0 = always available. Set to Date.now() + SA_COOLDOWN_MS on transient failure.
  const saFailedUntilRef = useRef(0);

  const trackingRef = useRef<AbortController | null>(null);

  const stopTracking = useCallback(() => {
    trackingRef.current?.abort();
    trackingRef.current = null;
  }, []);

  const startTracking = useCallback(
    (
      receipt: ReceiptReport,
      onSuccess: () => void,
      onError: (msg: string) => void,
      /** The send step's own receipt delivery, started at acceptance. */
      receiptDelivery: Promise<ReceiptDeliveryOutcome>
    ) => {
      stopTracking();
      const controller = new AbortController();
      trackingRef.current = controller;

      void trackIntent(receipt, {
        signal: controller.signal,
        receiptDelivery,
        onUpdate: (raw) => {
          const tx = normalizeTx(raw);
          setState((p) => ({
            ...p,
            pollingTx: tx,
            ...(tx.status === "bridging" ? { txStatus: "bridging" } : {}),
          }));
        },
      }).then((outcome) => {
        if (outcome.kind === "aborted") return;
        trackingRef.current = null;
        if (outcome.kind === "success") {
          setState((p) => ({ ...p, txStatus: "success" }));
          onSuccess();
          return;
        }
        const msg = describeTrackingFailure(outcome);
        setState((p) => ({ ...p, txStatus: "error", errorMessage: msg }));
        onError(msg);
      });
    },
    [stopTracking]
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

      // Every allowance the plan names has to be covered, not just the
      // first, and against the spender the plan names. A plan that names
      // none needs none.
      const plannedApprovals = routeResult.route?.execution?.approvals ?? [];
      if (plannedApprovals.length === 0) {
        setState((p) => ({ ...p, allowanceStatus: "sufficient" }));
        return;
      }
      const toCheck = plannedErc20Approvals(plannedApprovals, {
        fromTokenAddress,
        chainId: chainIdStr,
        amountWei,
      });

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
            return approvalSatisfied(BigInt(allowance || "0"), c.amountWei);
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
      reviewed: BuiltRoute,
      fromTokenAddress: string | undefined,
      fromTokenDecimals: number | undefined,
      walletAddress: string | undefined,
      maxApproval: boolean,
      onSuccess: () => void,
      onError: (msg: string) => void,
      /** A Solana route rebuilt at sign time came back materially worse.
       *  Nothing was sent; `rebuilt` needs the user's review. */
      onRouteChanged: (
        rebuilt: BuiltRoute,
        change: MaterialRouteChange
      ) => void,
      /** Something is about to be sent: report `payment_initiated` here. */
      onSendStarting: (event: typeof PAYMENT_INITIATED) => void,
      /** The route's `expiresAt` passed before it was sent. Nothing was
       *  sent; the caller fetches a new quote. */
      onRouteExpired: () => void
    ) => {
      if (!reviewed.result?.txReq) {
        const msg = "Invalid route data. Please try again.";
        setState((p) => ({ ...p, txStatus: "error", errorMessage: msg }));
        onError(msg);
        return;
      }

      // Clear the previous attempt's transaction: the error screen links
      // txHash, and a rejection here must not point at the last swap.
      setState((p) => ({
        ...p,
        isSubmitting: true,
        txStatus: "confirming",
        errorMessage: null,
        txHash: null,
        intentId: null,
        pollingTx: null,
        signingRetryMessage: null,
      }));

      // Rebuilds a Solana route right before signing; its blockhash may
      // have expired while the user read the review screen.
      let decision: Awaited<ReturnType<typeof prepareConfirmedSend>>;
      try {
        decision = await prepareConfirmedSend(reviewed, onSendStarting);
      } catch (err) {
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
      if (decision.kind === "route_changed") {
        setState((p) => ({ ...p, isSubmitting: false, txStatus: "idle" }));
        onRouteChanged(decision.rebuilt, decision.change);
        return;
      }
      const routeResult = decision.route;
      const endExpired = () => {
        setState((p) => ({
          ...p,
          isSubmitting: false,
          txStatus: "idle",
          signingRetryMessage: null,
        }));
        onRouteExpired();
      };

      const wallet = Trustware.getWallet();
      const txReq = routeResult.txReq;
      const numericChainId =
        Number(txReq.chainId ?? fromChain?.chainId) || undefined;
      const chainIdStr = String(txReq.chainId ?? fromChain?.chainId ?? "");
      const chainType = normalizeChainType(fromChain);
      const isNative =
        !fromTokenAddress || isNativeTokenAddress(fromTokenAddress, chainType);
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

          // The on-chain hash, for the explorer link; null until the
          // bundle was seen. The userOp is already committed.
          setState((p) => ({
            ...p,
            isSubmitting: false,
            txHash: result.txHash ?? null,
            intentId: result.intentId,
            txStatus: "processing",
            allowanceStatus: "sufficient",
          }));
          startTracking(
            result.receipt,
            onSuccess,
            onError,
            result.receiptDelivery
          );
          return;
        } catch (err) {
          // Not a smart-account failure: the EOA path would refuse it too.
          if (err instanceof RouteExpiredError) {
            endExpired();
            return;
          }
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
      const acceptance = { tracking: false };
      try {
        // Every allowance this route needs, in the plan's own order. Their
        // positions are the step indices the backend seeded (approvals
        // first, main last), so a receipt is attributed by reporting the
        // approval's own index.
        const plannedApprovals = routeResult.route?.execution?.approvals ?? [];
        const requiredApprovals = plannedErc20Approvals(plannedApprovals, {
          fromTokenAddress,
          chainId: chainIdStr,
          amountWei: fromAmountWei,
        });

        // Ownership is all-or-nothing. Any plan entry that names no EVM
        // token and spender is one this loop will never grant, so claiming
        // ownership after a drop would silently skip it, and
        // sendRouteTransaction gets the whole array instead.
        const coversEveryPlannedApproval =
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
            // pre-signature abandon (BVT-299).
            // Fire-and-forget: must never block or fail the swap.
            void submitStepReceipt(
              routeResult.intentId,
              required.stepIndex,
              approvalHash
            ).catch(() => {});

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

        // The network has it: the swap is on-chain from here, and the
        // screen must say so at once, without waiting for confirmation
        // (a Solana send keeps rebroadcasting until it settles). The send
        // step already posted the receipt, so tracking only polls.
        const sent = await sendSignableRoute(
          reviewed,
          routeResult,
          numericChainId,
          {
            approvalsEnsured: ownsApprovals,
            onRetry: (retry) =>
              setState((p) => ({ ...p, signingRetryMessage: retry.message })),
          },
          (accepted) => {
            acceptance.tracking = true;
            setState((p) => ({
              ...p,
              isSubmitting: false,
              txHash: accepted.hash,
              intentId: accepted.receipt.intentId,
              txStatus: "processing",
              signingRetryMessage: null,
            }));
            startTracking(
              accepted.receipt,
              onSuccess,
              onError,
              accepted.receiptDelivery
            );
          }
        );
        if (sent.kind === "route_changed") {
          setState((p) => ({
            ...p,
            isSubmitting: false,
            txStatus: "idle",
            signingRetryMessage: null,
          }));
          onRouteChanged(sent.rebuilt, sent.change);
          return;
        }

        if (!acceptance.tracking) {
          throw new Error(
            `Intent ${sent.receipt.intentId} was sent without being reported as accepted.`
          );
        }
      } catch (err) {
        // Refused before anything was sent.
        if (err instanceof RouteExpiredError) {
          endExpired();
          return;
        }
        // After acceptance this is the chain's own verdict (it landed with
        // an error, or expired): it replaces the tracker, whose receipt was
        // already delivered.
        if (acceptance.tracking) stopTracking();
        const msg = mapTxError(err);
        setState((p) => ({
          ...p,
          isSubmitting: false,
          txStatus: "error",
          errorMessage: msg,
          signingRetryMessage: null,
        }));
        onError(msg);
      }
    },
    [fromChain, startTracking, stopTracking]
  );

  const resetSmartAccountFailure = useCallback(() => {
    saFailedUntilRef.current = 0;
  }, []);

  const reset = useCallback(() => {
    stopTracking();
    saFailedUntilRef.current = 0;
    setState({
      txStatus: "idle",
      txHash: null,
      intentId: null,
      errorMessage: null,
      pollingTx: null,
      isSubmitting: false,
      allowanceStatus: "unknown",
      signingRetryMessage: null,
    });
  }, [stopTracking]);

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
