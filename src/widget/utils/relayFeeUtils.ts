type RouteEstimate = {
  fees?: unknown[];
  fromAmountUsd?: string;
  toAmountMinUsd?: string;
};

type RouteResultLike = {
  sponsorship?: unknown;
  txReq?: { value?: string | number };
  route?: { estimate?: RouteEstimate };
};

export function computeRelayFeeUsd(
  routeResult: RouteResultLike | null | undefined,
  isNativeSelected: boolean
): number {
  if (isNativeSelected || !routeResult?.sponsorship) return 0;
  const relayFeeEthWei = routeResult.txReq?.value ? BigInt(routeResult.txReq.value) : 0n;
  if (relayFeeEthWei === 0n) return 0;

  const feeCosts = (routeResult.route?.estimate?.fees ?? []) as Array<Record<string, unknown>>;
  let usd = feeCosts.reduce((sum, fee) => {
    const v = parseFloat(String(fee.amountUSD ?? fee.amountUsd ?? "0"));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  if (usd === 0) {
    const fromUsd = parseFloat(routeResult.route?.estimate?.fromAmountUsd ?? "0");
    const toMinUsd = parseFloat(routeResult.route?.estimate?.toAmountMinUsd ?? "0");
    usd = Math.max(fromUsd - toMinUsd, 0);
  }

  return usd;
}

// Returns the slider max adjusted down by the relay fee token reserve (15% slippage buffer).
// Returns effectiveSliderMax unchanged when there is no relay fee or no token price.
export function computeAdjustedSliderMax(
  effectiveSliderMax: number | undefined,
  relayFeeUsd: number,
  tokenPriceUSD: number
): number | undefined {
  const reserve =
    tokenPriceUSD > 0 && relayFeeUsd > 0 ? (relayFeeUsd / tokenPriceUSD) * 1.15 : 0;
  if (effectiveSliderMax != null && reserve > 0) {
    return Math.max(effectiveSliderMax - reserve, 0);
  }
  return effectiveSliderMax;
}
