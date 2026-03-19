import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles";
import { Chain, useDeposit, YourTokenData } from "../context/DepositContext";
import {
  clampUsdAmount,
  sanitizeAmountInput,
  useAmountConstraints,
  useRouteBuilder,
  UseRouteBuilderOptions,
  useTransactionSubmit,
  useChains,
} from "../hooks";
import {
  TokenSwipePill,
  SwipeToConfirmTokens,
  AmountSlider,
  LoadingSkeleton,
} from "../components";
import {
  divRoundDown,
  formatTokenBalance,
  weiToDecimalString,
} from "src/utils";
import { ChainDef, Trustware, useTrustware } from "src";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import {
  getNativeTokenAddress,
  isNativeTokenAddress,
  isZeroAddrLike,
  normalizeChainKey,
} from "../helpers/chainHelpers";
import { decimalToRaw, rawToDecimal } from "../helpers/tokenAmount";

export interface CryptoPayProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

import { createPublicClient, encodeFunctionData, erc20Abi, http } from "viem";
import { TrustwareError } from "src/errors/TrustwareError";
import { TrustwareErrorCode } from "src/errors/errorCodes";

function normalizeTokenAddressForCompare(
  chain: ChainDef,
  addr?: string
): string {
  const chainType = (chain.type ?? chain.chainType ?? "").toLowerCase();
  const a = (addr ?? "").trim();
  if (chainType === "solana") return a;
  return a.toLowerCase();
}

const SHOW_FEE_SUMMARY = false;

/**
 * CryptoPay confirmation page.
 * Displays transaction summary with fees and allows last-minute token changes.
 * Includes SwipeToConfirmTokens for secure transaction confirmation.
 */
export function CryptoPay({ style }: CryptoPayProps) {
  const {
    amount,
    setAmount,
    selectedToken,
    setSelectedToken,
    selectedChain,
    setSelectedChain,
    walletAddress,
    walletStatus,
    goBack,
    setCurrentStep,
    yourWalletTokens,
    currentStep,
    amountInputMode,
    setAmountInputMode,
  } = useDeposit();
  const config = useTrustwareConfig();
  const { fixedFromAmountString, isFixedAmount, minAmountUsd, maxAmountUsd } =
    useAmountConstraints();
  const routeRefreshMs = useMemo(() => {
    const raw = config.routes?.options?.routeRefreshMs;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [config.routes?.options?.routeRefreshMs]);

  const isReady = useMemo(() => {
    if (
      selectedToken !== null &&
      yourWalletTokens.length > 0 &&
      (selectedToken as YourTokenData)?.chainData !== undefined
    ) {
      return true;
    }
  }, [selectedToken, yourWalletTokens.length]);

  const { chains } = useChains();

  const [isEditing, setIsEditing] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const gasPriceCacheRef = useRef<{
    value?: bigint;
    ts?: number;
    inflight?: Promise<bigint>;
  }>({});

  // Transaction submission hook
  const { isSubmitting, submitTransaction } = useTransactionSubmit();

  const destinationConfig = useMemo(
    () => ({
      dappName: config.messages?.title || "DApp",
      toChain: config.routes.toChain,
      toToken: config.routes.toToken,
      toAddress: config.routes.toAddress,
    }),
    [
      config.messages?.title,
      config.routes.toAddress,
      config.routes.toChain,
      config.routes.toToken,
    ]
  );

  const tokenPriceUSD =
    typeof selectedToken?.usdPrice === "number" &&
    isFinite(selectedToken?.usdPrice) &&
    selectedToken.usdPrice > 0
      ? selectedToken.usdPrice
      : 0;

  const hasUsdPrice =
    typeof tokenPriceUSD === "number" &&
    isFinite(tokenPriceUSD) &&
    tokenPriceUSD > 0;

  useEffect(() => {
    if (fixedFromAmountString) return;
    if (isReady && !hasUsdPrice && amountInputMode === "usd") {
      setAmountInputMode("token");
    }
  }, [
    amountInputMode,
    fixedFromAmountString,
    hasUsdPrice,
    isReady,
    setAmountInputMode,
  ]);

  useEffect(() => {
    if (!fixedFromAmountString) return;
    if (amount !== fixedFromAmountString) {
      setAmount(fixedFromAmountString);
    }
    if (amountInputMode !== "usd") {
      setAmountInputMode("usd");
    }
  }, [
    amount,
    amountInputMode,
    fixedFromAmountString,
    setAmount,
    setAmountInputMode,
  ]);

  const amountComputation = useMemo(() => {
    const rawAmount = (fixedFromAmountString ?? amount)?.trim();
    // if (!rawAmount) {
    //   return {
    //     fromAmountWei: null,
    //     tokenAmount: null,
    //     usdAmount: null,
    //     validationError: "Enter an amount to continue.",
    //   };
    // }

    if (!/^\d*\.?\d*$/.test(rawAmount)) {
      return {
        fromAmountWei: null,
        tokenAmount: null,
        usdAmount: null,
        validationError: "Use numbers only for amount.",
      };
    }

    const tokenDecimals = selectedToken?.decimals ?? 18;
    const parsedAmount = Number(rawAmount);
    if (!isFinite(parsedAmount) || parsedAmount <= 0) {
      return {
        fromAmountWei: null,
        tokenAmount: null,
        usdAmount: null,
        validationError: "Enter an amount greater than 0.",
      };
    }

    if (amountInputMode === "usd") {
      if (!hasUsdPrice) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: rawAmount,
          validationError:
            "USD pricing is unavailable for this token. Switch to token amount mode.",
        };
      }

      if (minAmountUsd != null && parsedAmount < minAmountUsd) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: rawAmount,
          validationError: `Minimum amount is ${minAmountUsd.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )} USD`,
        };
      }
      if (maxAmountUsd != null && parsedAmount > maxAmountUsd) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: rawAmount,
          validationError: `Maximum amount is ${maxAmountUsd.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )} USD`,
        };
      }

      const tokenUnits = parsedAmount / tokenPriceUSD;
      if (!isFinite(tokenUnits) || tokenUnits <= 0) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: rawAmount,
          validationError: "Unable to convert USD to token amount.",
        };
      }

      return {
        fromAmountWei: BigInt(decimalToRaw(String(tokenUnits), tokenDecimals)),
        tokenAmount: String(tokenUnits),
        usdAmount: rawAmount,
        validationError: null,
      };
    }

    if ((minAmountUsd != null || maxAmountUsd != null) && !hasUsdPrice) {
      return {
        fromAmountWei: null,
        tokenAmount: null,
        usdAmount: undefined,
        validationError:
          "USD pricing is unavailable for this token. Switch to USD amount mode.",
      };
    }

    if (hasUsdPrice) {
      const usdValue = parsedAmount * tokenPriceUSD;
      if (minAmountUsd != null && usdValue < minAmountUsd) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: String(usdValue),
          validationError: `Minimum amount is ${minAmountUsd.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )} USD`,
        };
      }
      if (maxAmountUsd != null && usdValue > maxAmountUsd) {
        return {
          fromAmountWei: null,
          tokenAmount: null,
          usdAmount: String(usdValue),
          validationError: `Maximum amount is ${maxAmountUsd.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )} USD`,
        };
      }
    }

    return {
      fromAmountWei: BigInt(decimalToRaw(rawAmount, tokenDecimals)),
      tokenAmount: rawAmount,
      usdAmount: hasUsdPrice ? String(parsedAmount * tokenPriceUSD) : undefined,
      validationError: null,
    };
  }, [
    amount,
    amountInputMode,
    fixedFromAmountString,
    hasUsdPrice,
    maxAmountUsd,
    minAmountUsd,
    selectedToken?.decimals,
    tokenPriceUSD,
  ]);

  const amountWei = amountComputation.fromAmountWei ?? 0n;

  const routeConfig = useMemo(() => {
    const toChainId = config.routes.toChain;
    const toChainKey = normalizeChainKey(toChainId);
    const toChain = toChainKey
      ? (chains.find(
          (chain) => normalizeChainKey(chain.chainId ?? chain.id) === toChainKey
        ) ?? null)
      : null;

    const object: UseRouteBuilderOptions = {
      fromChain: selectedChain?.chainId ?? selectedChain?.id ?? "",
      fromChainId: selectedChain?.chainId ?? selectedChain?.id,
      toChain,
      toChainId,
      toToken: config.routes.toToken,
      toAddress: config.routes.toAddress || walletAddress || undefined,
      fromToken:
        selectedToken?.address ??
        getNativeTokenAddress(selectedChain?.type ?? selectedChain?.chainType),
      fromAmountWei: amountWei ?? 0n,
      fromAmountUsd: amountComputation.usdAmount || undefined,
      fromAddress: walletAddress || undefined,
      refundAddress: walletAddress || undefined,
      slippage: 1,
      refreshMs: routeRefreshMs,
    };

    // console.log("Resolved route config:", {
    //   object,
    //   selectedToken,
    //   selectedChain,
    // });

    return object;
  }, [
    amountComputation.usdAmount,
    amountWei,
    chains,
    config.routes.toAddress,
    config.routes.toChain,
    config.routes.toToken,
    routeRefreshMs,
    selectedChain,
    selectedToken,
    walletAddress,
  ]);

  const {
    isLoadingRoute,
    // networkFees,
    estimatedReceive,
    error: routeBuilderError,
    routeResult,
  } = useRouteBuilder(routeConfig);

  const routePrerequisiteError = useMemo(() => {
    if (!isReady) return;
    // const error = new Map<string, string>();
    if (!selectedChain) {
      // error.set("from_chain", "Select a source chain to fetch a route.");
      return "Select a source chain to fetch a route.";
    }

    if (!selectedToken) {
      // error.set("from_token", "Select a token to fetch a route.");
      return "Select a token to fetch a route.";
    }

    if (!walletAddress) {
      // error.set("from_address", "Connect your wallet to fetch a route.");
      return "Connect your wallet to fetch a route.";
    }
    if (!routeConfig.toAddress) {
      // error.set(
      //   "to_address",
      //   "Destination address missing. Please check widget configuration."
      // );
      return "Destination address missing. Please check widget configuration.";
    }
    if (!amountComputation.fromAmountWei) {
      // error.set("amount_wei", amountComputation.validationError || "");
      return amountComputation.validationError;
    }
    return null;
  }, [
    amountComputation.fromAmountWei,
    amountComputation.validationError,
    isReady,
    routeConfig.toAddress,
    selectedChain,
    selectedToken,
    walletAddress,
  ]);

  // const routeError = routePrerequisiteError || _routeBuilderError;
  const routeError = routeBuilderError && "No successful provider response";

  const { emitError } = useTrustware();

  useEffect(() => {
    if (currentStep != "crypto-pay") return;

    emitError?.(
      new TrustwareError({
        code: TrustwareErrorCode.INPUT_ERROR,
        message: routeError as string,
        userMessage: routeError as string,
        cause: routeError,
      })
    );

    if (routePrerequisiteError || routeBuilderError) {
      void (routePrerequisiteError || routeBuilderError);
    }
  }, [
    currentStep,
    emitError,
    routeBuilderError,
    routeError,
    routePrerequisiteError,
  ]);

  useEffect(() => {
    if (!routePrerequisiteError && amountComputation.fromAmountWei) {
      // Route prerequisites satisfied — route building will proceed
    }
  }, [
    amountComputation.fromAmountWei,
    routeConfig.toAddress,
    routePrerequisiteError,
    selectedChain?.chainId,
    selectedChain?.id,
    selectedToken?.address,
    walletAddress,
  ]);

  const [gasReservationWei, setGasReservationWei] = useState<bigint>(0n);

  const chainType = selectedChain?.type ?? selectedChain?.chainType;
  const chainTypeNormalized = (chainType ?? "").toLowerCase();
  const isEvm = chainTypeNormalized === "evm";
  const rpcUrl = useMemo(() => {
    const list = selectedChain?.rpcList;
    if (Array.isArray(list) && list.length > 0) return list[0];
    return selectedChain?.rpc;
  }, [selectedChain?.rpc, selectedChain?.rpcList]);

  useEffect(() => {
    if (!rpcUrl) {
      // Missing RPC URL for selected chain — on-chain reads may fail
    }
  }, [
    rpcUrl,
    selectedChain?.chainId,
    selectedChain?.id,
    selectedChain?.networkName,
  ]);

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
      const res = await client.readContract({
        address: selectedToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [walletAddress as `0x${string}`, spender],
      });
      setAllowanceWei((res as unknown as bigint) ?? 0n);
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
      !amountWei ||
      amountWei <= 0n ||
      !walletAddress ||
      !spender ||
      !selectedToken?.address
    ) {
      return;
    }

    const wallet = Trustware.getWallet();
    if (!wallet) {
      //toast.error("Wallet not connected", "Connect your wallet to approve.");
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
            // If user cancels, the send below will fail and surface error.
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
        const resp = await wallet.sendTransaction({
          to: selectedToken.address as `0x${string}`,
          data,
          value: 0n,
          chainId: Number.isFinite(targetChain) ? targetChain : undefined,
        });
        hash = resp.hash;
      }

      if (client) {
        await client.waitForTransactionReceipt({ hash });
        await readAllowance();
      } else {
        setAllowanceWei(amountWei);
      }
      //toast.success("Approval confirmed", "You can now confirm the transfer.");
    } catch {
      // Approval failed — user can retry
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
    // if (!routeResult?.txReq?.data || !client || !walletAddress) {
    //   setGasReservationWei(0n);
    //   return 0n;
    // }

    let gasLimit: bigint | undefined;
    let effectiveGasPrice: bigint | undefined;

    // const txReq =
    //   routeResult?. === "ready" ? routeResult.txReq : undefined;
    const txReq = routeResult?.txReq;
    const txTo = txReq?.to ?? txReq?.target;
    const fromAccount = walletAddress as `0x${string}` | undefined;

    // Skip reservation if route doesn't provide essential fields or pricing
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
        const request = {
          account: fromAccount,
          to: txTo as `0x${string}`,
          data: txReq.data as `0x${string}`,
          value: txReq.value ? BigInt(txReq.value) : undefined,
        };
        gasLimit = await client.estimateGas(request);
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
        const cached = gasPriceCacheRef.current.value;
        effectiveGasPrice = cached ?? undefined;
      }
    }

    // fallback: try route/provider gas metadata when available
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
    // console.log({ reservedWei });
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
      estimateGasReservationWei().then(() => {});
    }
  }, [estimateGasReservationWei, routeResult]);

  const parsedAmount = parseFloat(fixedFromAmountString ?? amount) || 0;

  const normalizedTokenBalance = useMemo(() => {
    if (!selectedToken?.balance) return 0;
    const normalized = Number(
      rawToDecimal(selectedToken.balance, selectedToken.decimals ?? 18)
    );
    return Number.isFinite(normalized) ? normalized : 0;
  }, [selectedToken?.balance, selectedToken?.decimals]);

  const maxTokenAmount = useMemo(() => {
    const walletMax = Math.min(normalizedTokenBalance, 10000);
    if (maxAmountUsd == null || !hasUsdPrice || tokenPriceUSD <= 0) {
      return walletMax;
    }
    const maxFromUsd = maxAmountUsd / tokenPriceUSD;
    return Math.min(walletMax, maxFromUsd);
  }, [hasUsdPrice, maxAmountUsd, normalizedTokenBalance, tokenPriceUSD]);

  const maxUsdAmount = useMemo(() => {
    if (!hasUsdPrice) return undefined;
    const walletMaxUsd = Math.min(maxTokenAmount * tokenPriceUSD, 10000);
    if (maxAmountUsd == null) return walletMaxUsd;
    return Math.min(walletMaxUsd, maxAmountUsd);
  }, [hasUsdPrice, maxAmountUsd, maxTokenAmount, tokenPriceUSD]);

  const minAmountForMode = useMemo(() => {
    if (minAmountUsd == null) return 0;
    if (amountInputMode === "usd") {
      return minAmountUsd;
    }
    if (!hasUsdPrice || tokenPriceUSD <= 0) return 0;
    return minAmountUsd / tokenPriceUSD;
  }, [amountInputMode, hasUsdPrice, minAmountUsd, tokenPriceUSD]);

  const sliderMax = amountInputMode === "usd" ? maxUsdAmount : maxTokenAmount;
  const effectiveSliderMax = useMemo(() => {
    if (sliderMax == null || !Number.isFinite(sliderMax)) return undefined;
    return Math.max(sliderMax, 0);
  }, [sliderMax]);

  const effectiveSliderMin = useMemo(() => {
    if (
      effectiveSliderMax == null ||
      !Number.isFinite(effectiveSliderMax) ||
      effectiveSliderMax <= 0
    ) {
      return 0;
    }

    if (minAmountForMode > 0 && minAmountForMode < effectiveSliderMax) {
      return minAmountForMode;
    }

    return 0;
  }, [effectiveSliderMax, minAmountForMode]);

  /**
   * Handle amount input changes with decimal sanitization
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFixedAmount) return;
    const sanitized = sanitizeAmountInput(e.target.value);
    if (amountInputMode === "usd") {
      const clamped = clampUsdAmount(sanitized, minAmountUsd, maxAmountUsd);
      setAmount(clamped);
      return;
    }
    setAmount(sanitized);
  };

  /**
   * Handle click on the amount display to start editing
   */
  const handleAmountClick = () => {
    if (isFixedAmount) return;
    const isZeroish = !amount || parseFloat(amount) === 0;
    setIsEditing(true);
    if (isZeroish) setAmount("");

    setTimeout(() => {
      const input = amountInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, 0);
    }, 0);
  };

  /**
   * Handle slider value change
   */
  const handleSliderChange = (value: number) => {
    if (isFixedAmount) return;
    setAmount(value.toString());
  };

  /**
   * Handle token change from TokenSwipePill
   */
  const handleTokenChange = useCallback(
    async (token: typeof selectedToken) => {
      if (token) {
        setSelectedToken(token);
        setSelectedChain((token as YourTokenData).chainData as Chain);
      }
    },
    [setSelectedChain, setSelectedToken]
  );

  /**
   * Handle expand click to navigate to token selection
   */
  const handleExpandTokens = () => {
    setCurrentStep("select-token");
  };

  /**
   * Handle swipe confirmation - submit transaction to wallet
   */
  const handleConfirm = useCallback(async () => {
    if (!routeResult) {
      // No route result available, show error
      return;
    }

    // Submit the transaction to the wallet for signing
    // The hook handles all state updates (confirming -> processing or error)
    await submitTransaction(routeResult);
  }, [routeResult, submitTransaction]);

  const handleSwipeConfirm = useCallback(async () => {
    if (needsApproval) {
      await handleApproveExact();
      return;
    }
    await handleConfirm();
  }, [handleApproveExact, handleConfirm, needsApproval]);

  const orderedTokens = useMemo(() => {
    const index = yourWalletTokens.findIndex(
      (t) => t.address?.toLowerCase() === selectedToken?.address?.toLowerCase()
    );

    let _tok: YourTokenData[] = [];

    if (index === -1) {
      const appended = [...yourWalletTokens];
      if (selectedToken) {
        appended.push(selectedToken as YourTokenData);
      }
      _tok = appended;
    } else {
      _tok = [
        ...yourWalletTokens.slice(index),
        ...yourWalletTokens.slice(0, index),
      ];
    }

    const normalizedTokens = _tok.filter(
      (t) => !!t && t.balance != null && t.decimals != null
    );

    if (!amount?.trim()) return normalizedTokens;

    const parsedAmount = Number(amount.trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return normalizedTokens;
    }

    let result: YourTokenData[];

    if (amountInputMode === "usd") {
      const filteredTks = normalizedTokens.filter((t) => {
        const tokenPriceUSD =
          typeof t?.usdPrice === "number" &&
          Number.isFinite(t.usdPrice) &&
          t.usdPrice > 0
            ? t.usdPrice
            : 0;

        if (tokenPriceUSD <= 0) return false;

        const tokenBal = Number(formatTokenBalance(t.balance, t.decimals));
        const tokenUsdBal = tokenBal * tokenPriceUSD;

        return Number.isFinite(tokenUsdBal) && tokenUsdBal >= parsedAmount;
      });

      result =
        filteredTks.length > 0
          ? filteredTks
          : normalizedTokens.filter(
              (t) => Number(formatTokenBalance(t.balance, t.decimals)) > 0
            );
    } else {
      const filteredTks = normalizedTokens.filter((t) => {
        const tokenBal = Number(formatTokenBalance(t.balance, t.decimals));
        return Number.isFinite(tokenBal) && tokenBal >= parsedAmount;
      });

      result =
        filteredTks.length > 0
          ? filteredTks
          : normalizedTokens.filter(
              (t) => Number(formatTokenBalance(t.balance, t.decimals)) > 0
            );
    }

    const isFound = result.find(
      (t) =>
        t.symbol?.toLowerCase() === selectedToken?.symbol?.toLowerCase() &&
        t?.chainData?.chainId.toString() ===
          (selectedToken as YourTokenData)?.chainData?.chainId.toString()
    );

    if (!isFound && result.length) {
      setSelectedToken(result[0]);
      setSelectedChain(result[0].chainData as Chain);
    }

    return result;
  }, [
    yourWalletTokens,
    amountInputMode,
    amount,
    selectedToken,
    setSelectedToken,
    setSelectedChain,
  ]);

  const isWalletConnected = walletStatus === "connected";
  const canSwipe =
    parsedAmount > 0 &&
    selectedToken &&
    isWalletConnected &&
    !isLoadingRoute &&
    !isSubmitting &&
    !!routeResult &&
    !isApproving &&
    !isReadingAllowance;

  const swipeResetKey = useMemo(() => {
    const tokenAddress = selectedToken?.address?.toLowerCase() ?? "no-token";
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "500px",
        // ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `${spacing[4]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.border}`,
          ...style,
        }}
      >
        <button
          type="button"
          onClick={goBack}
          style={{
            padding: spacing[1],
            marginRight: spacing[2],
            borderRadius: borderRadius.lg,
            transition: "background-color 0.2s",
            backgroundColor: "transparent",
            border: 0,
            cursor: "pointer",
          }}
          aria-label="Go back"
        >
          <svg
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: colors.foreground,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1
          style={{
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.foreground,
            textAlign: "center",
            marginRight: "1.75rem",
          }}
        >
          Confirm Deposit
        </h1>
      </div>

      {isReady ? (
        <>
          {/* Content */}
          <div
            style={{
              flex: 1,
              padding: `0 ${spacing[6]}`,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Enter Amount Label */}
            <p
              style={{
                fontSize: fontSize.base,
                color: colors.mutedForeground,
                marginBottom: spacing[4],
                marginTop: spacing[4],
              }}
            >
              Enter an amount
            </p>

            {/* Large Amount Display */}
            <div
              style={{
                textAlign: "center",
                position: "relative",
                marginBottom: spacing[4],
              }}
            >
              <span
                style={{
                  fontSize: "3.75rem",
                  fontWeight: fontWeight.bold,
                  letterSpacing: "-0.025em",
                  cursor: isFixedAmount ? "default" : "pointer",
                }}
                onClick={handleAmountClick}
              >
                <span
                  style={{
                    color: colors.foreground,
                  }}
                >
                  {amountInputMode === "usd" ? "$" : ""}
                </span>
                <span
                  style={{
                    position: "relative",
                    display: "inline-block",
                    minWidth: "1ch",
                  }}
                >
                  <span
                    style={{
                      color:
                        parsedAmount > 0
                          ? colors.foreground
                          : "rgba(161, 161, 170, 0.4)",
                    }}
                  >
                    {isEditing
                      ? amount || "0"
                      : parsedAmount > 0
                        ? parsedAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "0"}
                  </span>
                  {!isEditing && parsedAmount === 0 && (
                    <span style={{ color: "rgba(161, 161, 170, 0.4)" }}>
                      .00
                    </span>
                  )}
                  <input
                    // ref={amountInputRef}
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={handleAmountChange}
                    onBlur={() => setIsEditing(false)}
                    readOnly={isFixedAmount}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      backgroundColor: "transparent",
                      border: "none",
                      outline: "none",
                      padding: 0,
                      margin: 0,
                      textAlign: "center",
                      color: "transparent",
                      fontSize: "3.75rem",
                      fontWeight: fontWeight.bold,
                      letterSpacing: "-0.025em",
                      caretColor: "hsl(var(--tw-muted-foreground) / 0.5)",
                    }}
                    aria-label="Deposit amount"
                  />
                </span>
                {amountInputMode === "token" && selectedToken?.symbol && (
                  <span
                    style={{
                      marginLeft: spacing[2],
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.semibold,
                      color: colors.mutedForeground,
                    }}
                  >
                    {selectedToken.symbol}
                  </span>
                )}
              </span>
            </div>

            {/* Token / USD Conversion */}
            {selectedToken && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[2],
                  marginTop: spacing[2],
                }}
              >
                <span
                  style={{
                    fontSize: fontSize.lg,
                    color: colors.mutedForeground,
                  }}
                >
                  {amountInputMode === "usd" ? (
                    <>
                      {Number(amountComputation.tokenAmount ?? 0) > 0
                        ? parseFloat(
                            (amountComputation.tokenAmount ?? 0).toString()
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 5,
                          })
                        : "0"}{" "}
                      {selectedToken.symbol}
                    </>
                  ) : (
                    <>
                      {hasUsdPrice &&
                      Number(amountComputation.usdAmount ?? 0) > 0
                        ? `$${parseFloat(
                            (amountComputation.usdAmount ?? 0).toString()
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "USD pricing unavailable"}
                    </>
                  )}
                </span>
                <svg
                  style={{
                    width: "1rem",
                    height: "1rem",
                    color: colors.mutedForeground,
                    cursor: isFixedAmount ? "not-allowed" : "pointer",
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  onClick={() => {
                    if (isFixedAmount) return;
                    setAmountInputMode((mode) =>
                      mode === "usd" ? "token" : "usd"
                    );
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </div>
            )}

            {/* Balance + Max Button */}
            {selectedToken?.balance && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[3],
                  marginTop: spacing[2],
                }}
              >
                <span
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: colors.primary,
                  }}
                >
                  {amountInputMode === "usd" && hasUsdPrice
                    ? `Balance ($) ${(
                        normalizedTokenBalance * tokenPriceUSD
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : `Balance (${selectedToken.symbol}) ${normalizedTokenBalance.toLocaleString(
                        undefined,
                        {
                          maximumFractionDigits: 6,
                        }
                      )}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleSliderChange(effectiveSliderMax ?? 0)
                  }
                  disabled={isFixedAmount}
                  style={{
                    padding: `${spacing[1]} ${spacing[3]}`,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: colors.mutedForeground,
                    backgroundColor: colors.muted,
                    borderRadius: "9999px",
                    transition: "background-color 0.2s",
                    border: 0,
                    cursor: isFixedAmount ? "not-allowed" : "pointer",
                  }}
                >
                  Max
                </button>
              </div>
            )}

            {/* Token Swipe Pill */}
            {selectedToken && yourWalletTokens.length > 0 && (
              <div
                style={{
                  marginTop: spacing[6],
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[3],
                }}
              >
                <TokenSwipePill
                  tokens={orderedTokens}
                  selectedToken={selectedToken}
                  onTokenChange={handleTokenChange}
                  onExpandClick={handleExpandTokens}
                  selectedChain={selectedChain as Chain}
                  walletAddress={walletAddress}
                />
              </div>
            )}

            {/* Amount Slider */}
            {!isFixedAmount &&
            selectedToken &&
            effectiveSliderMax !== undefined ? (
              <div
                style={{
                  width: "100%",
                  marginTop: spacing[8],
                  padding: `0 ${spacing[2]}`,
                }}
              >
                <p
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.mutedForeground,
                    marginBottom: spacing[2],
                    textAlign: "center",
                  }}
                >
                  Slider unit:{" "}
                  {amountInputMode === "usd" ? "$ USD" : selectedToken.symbol}
                </p>
                <AmountSlider
                  value={Math.min(parsedAmount, effectiveSliderMax)}
                  onChange={handleSliderChange}
                  max={effectiveSliderMax}
                  min={effectiveSliderMin}
                  disabled={
                    !selectedToken || isFixedAmount || effectiveSliderMax <= 0
                  }
                />
              </div>
            ) : null}

            {/* Fee Summary */}
            {SHOW_FEE_SUMMARY && (
              <div
                style={{
                  width: "100%",
                  marginTop: spacing[6],
                  padding: spacing[4],
                  borderRadius: borderRadius.xl,
                  backgroundColor: "rgba(63, 63, 70, 0.5)",
                }}
              >
                {isLoadingRoute ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: `${spacing[2]} 0`,
                    }}
                  >
                    <svg
                      style={{
                        width: "1.25rem",
                        height: "1.25rem",
                        color: colors.mutedForeground,
                      }}
                      viewBox="0 0 24 24"
                      fill="none"
                      className="tw-animate-spin"
                    >
                      <circle
                        style={{ opacity: 0.25 }}
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        style={{ opacity: 0.75 }}
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span
                      style={{
                        marginLeft: spacing[2],
                        fontSize: fontSize.sm,
                        color: colors.mutedForeground,
                      }}
                    >
                      Calculating fees...
                    </span>
                  </div>
                ) : !amount?.trim() ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: `${spacing[2]} 0`,
                    }}
                  >
                    <p
                      style={{
                        fontSize: fontSize.base,
                        color: colors.mutedForeground,
                      }}
                    >
                      {/* {routeError} */}
                      Enter an amount to continue.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Network Fee */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: fontSize.sm,
                      }}
                    >
                      <span
                        style={{
                          color: colors.mutedForeground,
                        }}
                      >
                        Network fee
                      </span>

                      <span
                        style={{
                          fontWeight: fontWeight.medium,
                          color: colors.foreground,
                        }}
                      >
                        {/* {networkFees ? `$${networkFees}` : "—"} */}
                        {weiToDecimalString(
                          gasReservationWei,
                          selectedToken?.decimals as number,
                          6
                        )}{" "}
                        {/* ({selectedToken?.symbol}){gasFeeDisplay} */}
                      </span>
                    </div>

                    {/* Divider */}
                    <div
                      style={{
                        height: "1px",
                        backgroundColor: colors.border,
                        margin: `${spacing[2]} 0`,
                      }}
                    />

                    {/* You'll receive */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          color: colors.mutedForeground,
                          fontSize: fontSize.sm,
                        }}
                      >
                        You&apos;ll receive
                      </span>
                      <span
                        style={{
                          fontWeight: fontWeight.semibold,
                          color: colors.foreground,
                        }}
                      >
                        {estimatedReceive
                          ? `~$${parseFloat(estimatedReceive).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : parsedAmount > 0
                            ? `~$${(parsedAmount * 0.99).toFixed(2)}`
                            : "—"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action - Swipe to Confirm */}
          <div
            style={{
              padding: `${spacing[4]} ${spacing[6]}`,
            }}
          >
            {selectedToken !== null &&
              (selectedToken as YourTokenData).chainData !== undefined && (
                <SwipeToConfirmTokens
                  key={swipeResetKey}
                  text={
                    routeError
                      ? routeError
                      : !isWalletConnected
                        ? "Connect your wallet to deposit"
                        : isLoadingRoute
                          ? "Loading route..."
                        : isApproving
                          ? "Approving..."
                          : isReadingAllowance
                            ? "Checking allowance..."
                            : needsApproval
                              ? "Swipe to approve"
                              : "Swipe to confirm"
                  }
                  fromToken={selectedToken}
                  toTokenSymbol={destinationConfig?.toToken || "USDC"}
                  toChainName={destinationConfig?.toChain || "Base"}
                  fromChainName={selectedChain?.networkName || "Unknown Chain"}
                  dappName={destinationConfig?.dappName || "Example DApp"}
                  onConfirm={handleSwipeConfirm}
                  disabled={!canSwipe}
                  isWalletConnected={isWalletConnected}
                />
              )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: `${spacing[4]} ${spacing[6]}`,
              borderTop: `1px solid rgba(63, 63, 70, 0.3)`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing[2],
              }}
            >
              <svg
                style={{
                  width: "0.875rem",
                  height: "0.875rem",
                  color: colors.mutedForeground,
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span
                style={{
                  fontSize: fontSize.sm,
                  color: colors.mutedForeground,
                }}
              >
                Secured by{" "}
                <span
                  style={{
                    fontWeight: fontWeight.semibold,
                    color: colors.foreground,
                  }}
                >
                  Trustware
                </span>
              </span>
            </div>
          </div>
        </>
      ) : (
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LoadingSkeleton />
        </div>
      )}
    </div>
  );
}

export default CryptoPay;
