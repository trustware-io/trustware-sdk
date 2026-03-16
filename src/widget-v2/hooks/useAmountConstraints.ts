import { useMemo } from "react";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";

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

export function clampUsdAmount(
  raw: string,
  min?: number,
  max?: number
): string {
  if (!raw) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  let clamped = n;
  if (min != null && clamped < min) clamped = min;
  if (max != null && clamped > max) clamped = max;
  return clamped.toString();
}
