import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { encodeFunctionData, erc20Abi } from "viem";

import { Trustware } from "../../../../core";
import {
  estimateEVMGas,
  getEVMAllowance,
  getEVMFeeData,
} from "../../../../core/sdkRpc";
import {
  approvalSatisfied,
  ensureWalletOnChain,
  waitForApprovalConfirmation,
} from "../../../../core/tx";
import {
  type Token,
  type YourTokenData,
} from "../../../context/DepositContext";
import { useTransactionSubmit } from "../../../hooks";
import {
  isNativeTokenAddress,
  normalizeAddress,
} from "../../../../utils/chains";
import { divRoundDown } from "../../../../utils";
import {
  plannedErc20Approvals,
  type PlannedErc20Approval,
} from "../../../helpers/plannedApprovals";
import type { BuildRouteResult, ChainDef } from "../../../../types";
import { useGTMTracker } from "../../../../hooks";
import type {
  BuiltRoute,
  MaterialRouteChange,
} from "../../../../core/signTimeRoute";
import { ROUTE_CHANGED_TITLE } from "../../../lib/routeChange";
import type { PAYMENT_INITIATED } from "../../../lib/confirmedSend";

type UseTransactionActionModelArgs = {
  actionErrorMessage: string | null;
  amountWei: bigint;
  isLoadingRoute: boolean;
  parsedAmount: number;
  builtRoute: BuiltRoute | null;
  /** Put a route rebuilt at sign time up for review. */
  onRouteRebuilt: (rebuilt: BuiltRoute) => void;
  /** The confirmed route expired before it was sent: fetch a new quote. */
  onRouteExpired: () => void;
  selectedChain: ChainDef | null;
  selectedToken: Token | YourTokenData | null;
  walletAddress: string | null;
  walletStatus: string;
  walletType: "walletconnect" | "other";
};

type CachedFeeData = {
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
};

export function useTransactionActionModel({
  actionErrorMessage,
  amountWei,
  isLoadingRoute,
  parsedAmount,
  builtRoute,
  onRouteRebuilt,
  onRouteExpired,
  selectedChain,
  selectedToken,
  walletAddress,
  walletStatus,
}: UseTransactionActionModelArgs) {
  const routeResult = builtRoute?.result ?? null;
  // Set when a confirmed Solana route came back materially worse from its
  // sign-time rebuild. `sequence` only grows, so every such return resets
  // the swipe, even two in a row.
  const [routeChange, setRouteChange] = useState<{
    route: BuiltRoute;
    change: MaterialRouteChange;
    sequence: number;
  } | null>(null);
  const feeDataCacheRef = useRef<{
    value?: CachedFeeData;
    ts?: number;
    inflight?: Promise<CachedFeeData>;
  }>({});

  const { isSubmitting, signingRetryMessage, submitTransaction } =
    useTransactionSubmit();
  const { trackEvent } = useGTMTracker();

  const destinationConfig = (() => {
    try {
      return Trustware.getConfig();
    } catch {
      return undefined;
    }
  })();

  const chainType = selectedChain?.type ?? selectedChain?.chainType;
  const chainTypeNormalized = (chainType ?? "").toLowerCase();
  const isEvm = chainTypeNormalized === "evm";
  const backendChainId = useMemo(() => {
    const chainRef =
      routeResult?.txReq?.chainId ??
      selectedChain?.networkIdentifier ??
      selectedChain?.chainId ??
      selectedChain?.id;
    if (chainRef == null) return null;
    return String(chainRef);
  }, [
    routeResult?.txReq?.chainId,
    selectedChain?.chainId,
    selectedChain?.id,
    selectedChain?.networkIdentifier,
  ]);

  const isNativeSelected = useMemo(() => {
    const address = selectedToken?.address;
    return !address || isNativeTokenAddress(address, chainType);
  }, [chainType, selectedToken?.address]);

  // What the route's plan says must be approved before its transaction is
  // sent. A sponsored route approves inside its own UserOperation batch
  // (Permit2), so it needs nothing from the EOA here.
  const requiredApprovals = useMemo(
    () =>
      isEvm && !isNativeSelected && !routeResult?.sponsorship
        ? plannedErc20Approvals(routeResult?.route?.execution?.approvals, {
            fromTokenAddress: selectedToken?.address,
            chainId: backendChainId ?? "",
            amountWei,
          })
        : [],
    [
      amountWei,
      backendChainId,
      isEvm,
      isNativeSelected,
      routeResult?.route?.execution?.approvals,
      routeResult?.sponsorship,
      selectedToken?.address,
    ]
  );

  // The planned approvals the wallet's allowances don't yet cover.
  const [unmetApprovals, setUnmetApprovals] = useState<PlannedErc20Approval[]>(
    []
  );
  const [isReadingAllowance, setIsReadingAllowance] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [gasReservationWei, setGasReservationWei] = useState<bigint>(0n);

  const findUnmetApprovals = useCallback(async () => {
    if (!walletAddress) return [];
    const met = await Promise.all(
      requiredApprovals.map(async (approval) => {
        try {
          const { allowance } = await getEVMAllowance({
            chainId: approval.chainId,
            tokenAddress: approval.token,
            ownerAddress: walletAddress,
            spenderAddress: approval.spender,
          });
          return approvalSatisfied(
            BigInt(allowance || "0"),
            approval.amountWei
          );
        } catch {
          // An unreadable allowance is treated as missing: asking for an
          // approve is recoverable, sending a transaction that reverts for
          // want of one is not.
          return false;
        }
      })
    );
    return requiredApprovals.filter((_, index) => !met[index]);
  }, [requiredApprovals, walletAddress]);

  const readAllowance = useCallback(async () => {
    if (requiredApprovals.length === 0) {
      setUnmetApprovals([]);
      return;
    }
    setIsReadingAllowance(true);
    try {
      setUnmetApprovals(await findUnmetApprovals());
    } finally {
      setIsReadingAllowance(false);
    }
  }, [findUnmetApprovals, requiredApprovals.length]);

  useEffect(() => {
    void readAllowance();
  }, [readAllowance]);

  const needsApproval =
    !!walletAddress && amountWei > 0n && unmetApprovals.length > 0;

  const handleApproveExact = useCallback(async () => {
    if (
      isApproving ||
      amountWei <= 0n ||
      !walletAddress ||
      unmetApprovals.length === 0
    ) {
      return;
    }

    const wallet = Trustware.getWallet();
    if (!wallet || wallet.ecosystem !== "evm") {
      return;
    }

    trackEvent("token_approval_initiated", {
      from_chain:
        selectedChain?.networkName ??
        selectedChain?.axelarChainName ??
        selectedChain?.chainId,
      from_token: selectedToken?.symbol,
      to_chain: destinationConfig?.routes.toChain,
      to_token: destinationConfig?.routes.toToken,
      domain: window.origin,
    });

    setIsApproving(true);
    try {
      for (const approval of unmetApprovals) {
        // Be on the approval's own chain before signing, and prove it: an
        // approve signed on another chain hits an address that usually
        // holds no code there and "succeeds" having granted nothing.
        const approvalChain = Number(approval.chainId);
        await ensureWalletOnChain(wallet, approvalChain);

        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [approval.spender, approval.amountWei],
        });

        let hash: `0x${string}`;
        if (wallet.type === "eip1193") {
          const from = await wallet.getAddress();
          hash = (await wallet.request({
            method: "eth_sendTransaction",
            params: [
              {
                from,
                to: approval.token,
                data,
                value: "0x0",
                chainId: `0x${approvalChain.toString(16)}`,
              },
            ],
          })) as `0x${string}`;
        } else {
          const response = await wallet.sendTransaction({
            to: approval.token,
            data,
            value: 0n,
            chainId: approvalChain,
          });
          hash = response.hash;
        }

        await waitForApprovalConfirmation(approval.chainId, hash);
      }
      await readAllowance();
    } catch {
      // approval failed; caller can retry
    } finally {
      setIsApproving(false);
    }
  }, [
    amountWei,
    destinationConfig?.routes.toChain,
    destinationConfig?.routes.toToken,
    isApproving,
    readAllowance,
    selectedChain?.axelarChainName,
    selectedChain?.chainId,
    selectedChain?.networkName,
    selectedToken?.symbol,
    trackEvent,
    unmetApprovals,
    walletAddress,
  ]);

  const getCachedFeeData = useCallback(async () => {
    if (!backendChainId) return {};

    const now = Date.now();
    const cache = feeDataCacheRef.current;
    const cacheTtlMs = 15000;
    if (cache.value && cache.ts && now - cache.ts < cacheTtlMs) {
      return cache.value;
    }

    if (!cache.inflight) {
      cache.inflight = getEVMFeeData({ chainId: backendChainId })
        .then((feeData) => {
          const value = {
            gasPrice: feeData.gasPrice ? BigInt(feeData.gasPrice) : undefined,
            maxFeePerGas: feeData.maxFeePerGas
              ? BigInt(feeData.maxFeePerGas)
              : undefined,
          };
          cache.value = value;
          cache.ts = Date.now();
          return value;
        })
        .finally(() => {
          cache.inflight = undefined;
        });
    }

    return cache.inflight;
  }, [backendChainId]);

  const estimateGasReservationWei = useCallback(async () => {
    if (!isNativeSelected) {
      setGasReservationWei(0n);
      return 0n;
    }

    let gasLimit: bigint | undefined;
    let effectiveGasPrice: bigint | undefined;

    const txReq = routeResult?.txReq;
    const txTo = txReq?.to ?? txReq?.target;

    if (!txReq || txReq.value == null) {
      setGasReservationWei(0n);
      return 0n;
    }

    if (txReq.gasLimit) {
      try {
        gasLimit = BigInt(txReq.gasLimit);
      } catch {
        gasLimit = undefined;
      }
    }

    if (txReq.maxFeePerGas || txReq.gasPrice) {
      try {
        effectiveGasPrice = txReq.maxFeePerGas
          ? BigInt(txReq.maxFeePerGas)
          : txReq.gasPrice
            ? BigInt(txReq.gasPrice)
            : undefined;
      } catch {
        effectiveGasPrice = undefined;
      }
    }

    if (
      !gasLimit &&
      backendChainId &&
      txReq.data &&
      txTo &&
      walletAddress &&
      chainTypeNormalized === "evm"
    ) {
      try {
        const estimate = await estimateEVMGas({
          chainId: backendChainId,
          fromAddress: walletAddress,
          to: txTo,
          data: txReq.data,
          value: txReq.value ?? "0",
        });
        gasLimit = BigInt(estimate.gasLimit);
      } catch {
        gasLimit = undefined;
      }
    }

    if (!effectiveGasPrice) {
      try {
        const feeData = await getCachedFeeData();
        effectiveGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
      } catch {
        effectiveGasPrice =
          feeDataCacheRef.current.value?.maxFeePerGas ??
          feeDataCacheRef.current.value?.gasPrice;
      }
    }

    if (!gasLimit || !effectiveGasPrice) {
      setGasReservationWei(0n);
      return 0n;
    }

    const reservedWei = divRoundDown(gasLimit * effectiveGasPrice * 12n, 10n);
    setGasReservationWei(reservedWei);
    return reservedWei;
  }, [
    backendChainId,
    chainTypeNormalized,
    getCachedFeeData,
    isNativeSelected,
    routeResult?.txReq,
    walletAddress,
  ]);

  useEffect(() => {
    if (routeResult) {
      void estimateGasReservationWei();
    }
  }, [estimateGasReservationWei, routeResult]);

  const [smartAccountFailed, setSmartAccountFailed] = useState(false);

  // Reset fallback flag whenever a new route is built so a fresh route gets
  // another attempt at the sponsored path.
  useEffect(() => {
    setSmartAccountFailed(false);
  }, [routeResult?.intentId]);

  const handleConfirm = useCallback(async () => {
    if (!builtRoute || !routeResult) {
      return;
    }
    // Snapshot now: the event describes what the user confirmed. It's sent
    // only once something is about to be sent, so a confirm that goes back
    // to review (a worse Solana rebuild) reports nothing.
    const paymentParams = {
      from_chain:
        selectedChain?.networkName ??
        selectedChain?.axelarChainName ??
        selectedChain?.chainId,
      from_token: selectedToken?.symbol,
      to_chain: destinationConfig?.routes.toChain,
      to_token: destinationConfig?.routes.toToken,
      domain: window.origin,
    };
    const reportPaymentInitiated = (event: typeof PAYMENT_INITIATED) =>
      trackEvent(event, paymentParams);

    // Silent smart-account sponsored path. Conditions: sponsorship present,
    // wallet is EIP-1193 EVM, ERC-20 token, numeric chain ID available, and
    // the path hasn't already failed once in this session.
    const wallet = Trustware.getWallet();
    const numericChainId = Number(backendChainId);
    if (
      routeResult.sponsorship &&
      !smartAccountFailed &&
      wallet?.ecosystem === "evm" &&
      wallet.type === "eip1193" &&
      !isNativeSelected &&
      walletAddress &&
      Number.isFinite(numericChainId)
    ) {
      let wasRejected = false;
      const sendOverride = async (r: BuildRouteResult) => {
        const mod = await import("../../../../smart-account");
        try {
          const result = await mod.sendRouteAsUserOperation({
            route: r,
            fromToken: (selectedToken?.address ?? "") as string,
            fromAmountWei: amountWei,
            fromDecimals: (selectedToken as { decimals?: number } | null)
              ?.decimals,
            eoaAddress: walletAddress as `0x${string}`,
            chainId: numericChainId,
            // Minimal viem Chain: RPC calls go through our backend bundler proxy,
            // so the http array can be empty — Account Kit only needs id + name.
            viemChain: {
              id: numericChainId,
              name:
                selectedChain?.networkName ??
                selectedChain?.axelarChainName ??
                String(numericChainId),
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: {
                default: {
                  http: [] as unknown as readonly [string, ...string[]],
                },
              },
            },
            eip1193Request: (args) => wallet.request(args),
          });
          // The on-chain hash, not the userOpHash: explorers index only the
          // former, and the error screen links there. The userOp is already
          // committed, so tracking starts whether or not it was seen yet.
          return {
            hash: result.txHash ?? null,
            tracked: {
              report: result.receipt,
              delivery: result.receiptDelivery,
            },
          };
        } catch (e) {
          const msg = String((e as Error)?.message ?? e).toLowerCase();
          wasRejected =
            (e as { code?: number })?.code === 4001 ||
            msg.includes("user rejected") ||
            msg.includes("user denied");
          throw e;
        }
      };

      const outcome = await submitTransaction(
        builtRoute,
        reportPaymentInitiated,
        sendOverride
      );
      if (outcome.kind === "failed" && !wasRejected) {
        // Non-rejection failure: mark as failed so the next retry uses EOA.
        setSmartAccountFailed(true);
      }
      if (outcome.kind === "route_expired") onRouteExpired();
      return;
    }

    const outcome = await submitTransaction(builtRoute, reportPaymentInitiated);
    if (outcome.kind === "route_expired") {
      onRouteExpired();
      return;
    }
    if (outcome.kind === "route_changed") {
      onRouteRebuilt(outcome.rebuilt);
      setRouteChange((previous) => ({
        route: outcome.rebuilt,
        change: outcome.change,
        sequence: (previous?.sequence ?? 0) + 1,
      }));
    }
  }, [
    builtRoute,
    onRouteRebuilt,
    onRouteExpired,
    amountWei,
    backendChainId,
    destinationConfig?.routes.toChain,
    destinationConfig?.routes.toToken,
    isNativeSelected,
    routeResult,
    selectedChain?.axelarChainName,
    selectedChain?.chainId,
    selectedChain?.networkName,
    selectedToken?.address,
    selectedToken?.symbol,
    smartAccountFailed,
    submitTransaction,
    trackEvent,
    walletAddress,
  ]);

  const handleSwipeConfirm = useCallback(async () => {
    if (needsApproval) {
      await handleApproveExact();
      // unmetApprovals in this closure predates the approve; ask again.
      if ((await findUnmetApprovals()).length === 0) {
        await handleConfirm();
      }
      return;
    }

    await handleConfirm();
  }, [findUnmetApprovals, handleApproveExact, handleConfirm, needsApproval]);

  const isWalletConnected = walletStatus === "connected";
  const canSwipe =
    parsedAmount > 0 &&
    !!selectedToken &&
    isWalletConnected &&
    !isLoadingRoute &&
    !isSubmitting &&
    !!routeResult &&
    !actionErrorMessage &&
    !isApproving &&
    !isReadingAllowance;

  const swipeResetKey = useMemo(() => {
    const tokenAddress = selectedToken
      ? normalizeAddress(
          selectedToken.address,
          (selectedToken as YourTokenData | null)?.chainData?.type ??
            (selectedToken as YourTokenData | null)?.chainData?.chainType
        )
      : "no-token";
    const chainId =
      (selectedToken as YourTokenData | null)?.chainData?.chainId ??
      selectedChain?.chainId ??
      "no-chain";

    return [
      tokenAddress,
      chainId,
      needsApproval ? "approval-required" : "ready-to-confirm",
      isApproving ? "approving" : "idle",
      `route-change-${routeChange?.sequence ?? 0}`,
    ].join(":");
  }, [
    isApproving,
    needsApproval,
    routeChange?.sequence,
    selectedChain?.chainId,
    selectedToken,
  ]);

  // Only while the rebuilt route is still the one on review: a route
  // refresh replaces it with one the notice doesn't describe.
  const routeChangedLabel =
    routeChange && routeChange.route === builtRoute
      ? ROUTE_CHANGED_TITLE
      : null;

  return {
    canSwipe,
    gasReservationWei,
    handleSwipeConfirm,
    isApproving,
    isNativeSelected,
    isReadingAllowance,
    isSubmitting,
    isWalletConnected,
    needsApproval,
    routeChangedLabel,
    signingRetryMessage,
    swipeResetKey,
  };
}
