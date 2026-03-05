type Tx = {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
};

export function calculateGasFees(
  tx: Tx,
  nativeTokenPriceUsd: number // e.g. ETH price in USD
) {
  const gasLimit = BigInt(tx.gasLimit);
  const gasPrice = BigInt(tx.gasPrice);
  const maxFeePerGas = tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : null;

  // ✅ Estimated fee (legacy style)
  const estimatedWei = gasLimit * gasPrice;

  // ✅ Max possible fee (EIP-1559 upper bound)
  const maxWei = maxFeePerGas ? gasLimit * maxFeePerGas : null;

  // Convert wei → native token (ETH/AVAX/etc.)
  const WEI_PER_NATIVE = 10n ** 18n;

  const estimatedNative = Number(estimatedWei) / Number(WEI_PER_NATIVE);

  const maxNative = maxWei ? Number(maxWei) / Number(WEI_PER_NATIVE) : null;

  // Convert to USD
  const estimatedUsd = estimatedNative * nativeTokenPriceUsd;
  const maxUsd = maxNative ? maxNative * nativeTokenPriceUsd : null;

  return {
    estimated: {
      wei: estimatedWei.toString(),
      native: estimatedNative,
      usd: estimatedUsd,
    },
    max: maxWei
      ? {
          wei: maxWei.toString(),
          native: maxNative,
          usd: maxUsd,
        }
      : null,
  };
}

export function calculateGasFeeDisplay(
  transaction: Tx,
  nativeTokenPriceUsd: number,
  tokenDecimals: number
): any {
  const actualFeeWei =
    BigInt(transaction.gasLimit) * BigInt(transaction.gasPrice);
  const actualFeeEth = Number(actualFeeWei) / 1e18;

  // Calculate max possible fee (using maxFeePerGas)
  const maxFeeWei =
    BigInt(transaction.gasLimit) *
    BigInt(transaction.maxFeePerGas?.toString() || "0");
  //   const maxFeeEth = Number(maxFeeWei) / 1e18;
  const maxFeeEth = Number(maxFeeWei) / 10 ** tokenDecimals;

  console.log(`Actual Gas Fee: ${actualFeeEth} ETH`, { tokenDecimals });
  console.log(`Max Gas Fee: ${maxFeeEth} ETH`);
  console.log(`Native Token Price: $${maxFeeEth * nativeTokenPriceUsd} USD`);
}
