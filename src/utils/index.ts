import { ChainDef, TokenWithBalance } from "src/types/";

export function hexToRgba(hex: string, alpha = 1) {
  if (!hex || !hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
  const h = hex.replace("#", "");
  const isShort = h.length === 3;
  const r = parseInt(isShort ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(isShort ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(isShort ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatUsd(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "$0.00";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value?: number, maxFractionDigits = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

// ------- tiny local helpers (no new imports) -------
export function parseDecimalToWeiUnsafe(
  input: string,
  decimals: number
): bigint | null {
  // accept "12", "12.3", "0.0001" etc (no commas)
  if (!/^\d*(\.\d*)?$/.test(input.trim())) return null;
  const [intPart = "0", fracPartRaw = ""] = input.trim().split(".");
  const fracPart = (fracPartRaw || "").slice(0, Math.max(0, decimals)); // clamp precision
  const pad = Math.max(0, decimals - fracPart.length);
  try {
    const whole = BigInt(intPart || "0") * BigInt(10) ** BigInt(decimals);
    const frac = BigInt((fracPart || "0") + "0".repeat(pad));
    return whole + frac;
  } catch {
    return null;
  }
}

export function weiToDecimalString(
  wei: bigint,
  decimals: number,
  maxFrac = 8
): string {
  const neg = wei < 0n;
  const value = neg ? -wei : wei;
  const base = BigInt(10) ** BigInt(decimals);
  const intPart = value / base;
  const fracPart = value % base;
  let fracStr = decimals > 0 ? fracPart.toString().padStart(decimals, "0") : "";
  if (decimals > 0) {
    fracStr = fracStr.slice(0, Math.min(maxFrac, decimals)).replace(/0+$/, "");
  }
  return `${neg ? "-" : ""}${intPart.toString()}${fracStr ? `.${fracStr}` : ""}`;
}

export function divRoundDown(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  const q = a / b;
  const r = a % b;
  if ((a ^ b) >= 0 || r === 0n) return q; // same sign or exact
  return q; // we want floor toward -∞; with non-negative inputs it's just q
}

export function shortenAddress(address: string, chars = 4) {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatTokenBalance(token: TokenWithBalance) {
  if (token.balance === undefined) return "0.0000";
  try {
    const amount = Number(token.balance) / Math.pow(10, token.decimals ?? 18);
    if (!Number.isFinite(amount)) return "0.0000";
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  } catch {
    return "0.0000";
  }
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

const ALLOWANCE_SELECTOR = "0xdd62ed3e";
const APPROVE_SELECTOR = "0x095ea7b3";

function stripHexPrefix(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function padTo32Bytes(hex: string) {
  return hex.padStart(64, "0");
}

function encodeAddress(address: string) {
  return padTo32Bytes(stripHexPrefix(address).toLowerCase());
}

function encodeUint256(value: bigint) {
  return padTo32Bytes(value.toString(16));
}

export function encodeAllowanceCallData(owner: string, spender: string) {
  return `${ALLOWANCE_SELECTOR}${encodeAddress(owner)}${encodeAddress(
    spender
  )}` as `0x${string}`;
}

export function encodeApproveCallData(spender: string, amount: bigint) {
  return `${APPROVE_SELECTOR}${encodeAddress(spender)}${encodeUint256(
    amount
  )}` as `0x${string}`;
}

export function hexToBigInt(value?: string | null) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("0x")) return null;
  const normalized = value === "0x" ? "0x0" : value;
  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}
