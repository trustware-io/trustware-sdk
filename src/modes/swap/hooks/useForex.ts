import { useEffect, useRef, useState } from "react";
import { fetchForexRates } from "src/core/forex";
import type { ForexRates } from "src/core/forex";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export function useForex(): ForexRates {
  const [rates, setRates] = useState<ForexRates>({ USD: 1 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchForexRates("USD")
        .then((r) => {
          if (!cancelled) setRates(r);
        })
        .catch(() => {
          /* keep stale rates on error */
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

  return rates;
}
