import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "../styles/tokens";
import {
  Chain,
  Token,
  useDeposit,
  YourTokenData,
} from "../context/DepositContext";
import {
  useRouteBuilder,
  UseRouteBuilderOptions,
} from "../hooks/useRouteBuilder";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { TokenSwipePill } from "../components/TokenSwipePill";
import { SwipeToConfirmTokens } from "../components/SwipeToConfirmTokens";
import { AmountSlider } from "../components/AmountSlider";
import { TrustwareConfigStore } from "../../config/store";

import { useChains } from "../hooks";
import { divRoundDown, weiToDecimalString } from "src/utils";
import { ChainDef } from "src";
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

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

function normalizeTokenAddressForCompare(
  chain: ChainDef,
  addr?: string
): string {
  const chainType = (chain.type ?? chain.chainType ?? "").toLowerCase();
  const a = (addr ?? "").trim();
  if (chainType === "solana") return a;
  return a.toLowerCase();
}

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
  } = useDeposit();

  const { chains } = useChains();

  const [isEditing, setIsEditing] = useState(false);
  const [amountInputMode, setAmountInputMode] = useState<"usd" | "token">(
    "usd"
  );
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Transaction submission hook
  const { isSubmitting, submitTransaction } = useTransactionSubmit();

  const destinationConfig = useMemo(() => {
    try {
      const config = TrustwareConfigStore.get();
      return {
        toChain: config.routes.toChain,
        toToken: config.routes.toToken,
        toAddress: config.routes.toAddress,
      };
    } catch {
      return null;
    }
  }, []);

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
    if (!hasUsdPrice && amountInputMode === "usd") {
      setAmountInputMode("token");
    }
  }, [amountInputMode, hasUsdPrice]);

  const amountComputation = useMemo(() => {
    const rawAmount = amount?.trim();
    if (!rawAmount) {
      return {
        fromAmountWei: null,
        tokenAmount: null,
        usdAmount: null,
        validationError: "Enter an amount to continue.",
      };
    }

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

    return {
      fromAmountWei: BigInt(decimalToRaw(rawAmount, tokenDecimals)),
      tokenAmount: rawAmount,
      usdAmount: hasUsdPrice ? String(parsedAmount * tokenPriceUSD) : undefined,
      validationError: null,
    };
  }, [
    amount,
    amountInputMode,
    hasUsdPrice,
    selectedToken?.decimals,
    tokenPriceUSD,
  ]);

  const amountWei = amountComputation.fromAmountWei;

  const routeConfig = useMemo(() => {
    try {
      const config = TrustwareConfigStore.get();
      const toChainId = config.routes.toChain;
      const toChainKey = normalizeChainKey(toChainId);
      const toChain = toChainKey
        ? (chains.find(
            (chain) =>
              normalizeChainKey(chain.chainId ?? chain.id) === toChainKey
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
          getNativeTokenAddress(
            selectedChain?.type ?? selectedChain?.chainType
          ),
        fromAmountWei: amountWei ?? 0n,
        fromAmountUsd: amountComputation.usdAmount || undefined,
        fromAddress: walletAddress || undefined,
        refundAddress: walletAddress || undefined,
        slippage: 1,
        direction: config.routes.routeType,
      };

      // console.log("Resolved route config:", {
      //   object,
      //   selectedToken,
      //   selectedChain,
      // });

      return object;
    } catch (error) {
      console.error("Error building route config:", error);
      return {
        fromChain: "",
        fromChainId: undefined,
        toChain: null,
        toChainId: "",
        toToken: "",
        toAddress: undefined,
        fromToken: "",
        fromAmountWei: 0n,
        fromAddress: undefined,
        refundAddress: undefined,
        slippage: 1,
        direction: "",
      };
    }
  }, [
    amountComputation.usdAmount,
    amountWei,
    chains,
    selectedChain,
    selectedToken,
    walletAddress,
  ]);

  const {
    isLoadingRoute,
    networkFees,
    estimatedReceive,
    error: routeBuilderError,
    routeResult,
  } = useRouteBuilder(routeConfig);

  const routePrerequisiteError = useMemo(() => {
    if (!selectedChain) return "Select a source chain to fetch a route.";
    if (!selectedToken) return "Select a token to fetch a route.";
    if (!walletAddress) return "Connect your wallet to fetch a route.";
    if (!routeConfig.toAddress) {
      return "Destination address missing. Please check widget configuration.";
    }
    if (!amountComputation.fromAmountWei) {
      return amountComputation.validationError;
    }
    return null;
  }, [
    amountComputation.fromAmountWei,
    amountComputation.validationError,
    routeConfig.toAddress,
    selectedChain,
    selectedToken,
    walletAddress,
  ]);

  const routeError = routePrerequisiteError || routeBuilderError;

  useEffect(() => {
    if (!routePrerequisiteError && amountComputation.fromAmountWei) {
      console.log("[CryptoPay] Route prerequisites satisfied", {
        chainId: selectedChain?.chainId ?? selectedChain?.id,
        token: selectedToken?.address,
        fromAddress: walletAddress,
        toAddress: routeConfig.toAddress,
      });
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

  // Minimum deposit from SDK config
  const minDeposit = useMemo(() => {
    try {
      const config = TrustwareConfigStore.get();
      const raw = config.routes.options?.minAmountOut;
      return raw ? Number(raw) : 0;
    } catch {
      return 0;
    }
  }, []);

  const [gasReservationWei, setGasReservationWei] = useState<bigint>(0n);

  const chainType = selectedChain?.type ?? selectedChain?.chainType;
  const chainTypeNormalized = (chainType ?? "").toLowerCase();
  const evmChainId = useMemo(() => {
    const numeric = Number(selectedChain?.chainId ?? selectedChain?.id);
    return Number.isFinite(numeric) ? numeric : undefined;
  }, [selectedChain]);
  // const publicClient = usePublicClient({ chainId: evmChainId });
  const client = createPublicClient({
    chain: mainnet, // or your custom chain object
    transport: http(),
  });

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
        effectiveGasPrice = txReq.maxFeePerGas
          ? BigInt(txReq.maxFeePerGas)
          : await client.getGasPrice();
      } catch {
        effectiveGasPrice = undefined;
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
    console.log({ reservedWei });
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
      console.log("[CryptoPay]: Estimating gas reservation...");
      estimateGasReservationWei().then((reservation) => {
        console.log({ reservation });
      });
    }
  }, [estimateGasReservationWei, routeResult]);

  // useEffect(() => {

  // },[])

  // const errors: string[] = useMemo(() => {
  //   const errs: string[] = [];
  //   if (isLoadingRoute) return errs;

  //   // const amountWei = amount ? parseUnits(amount, selectedToken?.decimals) : 0n;
  //   const balanceWei = selectedToken?.balance ?? 0n;

  //   if (
  //     isNativeSelected &&
  //     Number(gasReservationWei) >= Number(balanceWei) &&
  //     Number(balanceWei) > Number(0n)
  //   ) {
  //     errs.push("Not enough native balance for gas.");
  //     return errs;
  //   }

  //   if (amountWei == null || amountWei <= 0n) {
  //     errs.push("Enter a valid amount.");
  //     return errs;
  //   }

  //   if (balanceWei === 0n) {
  //     errs.push("Insufficient balance.");
  //     return errs;
  //   }

  //   if (Number(amountWei) > Number(balanceWei)) {
  //     errs.push("Amount exceeds available balance.");
  //   }
  //   console.log({ errors: errs });
  //   return errs;
  // }, [
  //   amountWei,
  //   gasReservationWei,
  //   isLoadingRoute,
  //   isNativeSelected,
  //   selectedToken?.balance,
  // ]);

  const parsedAmount = parseFloat(amount) || 0;

  const normalizedTokenBalance = useMemo(() => {
    if (!selectedToken?.balance) return 0;
    const normalized = Number(
      rawToDecimal(selectedToken.balance, selectedToken.decimals ?? 18)
    );
    return Number.isFinite(normalized) ? normalized : 0;
  }, [selectedToken?.balance, selectedToken?.decimals]);

  const maxTokenAmount = useMemo(
    () => Math.min(normalizedTokenBalance, 10000),
    [normalizedTokenBalance]
  );

  const maxUsdAmount = useMemo(() => {
    if (!hasUsdPrice) return undefined;
    return Math.min(maxTokenAmount * tokenPriceUSD, 10000);
  }, [hasUsdPrice, maxTokenAmount, tokenPriceUSD]);

  const sliderMax = amountInputMode === "usd" ? maxUsdAmount : maxTokenAmount;

  const isReady = useMemo(() => {
    if (
      selectedToken !== null &&
      yourWalletTokens.length > 0 &&
      (selectedToken as YourTokenData)?.chainData !== undefined
    ) {
      return true;
    }
  }, [selectedToken, yourWalletTokens.length]);

  /**
   * Handle amount input changes with decimal sanitization
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    // Handle multiple decimal points - keep only the first one
    const parts = raw.split(".");
    const sanitized =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
    setAmount(sanitized);
  };

  /**
   * Handle click on the amount display to start editing
   */
  const handleAmountClick = () => {
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
        console.log({
          token,
        });
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
  const handleConfirm = async () => {
    if (!routeResult) {
      // No route result available, show error
      return;
    }

    // Submit the transaction to the wallet for signing
    // The hook handles all state updates (confirming -> processing or error)
    await submitTransaction(routeResult);
  };

  const orderedTokens = useMemo(() => {
    const index = yourWalletTokens.findIndex(
      (t) => t.address?.toLowerCase() === selectedToken?.address?.toLowerCase()
    );

    let _tok: YourTokenData[] = [];

    //  if (index === -1) return yourWalletTokens;
    if (index === -1) {
      const appended = [...yourWalletTokens];
      appended.push(selectedToken as YourTokenData);
      _tok = [...appended.slice(index), ...appended.slice(0, index)];
      console.log("APPENDED");
    } else {
      console.log("NOT APPENDED");
      _tok = yourWalletTokens;
    }

    console.log({ _tok });

    return _tok;

    //  return [
    //    ...yourWalletTokens.slice(index),
    //    ...yourWalletTokens.slice(0, index),
    //  ];
  }, [yourWalletTokens, selectedToken]);

  const isWalletConnected = walletStatus === "connected";
  const canConfirm =
    parsedAmount > 0 &&
    selectedToken &&
    isWalletConnected &&
    !isLoadingRoute &&
    !isSubmitting &&
    !!routeResult;

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
            <div
              style={{
                display: "flex",
                gap: spacing[2],
                marginBottom: spacing[2],
              }}
            >
              <button
                type="button"
                onClick={() => setAmountInputMode("usd")}
                disabled={!hasUsdPrice}
                style={{
                  padding: `${spacing[1]} ${spacing[3]}`,
                  borderRadius: "9999px",
                  border: 0,
                  cursor: hasUsdPrice ? "pointer" : "not-allowed",
                  backgroundColor:
                    amountInputMode === "usd" ? colors.primary : colors.muted,
                  color:
                    amountInputMode === "usd"
                      ? colors.background
                      : colors.foreground,
                  opacity: hasUsdPrice ? 1 : 0.6,
                }}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setAmountInputMode("token")}
                style={{
                  padding: `${spacing[1]} ${spacing[3]}`,
                  borderRadius: "9999px",
                  border: 0,
                  cursor: "pointer",
                  backgroundColor:
                    amountInputMode === "token" ? colors.primary : colors.muted,
                  color:
                    amountInputMode === "token"
                      ? colors.background
                      : colors.foreground,
                }}
              >
                {selectedToken?.symbol || "Token"}
              </button>
            </div>

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
                  cursor: "pointer",
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
              </span>
            </div>

            {/* Token Amount Conversion */}
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
                  {Number(amountComputation.tokenAmount ?? 0) > 0
                    ? parseFloat(
                        (amountComputation.tokenAmount ?? 0).toString()
                      ).toLocaleString(undefined, {
                        maximumFractionDigits: 5,
                      })
                    : "0"}{" "}
                  {selectedToken.symbol}
                </span>
                <svg
                  style={{
                    width: "1rem",
                    height: "1rem",
                    color: colors.mutedForeground,
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
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
                  Balance ({selectedToken.symbol}){" "}
                  {normalizedTokenBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => handleSliderChange(sliderMax ?? 0)}
                  style={{
                    padding: `${spacing[1]} ${spacing[3]}`,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: colors.mutedForeground,
                    backgroundColor: colors.muted,
                    borderRadius: "9999px",
                    transition: "background-color 0.2s",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  {amountInputMode === "usd"
                    ? "Max $"
                    : `Max ${selectedToken.symbol}`}
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
            {selectedToken && sliderMax !== undefined && (
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
                  value={parsedAmount}
                  onChange={handleSliderChange}
                  max={sliderMax}
                  min={amountInputMode === "usd" ? minDeposit : 0}
                  disabled={!selectedToken}
                />
              </div>
            )}

            {/* Fee Summary */}
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
              ) : routeError ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: `${spacing[2]} 0`,
                  }}
                >
                  <p
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.destructive,
                    }}
                  >
                    {routeError}
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
                  fromToken={selectedToken}
                  toTokenSymbol={destinationConfig?.toToken || "USDC"}
                  toChainName={destinationConfig?.toChain || "Base"}
                  onConfirm={handleConfirm}
                  disabled={!canConfirm}
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
        <h4>Loading....</h4>
      )}
    </div>
  );
}

export default CryptoPay;
