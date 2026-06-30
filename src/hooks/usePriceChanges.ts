import { useEffect, useMemo, useState } from "react";
import { TrustwareConfigStore } from "src/config";
import { apiBase } from "src/core/http";

type PriceChangeMap = Record<string, number | null>;

export function usePriceChanges(symbols: string[]) {
  const [data, setData] = useState<PriceChangeMap>({});
  const [loading, setLoading] = useState(true);

  const symbolsKey = useMemo(
    () => Array.from(new Set(symbols.filter(Boolean))).join(","),
    [symbols]
  );

  const cfg = TrustwareConfigStore.peek();

  useEffect(() => {
    if (!symbolsKey || !cfg?.apiKey) return;

    let cancelled = false;
    setLoading(true);

    const url = `${apiBase()}/v1/price-change/token-price-changes?symbols=${encodeURIComponent(symbolsKey)}`;

    fetch(url, {
      headers: { Accept: "application/json", "X-API-Key": cfg.apiKey },
    })
      .then((res) => {
        if (!res.ok) console.error("Request failed:", res.status);
        return res.json();
      })
      .then((json: PriceChangeMap) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbolsKey, cfg?.apiKey]);

  return { data, loading };
}

export function usePriceChange(symbol: string) {
  const { data, loading } = usePriceChanges([symbol]);
  return { priceChangePercent24h: data[symbol] ?? null, loading };
}
