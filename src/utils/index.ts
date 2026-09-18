import { ChainDef } from "src/types/";
import { rawToDecimal } from "src/widget/helpers/tokenAmount";

// export function weiToDecimalString(
//   wei: bigint,
//   decimals: number,
//   maxFrac = 8
// ): string {
//   const neg = wei < 0n;
//   const value = neg ? -wei : wei;
//   const base = BigInt(10) ** BigInt(decimals);
//   const intPart = value / base;
//   const fracPart = value % base;
//   let fracStr = decimals > 0 ? fracPart.toString().padStart(decimals, "0") : "";
//   if (decimals > 0) {
//     fracStr = fracStr.slice(0, Math.min(maxFrac, decimals)).replace(/0+$/, "");
//   }
//   return `${neg ? "-" : ""}${intPart.toString()}${fracStr ? `.${fracStr}` : ""}`;
// }

export function weiToDecimalString(
  wei: bigint,
  decimals: number,
  maxFrac = 6
): string {
  const base = 10n ** BigInt(decimals);
  const intPart = wei / base;
  const fracPart = wei % base;
  if (fracPart === 0n) return intPart.toString();
  const fracStr = fracPart
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  const trimmed = fracStr.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${intPart.toString()}.${trimmed}` : intPart.toString();
}

// export function divRoundDown(a: bigint, b: bigint): bigint {
//   if (b === 0n) return 0n;
//   const q = a / b;
//   const r = a % b;
//   if ((a ^ b) >= 0 || r === 0n) return q; // same sign or exact
//   return q; // we want floor toward -∞; with non-negative inputs it's just q
// }
export function divRoundDown(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return a / b;
}

// export function formatTokenBalance(token: TokenWithBalance) {
//   if (token.balance === undefined) return "0.0000";
//   try {
//     const amount = Number(token.balance) / Math.pow(10, token.decimals ?? 18);
//     if (!Number.isFinite(amount)) return "0.0000";
//     return amount.toLocaleString(undefined, {
//       minimumFractionDigits: 0,
//       maximumFractionDigits: 4,
//     });
//   } catch {
//     return "0.0000";
//   }
// }

export function formatTokenBalance(
  balanceRaw: string,
  decimals: number
): string {
  const normalized = Number(rawToDecimal(balanceRaw, decimals));
  if (!isFinite(normalized) || normalized <= 0) return "0";
  if (normalized < 0.0001) return "<0.0001";
  if (normalized < 1) return normalized.toFixed(4);
  if (normalized < 1000) return normalized.toFixed(2);
  return normalized.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function resolveChainLabel(chain: ChainDef) {
  return (
    chain.networkName ||
    chain.axelarChainName ||
    (chain.id != null ? String(chain.id) : undefined) ||
    (chain.chainId != null ? String(chain.chainId) : undefined) ||
    chain.networkIdentifier ||
    "Chain"
  );
}
