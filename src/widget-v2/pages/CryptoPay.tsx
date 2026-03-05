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
  // Token,
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
  parseDecimalToWei,
} from "../helpers/chainHelpers";
import { toast } from "../components/Toast";

export interface CryptoPayProps {
  /** Additional inline styles */
  style?: React.CSSProperties;
}

// import { usePublicClient, useWalletClient } from "wagmi";
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

function usdToTokenAmount(amt: string, tkPrice: string | undefined): number {
  if (tkPrice === undefined || tkPrice === "0") return 0;
  return Number(amt) / Number(tkPrice);
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
    errorMessage,
    setErrorMessage,
  } = useDeposit();

  const { chains } = useChains();

  const [isEditing, setIsEditing] = useState(false);
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

  const _combinedAmountObj = useMemo(() => {
    if (selectedToken?.usdPrice !== undefined) {
      const tokenAmt = usdToTokenAmount(
        amount,
        selectedToken.usdPrice.toString()
      );
      return {
        usdAmount: amount,
        tokenAmount: tokenAmt.toString(),
      };
    }
    return undefined;
  }, [selectedToken?.usdPrice, amount]);

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

  // compute wei from the current input+mode
  const amountWei: bigint | null = useMemo(() => {
    if (!amount?.trim()) return null;

    if (!hasUsdPrice) return null;
    const tokenDecimals = selectedToken?.decimals ?? 18;
    const usdStr = amount.trim();
    if (!/^\d*\.?\d*$/.test(usdStr)) return null;
    const usdVal = Number(usdStr);
    if (!isFinite(usdVal)) return null;
    const tokenUnits = usdVal / tokenPriceUSD!;
    return parseDecimalToWei(String(tokenUnits), tokenDecimals);
  }, [amount, hasUsdPrice, selectedToken?.decimals, tokenPriceUSD]);

  const routeConfig = useMemo(() => {
    try {
      const config = TrustwareConfigStore.get();
      const toChainId = config.routes.toChain;
      const toChainKey = normalizeChainKey(toChainId);
      if (!toChainKey) return null;
      const toChain =
        chains.find(
          (chain) => normalizeChainKey(chain.chainId ?? chain.id) === toChainKey
        ) ?? null;

      const object = {
        fromChain: selectedChain?.chainId ?? selectedChain?.id ?? undefined,
        fromChainId: selectedChain?.chainId ?? selectedChain?.id,
        toChain: toChain,
        toChainId: toChainId,
        toToken: config.routes.toToken,
        toAddress: config.routes.toAddress,
        fromToken: (selectedToken?.address ??
          getNativeTokenAddress(
            selectedChain?.type ?? selectedChain?.chainType
          )) as string,
        fromAmountWei: amountWei || undefined,
        fromAmountUsd: _combinedAmountObj?.usdAmount || undefined,
        fromAddress: walletAddress || undefined,
        refundAddress: walletAddress || undefined,
        slippage: 1,
      };

      // console.log("Resolved route config:", {
      //   object,
      //   selectedToken,
      //   selectedChain,
      // });

      return object as UseRouteBuilderOptions;
    } catch (error) {
      console.error("Error building route config:", error);
      return {} as UseRouteBuilderOptions;
    }
  }, [
    _combinedAmountObj?.usdAmount,
    amountWei,
    chains,
    selectedChain,
    selectedToken,
    walletAddress,
  ]);

  // Get route info with fees
  const {
    isLoadingRoute,
    // networkFees,
    // estimatedReceive,
    error: routeError,
    routeResult,
  } = useRouteBuilder(routeConfig as UseRouteBuilderOptions);

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
      estimateGasReservationWei().then((reservation) => {
        return reservation;
      });
    }
  }, [estimateGasReservationWei, routeResult]);

  const amountToReceive = routeResult?.route?.estimate?.toAmountUsd;

  useEffect(() => {
    const balance =
      Number(selectedToken?.balance) / 10 ** (selectedToken?.decimals ?? 18);
    if (Number(_combinedAmountObj?.tokenAmount) > balance) {
      // console.log("[CryptoPay] Insufficient balance");
      toast.error("Failed", "Insufficient balance");
      return setErrorMessage("Insufficient balance");
    }
    if (
      isNativeSelected &&
      Number(gasReservationWei) >= Number(selectedToken?.balance) &&
      Number(selectedToken?.balance) > Number(0n)
    ) {
      // console.log("[CryptoPay] Not enough native balance for gas.");
      toast.error("Failed", "Not enough native balance for gas.");
      setErrorMessage("Not enough native balance for gas.");
      return;
    }

    const timer = setTimeout(() => {
      setErrorMessage(null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    _combinedAmountObj?.tokenAmount,
    gasReservationWei,
    isNativeSelected,
    selectedToken?.balance,
    selectedToken?.decimals,
    setErrorMessage,
  ]);

  const parsedAmount = parseFloat(amount) || 0;

  // Max amount based on token balance (if available)
  const maxAmount = useMemo(() => {
    if (!selectedToken?.balance) return 1000; // Default max
    // Parse balance and convert from smallest unit
    const balance = parseFloat(selectedToken.balance);
    if (isNaN(balance)) return 1000;
    // Assume balance is in token units (already converted)
    return Math.min(balance / 10 ** selectedToken.decimals, 10000); // Cap at 10k for slider
  }, [selectedToken]);

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
        // console.log({
        //   token,
        // });
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

  const isWalletConnected = walletStatus === "connected";
  const canConfirm =
    parsedAmount > 0 &&
    selectedToken &&
    isWalletConnected &&
    !isLoadingRoute &&
    !isSubmitting &&
    !!routeResult;

  const [_maxAmountUSD, setMaxAmountUSD] = useState<undefined | number>();

  useEffect(() => {
    if (!selectedToken?.usdPrice || !selectedToken?.balance) return;

    const balance = parseFloat(selectedToken.balance);

    if (isNaN(balance)) {
      return setMaxAmountUSD(1000);
    } else {
      return setMaxAmountUSD(
        Math.min(
          (balance / 10 ** selectedToken.decimals) * selectedToken.usdPrice,
          10000
        )
      );
    }

    // return Math.min(balance * selectedToken.usdPrice, 10000); // Cap at 10k for slider
  }, [selectedChain, selectedToken, yourWalletTokens]);

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
                  cursor: "pointer",
                }}
                onClick={handleAmountClick}
              >
                <span
                  style={{
                    color: colors.foreground,
                  }}
                >
                  $
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
                  {Number(_combinedAmountObj?.tokenAmount ?? 0) > 0
                    ? parseFloat(
                        (_combinedAmountObj?.tokenAmount ?? 0).toString()
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
                  Balance{" "}
                  {(
                    Number(selectedToken.balance) /
                    10 ** selectedToken.decimals
                  )
                    ?.toFixed(Number(selectedToken.balance) !== 0 ? 4 : 2)
                    ?.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handleSliderChange(maxAmount)}
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
                  tokens={yourWalletTokens}
                  selectedToken={selectedToken}
                  onTokenChange={handleTokenChange}
                  onExpandClick={handleExpandTokens}
                  selectedChain={selectedChain as Chain}
                  walletAddress={walletAddress}
                />
              </div>
            )}

            {/* Amount Slider */}
            {selectedToken && _maxAmountUSD != undefined && (
              <div
                style={{
                  width: "100%",
                  marginTop: spacing[8],
                  padding: `0 ${spacing[2]}`,
                }}
              >
                <AmountSlider
                  value={(errorMessage?.length ?? 0) > 0 ? 0 : parsedAmount}
                  onChange={handleSliderChange}
                  max={_maxAmountUSD}
                  min={minDeposit}
                  disabled={!selectedToken || (errorMessage?.length ?? 0) > 0}
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
                      {amountToReceive
                        ? `~$${parseFloat(amountToReceive).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
