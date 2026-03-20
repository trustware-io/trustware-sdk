export function rawToDecimal(rawAmount: string, decimals: number): string {
  if (!rawAmount) return "0";
  const sanitized = rawAmount.trim();
  if (!/^\d+$/.test(sanitized)) return "0";

  const value = BigInt(sanitized);
  const base = 10n ** BigInt(Math.max(decimals, 0));
  const whole = value / base;
  const fraction = value % base;

  if (fraction === 0n || decimals <= 0) {
    return whole.toString();
  }

  const paddedFraction = fraction.toString().padStart(decimals, "0");
  const trimmedFraction = paddedFraction.replace(/0+$/, "");

  return trimmedFraction
    ? `${whole.toString()}.${trimmedFraction}`
    : whole.toString();
}

export function decimalToRaw(decimalAmount: string, decimals: number): string {
  if (!decimalAmount?.trim()) return "0";
  const normalized = decimalAmount.trim();
  if (!/^\d*\.?\d*$/.test(normalized)) return "0";

  const [wholePartRaw = "", fractionRaw = ""] = normalized.split(".");
  const safeDecimals = Math.max(decimals, 0);
  const wholePart = wholePartRaw.length > 0 ? BigInt(wholePartRaw) : 0n;
  const fractionPadded = (fractionRaw + "0".repeat(safeDecimals)).slice(
    0,
    safeDecimals
  );
  const fractionPart = fractionPadded ? BigInt(fractionPadded) : 0n;
  const base = 10n ** BigInt(safeDecimals);

  return (wholePart * base + fractionPart).toString();
}
