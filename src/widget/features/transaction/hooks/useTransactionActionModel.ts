import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createPublicClient, encodeFunctionData, erc20Abi, http } from "viem";

import { Trustware } from "../../../../core";
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
  const gasPriceCacheRef = useRef<{
    value?: bigint;
    ts?: number;
    inflight?: Promise<bigint>;
  }>({});

  const { isSubmitting, submitTransaction } = useTransactionSubmit();

  const chainType = selectedChain?.type ?? selectedChain?.chainType;
  const chainTypeNormalized = (chainType ?? "").toLowerCase();
  const isEvm = chainTypeNormalized === "evm";

  const rpcUrl = useMemo(() => {
    const list = selectedChain?.rpcList;
    if (Array.isArray(list) && list.length > 0) return list[0];
    return selectedChain?.rpc;
  }, [selectedChain?.rpc, selectedChain?.rpcList]);

  const client = useMemo(() => {
    if (!rpcUrl) {
      return null;
    }
    return createPublicClient({
      transport: http(rpcUrl),
    });
  }, [rpcUrl]);

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
      !client ||
      !isEvm ||
      isNativeSelected ||
      !walletAddress ||
      !spender ||
      !selectedToken?.address
    ) {
      setAllowanceWei(0n);
      return;
    }

    try {
      setIsReadingAllowance(true);
      const result = await client.readContract({
        address: selectedToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [walletAddress as `0x${string}`, spender],
      });
      setAllowanceWei((result as unknown as bigint) ?? 0n);
    } catch {
      setAllowanceWei(0n);
    } finally {
      setIsReadingAllowance(false);
    }
  }, [
    client,
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

    setIsApproving(true);
    try {
      const targetChain = Number(
        routeResult?.txReq?.chainId ??
          selectedChain?.chainId ??
          selectedChain?.id
      );
      if (Number.isFinite(targetChain)) {
        const current = await wallet.getChainId();
        if (current !== targetChain) {
          try {
            await wallet.switchChain(targetChain);
          } catch {
            // user cancellation will be surfaced by the send path
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

      if (client) {
        await client.waitForTransactionReceipt({ hash });
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
    client,
    isApproving,
    readAllowance,
    routeResult?.txReq?.chainId,
    selectedChain?.chainId,
    selectedChain?.id,
    selectedToken?.address,
    spender,
    walletAddress,
  ]);

  const estimateGasReservationWei = useCallback(async () => {
    if (!isNativeSelected) {
      setGasReservationWei(0n);
      return 0n;
    }

    let gasLimit: bigint | undefined;
    let effectiveGasPrice: bigint | undefined;

    const txReq = routeResult?.txReq;
    const txTo = txReq?.to ?? txReq?.target;
    const fromAccount = walletAddress as `0x${string}` | undefined;

    if (
      !txReq?.gasLimit ||
      txReq?.value == null ||
      (!txReq?.maxFeePerGas && !txReq?.gasPrice)
    ) {
      setGasReservationWei(0n);
      return 0n;
    }

    if (
      chainTypeNormalized === "evm" &&
      txReq?.data &&
      txTo &&
      client &&
      fromAccount
    ) {
      try {
        gasLimit = await client.estimateGas({
          account: fromAccount,
          to: txTo as `0x${string}`,
          data: txReq.data as `0x${string}`,
          value: txReq.value ? BigInt(txReq.value) : undefined,
        });
      } catch {
        gasLimit = undefined;
      }

      try {
        const now = Date.now();
        const cache = gasPriceCacheRef.current;
        const cacheTtlMs = 15000;

        const getCachedGasPrice = async () => {
          if (cache.value && cache.ts && now - cache.ts < cacheTtlMs) {
            return cache.value;
          }
          if (!cache.inflight) {
            cache.inflight = client
              .getGasPrice()
              .then((price) => {
                cache.value = price;
                cache.ts = Date.now();
                return price;
              })
              .finally(() => {
                cache.inflight = undefined;
              });
          }
          return cache.inflight;
        };

        effectiveGasPrice = txReq.maxFeePerGas
          ? BigInt(txReq.maxFeePerGas)
          : txReq.gasPrice
            ? BigInt(txReq.gasPrice)
            : await getCachedGasPrice();
      } catch {
        effectiveGasPrice = gasPriceCacheRef.current.value ?? undefined;
      }
    }

    if (!gasLimit) {
      try {
        gasLimit = txReq?.gasLimit ? BigInt(txReq.gasLimit) : undefined;
      } catch {
        gasLimit = undefined;
      }
    }

    if (!effectiveGasPrice) {
      try {
        effectiveGasPrice = txReq?.maxFeePerGas
          ? BigInt(txReq.maxFeePerGas)
          : undefined;
      } catch {
        effectiveGasPrice = undefined;
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
    chainTypeNormalized,
    client,
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
    await submitTransaction(routeResult);
  }, [routeResult, submitTransaction]);

  const handleSwipeConfirm = useCallback(async () => {
    if (needsApproval) {
      await handleApproveExact();
      return;
    }
    await handleConfirm();
  }, [handleApproveExact, handleConfirm, needsApproval]);

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
