import { useMemo } from "react";
import { useTrustwareConfig } from "../../hooks/useTrustwareConfig";

export type AmountConstraints = {
  fixedFromAmountString?: string;
  fixedFromAmountValue?: number;
  isFixedAmount: boolean;
  minAmountUsd?: number;
  maxAmountUsd?: number;
};

function parsePositiveNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  const n = Number(str);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function useAmountConstraints(): AmountConstraints {
  const config = useTrustwareConfig();
  const routeOptions = config.routes?.options ?? {};

  const fixedFromAmountString = useMemo(() => {
    const raw = routeOptions.fixedFromAmount;
    if (raw === null || raw === undefined) return undefined;
    const str = String(raw).trim();
    if (!str) return undefined;
    const n = Number(str);
    return Number.isFinite(n) && n > 0 ? str : undefined;
  }, [routeOptions.fixedFromAmount]);

  const fixedFromAmountValue = useMemo(() => {
    if (!fixedFromAmountString) return undefined;
    const n = Number(fixedFromAmountString);
    return Number.isFinite(n) ? n : undefined;
  }, [fixedFromAmountString]);

  const minAmountUsd = useMemo(
    () => parsePositiveNumber(routeOptions.minAmountOut),
    [routeOptions.minAmountOut]
  );
  const maxAmountUsd = useMemo(
    () => parsePositiveNumber(routeOptions.maxAmountOut),
    [routeOptions.maxAmountOut]
  );

  return {
    fixedFromAmountString,
    fixedFromAmountValue,
    isFixedAmount: fixedFromAmountValue !== undefined,
    minAmountUsd,
    maxAmountUsd,
  };
}

export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
}

export function formatUsdAmount(
  value: number,
  maximumFractionDigits = 2
): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

export function getUsdAmountRangeError(
  amount: number,
  min?: number,
  max?: number
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (min != null && amount < min) {
    return `Minimum amount is ${formatUsdAmount(min)} USD`;
  }
  if (max != null && amount > max) {
    return `Maximum amount is ${formatUsdAmount(max)} USD`;
  }
  return null;
}
