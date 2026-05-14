import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { encodeFunctionData, erc20Abi } from "viem";

import { Trustware } from "../../../../core";
import {
  estimateEVMGas,
  getEVMAllowance,
  getEVMFeeData,
  getEVMTxStatus,
} from "../../../../core/sdkRpc";
import type { Token, YourTokenData } from "../../../context/DepositContext";
import { useTransactionSubmit } from "../../../hooks";
import {
  getNativeTokenAddress,
  isNativeTokenAddress,
  isZeroAddrLike,
  normalizeAddress,
} from "../../../helpers/chainHelpers";
import { divRoundDown } from "../../../../utils";
import type { BuildRouteResult, ChainDef } from "../../../../types";
import { useGTM } from "../../../../hooks";
import { GTM_ID } from "../../../../constants";

type UseTransactionActionModelArgs = {
  actionErrorMessage: string | null;
  amountWei: bigint;
  isLoadingRoute: boolean;
  parsedAmount: number;
  routeResult: BuildRouteResult | null;
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

function normalizeTokenAddressForCompare(
  chain: ChainDef,
  addr?: string
): string {
  const chainType = (chain.type ?? chain.chainType ?? "").toLowerCase();
  const value = (addr ?? "").trim();
  if (chainType === "solana") return value;
  return value.toLowerCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useTransactionActionModel({
  actionErrorMessage,
  amountWei,
  isLoadingRoute,
  parsedAmount,
  routeResult,
  selectedChain,
  selectedToken,
  walletAddress,
  walletStatus,
}: UseTransactionActionModelArgs) {
  const feeDataCacheRef = useRef<{
    value?: CachedFeeData;
    ts?: number;
    inflight?: Promise<CachedFeeData>;
  }>({});

  const { isSubmitting, submitTransaction } = useTransactionSubmit();
  const { trackEvent } = useGTM(GTM_ID);

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

    return (
      isNativeTokenAddress(address, chainType) ||
      isZeroAddrLike(address, chainType) ||
      normalizeTokenAddressForCompare(selectedChain as ChainDef, address) ===
        normalizeTokenAddressForCompare(
          selectedChain as ChainDef,
          getNativeTokenAddress(chainType)
        )
    );
  }, [chainType, selectedChain, selectedToken?.address]);

  const spender = useMemo(() => {
    const txReq = routeResult?.txReq;
    const addr = (txReq?.to ?? txReq?.target) as `0x${string}` | undefined;
    return addr ?? null;
  }, [routeResult?.txReq]);

  const [allowanceWei, setAllowanceWei] = useState<bigint>(0n);
  const [isReadingAllowance, setIsReadingAllowance] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [gasReservationWei, setGasReservationWei] = useState<bigint>(0n);

  const readAllowance = useCallback(async () => {
    if (
      !isEvm ||
      isNativeSelected ||
      !backendChainId ||
      !walletAddress ||
      !spender ||
      !selectedToken?.address
    ) {
      setAllowanceWei(0n);
      return;
    }

    try {
      setIsReadingAllowance(true);
      const result = await getEVMAllowance({
        chainId: backendChainId,
        tokenAddress: selectedToken.address,
        ownerAddress: walletAddress,
        spenderAddress: spender,
      });
      setAllowanceWei(BigInt(result.allowance || "0"));
    } catch {
      setAllowanceWei(0n);
    } finally {
      setIsReadingAllowance(false);
    }
  }, [
    backendChainId,
    isEvm,
    isNativeSelected,
    selectedToken?.address,
    spender,
    walletAddress,
  ]);

  useEffect(() => {
    void readAllowance();
  }, [readAllowance]);

  const needsApproval =
    isEvm &&
    !isNativeSelected &&
    !!walletAddress &&
    !!spender &&
    amountWei > 0n &&
    allowanceWei < amountWei;

  const waitForApprovalConfirmation = useCallback(
    async (chainId: string, txHash: `0x${string}`) => {
      const timeoutMs = 120000;
      const intervalMs = 2000;
      const started = Date.now();

      while (Date.now() - started < timeoutMs) {
        const status = await getEVMTxStatus({ chainId, txHash });
        if (status.status === "success") {
          return;
        }
        if (status.status === "reverted") {
          throw new Error("Approval transaction reverted");
        }
        await sleep(intervalMs);
      }

      throw new Error("Timed out waiting for approval confirmation");
    },
    []
  );

  const handleApproveExact = useCallback(async () => {
    if (
      isApproving ||
      amountWei <= 0n ||
      !walletAddress ||
      !spender ||
      !selectedToken?.address
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
      const targetChain = Number(
        routeResult?.txReq?.chainId ??
          selectedChain?.chainId ??
          selectedChain?.id
      );
      console.log("[approve] targetChain:", targetChain, {
        txReqChainId: routeResult?.txReq?.chainId,
        selectedChainId: selectedChain?.chainId,
        selectedChainIdAlt: selectedChain?.id,
      });
      if (Number.isFinite(targetChain)) {
        const current = await wallet.getChainId();
        if (current !== targetChain) {
          try {
            await wallet.switchChain(targetChain);
          } catch {
            // user cancellation will be surfaced by the send path
            // throw new Error(
            //   `Please switch to chain ${targetChain} in your wallet before approving.`
            // );
          }
        }
      }

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amountWei],
      });

      let hash: `0x${string}`;
      if (wallet.type === "eip1193") {
        const from = await wallet.getAddress();
        const params: Record<string, unknown> = {
          from,
          to: selectedToken.address as `0x${string}`,
          data,
          value: "0x0",
        };
        if (Number.isFinite(targetChain)) {
          params.chainId = `0x${targetChain.toString(16)}`;
        }
        hash = (await wallet.request({
          method: "eth_sendTransaction",
          params: [params],
        })) as `0x${string}`;
      } else {
        const response = await wallet.sendTransaction({
          to: selectedToken.address as `0x${string}`,
          data,
          value: 0n,
          chainId: Number.isFinite(targetChain) ? targetChain : undefined,
        });
        hash = response.hash;
      }

      if (backendChainId) {
        await waitForApprovalConfirmation(backendChainId, hash);
        await readAllowance();
      } else {
        setAllowanceWei(amountWei);
      }
    } catch {
      // approval failed; caller can retry
    } finally {
      setIsApproving(false);
    }
  }, [
    amountWei,
    backendChainId,
    destinationConfig?.routes.toChain,
    destinationConfig?.routes.toToken,
    isApproving,
    readAllowance,
    routeResult?.txReq?.chainId,
    selectedChain?.axelarChainName,
    selectedChain?.chainId,
    selectedChain?.id,
    selectedChain?.networkName,
    selectedToken?.address,
    selectedToken?.symbol,
    spender,
    trackEvent,
    waitForApprovalConfirmation,
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

  const handleConfirm = useCallback(async () => {
    if (!routeResult) {
      return;
    }
    trackEvent("payment_initiated", {
      from_chain:
        selectedChain?.networkName ??
        selectedChain?.axelarChainName ??
        selectedChain?.chainId,
      from_token: selectedToken?.symbol,
      to_chain: destinationConfig?.routes.toChain,
      to_token: destinationConfig?.routes.toToken,
      domain: window.origin,
    });
    await submitTransaction(routeResult);
  }, [
    destinationConfig?.routes.toChain,
    destinationConfig?.routes.toToken,
    routeResult,
    selectedChain?.axelarChainName,
    selectedChain?.chainId,
    selectedChain?.networkName,
    selectedToken?.symbol,
    submitTransaction,
    trackEvent,
  ]);

  const handleSwipeConfirm = useCallback(async () => {
    if (needsApproval) {
      await handleApproveExact();

      // handleApproveExact() calls readAllowance() internally on success,
      // but allowanceWei is stale in this closure. Re-read directly.
      if (
        !backendChainId ||
        !selectedToken?.address ||
        !walletAddress ||
        !spender
      ) {
        return;
      }

      const freshAllowance = await getEVMAllowance({
        chainId: backendChainId,
        tokenAddress: selectedToken.address,
        ownerAddress: walletAddress,
        spenderAddress: spender,
      })
        .then((r) => BigInt(r.allowance || "0"))
        .catch(() => 0n);

      if (freshAllowance >= amountWei) {
        await handleConfirm();
      }
      return;
    }

    await handleConfirm();
  }, [
    amountWei,
    backendChainId,
    handleApproveExact,
    handleConfirm,
    needsApproval,
    selectedToken?.address,
    spender,
    walletAddress,
  ]);

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
    ].join(":");
  }, [isApproving, needsApproval, selectedChain?.chainId, selectedToken]);

  return {
    canSwipe,
    gasReservationWei,
    handleSwipeConfirm,
    isApproving,
    isReadingAllowance,
    isSubmitting,
    isWalletConnected,
    needsApproval,
    swipeResetKey,
  };
}
