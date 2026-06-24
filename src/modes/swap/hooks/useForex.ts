import { useEffect, useRef, useState } from "react";
import { fetchForexRates } from "src/core/forex";
import type { ForexRates } from "src/core/forex";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export interface UseForexResult {
  rates: ForexRates;
  error: Error | null;
  lastUpdated: number | null;
}

export function useForex(): UseForexResult {
  const [rates, setRates] = useState<ForexRates>({ USD: 1 });
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchForexRates("USD")
        .then((r) => {
          if (!cancelled) {
            setRates(r);
            setLastUpdated(Date.now());
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .finally(() => {
          if (!cancelled) {
            timerRef.current = setTimeout(load, REFRESH_MS);
          }
        });
    };

    load();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { rates, error, lastUpdated };
}
