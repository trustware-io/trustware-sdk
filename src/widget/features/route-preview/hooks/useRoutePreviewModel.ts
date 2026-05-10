import { useMemo } from "react";

import type { Token, YourTokenData } from "../../../context/DepositContext";
import {
  useRouteBuilder,
  type UseRouteBuilderOptions,
  useChains,
} from "../../../hooks";
import {
  normalizeChainKey,
  getNativeTokenAddress,
} from "../../../helpers/chainHelpers";
import type { ChainDef } from "../../../../types";

type UseRoutePreviewModelArgs = {
  amountUsd?: string;
  amountValidationError: string | null;
  amountWei: bigint;
  config: ReturnType<
    typeof import("../../../../hooks/useTrustwareConfig").useTrustwareConfig
  >;
  isReady: boolean | undefined;
  routeRefreshMs?: number;
  selectedChain: ChainDef | null;
  selectedToken: Token | YourTokenData | null;
  walletAddress: string | null;
};

export function useRoutePreviewModel({
  amountUsd,
  amountValidationError,
  amountWei,
  config,
  isReady,
  routeRefreshMs,
  selectedChain,
  selectedToken,
  walletAddress,
}: UseRoutePreviewModelArgs) {
  const { chains } = useChains();
  console.log({ walletAddress });
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

  const routeConfig = useMemo<UseRouteBuilderOptions>(() => {
    const toChainId = config.routes.toChain;
    const toChainKey = normalizeChainKey(toChainId);
    const toChain = toChainKey
      ? (chains.find(
          (chain) => normalizeChainKey(chain.chainId ?? chain.id) === toChainKey
        ) ?? null)
      : null;

    return {
      fromChain: selectedChain?.chainId ?? selectedChain?.id ?? "",
      fromChainId: selectedChain?.chainId ?? selectedChain?.id,
      toChain: toChain ?? toChainId,
      toChainId,
      toToken: config.routes.toToken,
      toAddress: config.routes.toAddress || walletAddress || undefined,
      fromToken:
        selectedToken?.address ??
        getNativeTokenAddress(selectedChain?.type ?? selectedChain?.chainType),
      fromAmountWei: amountWei ?? 0n,
      fromAmountUsd: amountUsd || undefined,
      fromAddress: walletAddress || undefined,
      refundAddress: walletAddress || undefined,
      slippage: 1,
      refreshMs: routeRefreshMs,
    };
  }, [
    amountUsd,
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

  const routeBuilderState = useRouteBuilder(routeConfig);

  const routePrerequisiteError = useMemo(() => {
    if (!isReady) return;
    if (!selectedChain) {
      return "Select a source chain to fetch a route.";
    }
    if (!selectedToken) {
      return "Select a token to fetch a route.";
    }
    if (!walletAddress) {
      return "Connect your wallet to fetch a route.";
    }
    if (!routeConfig.toAddress) {
      return "Destination address missing. Please check widget configuration.";
    }
    if (amountValidationError || amountWei <= 0n) {
      return amountValidationError;
    }
    return null;
  }, [
    amountValidationError,
    amountWei,
    isReady,
    routeConfig.toAddress,
    selectedChain,
    selectedToken,
    walletAddress,
  ]);

  const routeError = routeBuilderState.error ?? null;
  const actionErrorMessage = routePrerequisiteError || routeError || null;

  return {
    actionErrorMessage,
    destinationConfig,
    routeConfig,
    routeError,
    routePrerequisiteError,
    ...routeBuilderState,
  };
}
