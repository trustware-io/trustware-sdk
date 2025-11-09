/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import type {
  DetectedWallet,
  EIP6963ProviderDetail,
  WalletMeta,
  WalletId,
} from "../types/";
import { WALLETS } from "./metadata";

type AnnounceEvent = CustomEvent<{
  info: EIP6963ProviderDetail["info"];
  provider: any;
}>;

function flagMatch(meta: WalletMeta, p: any): boolean {
  if (!meta.detectFlags?.length) return false;
  const eth = p ?? (globalThis as any).ethereum;
  if (!eth) return false;

  const multi = Array.isArray(eth.providers) ? eth.providers : [eth];
  return multi.some((prov: any) =>
    meta.detectFlags!.some((flag) => Boolean((prov as any)?.[flag])),
  );
}

const GENERIC_DETECT_FLAGS = new Set(["isMetaMask"]);
const WALLET_ORDER = new Map(WALLETS.map((w, idx) => [w.id, idx]));

function isGenericFlagMatch(meta: WalletMeta): boolean {
  const flags = meta.detectFlags ?? [];
  if (!flags.length) return false;
  return flags.every((flag) => GENERIC_DETECT_FLAGS.has(flag));
}

function compareFlagMatches(a: WalletMeta, b: WalletMeta): number {
  const aGeneric = isGenericFlagMatch(a);
  const bGeneric = isGenericFlagMatch(b);
  if (aGeneric !== bGeneric) return aGeneric ? 1 : -1;

  const aFlags = a.detectFlags?.length ?? 0;
  const bFlags = b.detectFlags?.length ?? 0;
  if (aFlags !== bFlags) return bFlags - aFlags;

  const aOrder = WALLET_ORDER.get(a.id) ?? Number.MAX_SAFE_INTEGER;
  const bOrder = WALLET_ORDER.get(b.id) ?? Number.MAX_SAFE_INTEGER;
  return aOrder - bOrder;
}

export function pickMetaForInjected(p: any): WalletMeta {
  // Try to match by flags first; otherwise fall back to "injected" generic
  const flagMatches = WALLETS.filter((m) => flagMatch(m, p));
  if (flagMatches.length) {
    const bestMatch = flagMatches.reduce<WalletMeta | null>((best, current) => {
      if (!best) return current;
      return compareFlagMatches(current, best) < 0 ? current : best;
    }, null);
    if (bestMatch) return bestMatch;
  }

  // Heuristic by name string if present
  const name =
    p?.providerInfo?.name ||
    p?.info?.name ||
    (p?.isRabby && "Rabby") ||
    (p?.isMetaMask && "MetaMask") ||
    (p?.isBraveWallet && "Brave Wallet") ||
    (p?.isCoinbaseWallet && "Coinbase Wallet") ||
    "Injected Wallet";

  const normalizedId = name.toLowerCase().replace(/\s+/g, "-") as WalletId;
  const known = WALLETS.find((w) => w.id === normalizedId);
  if (known) return known;

  const isMetaMaskName = /metamask/i.test(name);
  if (isMetaMaskName) {
    const metamask = WALLETS.find((w) => w.id === "metamask");
    if (metamask) {
      return { ...metamask, name };
    }
  }

  return {
    id: normalizedId,
    name,
    category: "injected",
    logo: "",
    emoji: "👛",
  };
}

function rankDetected(list: DetectedWallet[]): DetectedWallet[] {
  const score = (id: WalletId, name: string) => {
    const s = `${id} ${name}`.toLowerCase();
    if (s.includes("rabby")) return 0;
    if (s.includes("metamask")) return 1;
    if (s.includes("coinbase")) return 2;
    if (s.includes("okx")) return 3;
    if (s.includes("brave")) return 99;
    return 50;
  };
  return [...list].sort(
    (a, b) => score(a.meta.id, a.meta.name) - score(b.meta.id, b.meta.name),
  );
}

export function useWalletDetection(timeoutMs = 400) {
  const [detected, setDetected] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    let done = false;
    const w = window as any;
    const announced: EIP6963ProviderDetail[] = [];

    const onAnnounce = (e: Event) => {
      const ce = e as AnnounceEvent;
      if (ce?.detail?.provider?.request) {
        announced.push({
          info: ce.detail.info,
          provider: ce.detail.provider,
          methods: [],
          events: [],
        } as unknown as EIP6963ProviderDetail);
      }
    };

    // EIP-6963 dance
    w.addEventListener?.("eip6963:announceProvider", onAnnounce);
    w.dispatchEvent?.(new Event("eip6963:requestProvider"));

    const tid = setTimeout(() => {
      if (done) return;

      const candidates: any[] = [];
      // Injected legacy
      if (w.ethereum?.request) {
        const multi = Array.isArray(w.ethereum.providers)
          ? w.ethereum.providers
          : [w.ethereum];
        for (const p of multi) if (p?.request) candidates.push(p);
      }
      // 6963-announced
      for (const d of announced)
        if (d.provider?.request) candidates.push(d.provider);

      // Dedup by reference
      const uniq = Array.from(new Set(candidates));

      const out: DetectedWallet[] = uniq.map((p) => {
        // Prefer mapping to known meta when possible
        const meta = pickMetaForInjected(p);
        return { meta, via: "eip6963", provider: p };
      });

      setDetected(rankDetected(out));
      w.removeEventListener?.("eip6963:announceProvider", onAnnounce);
      done = true;
    }, timeoutMs);

    return () => {
      clearTimeout(tid);
      w.removeEventListener?.("eip6963:announceProvider", onAnnounce);
    };
  }, [timeoutMs]);

  const detectedIds = useMemo(
    () => new Set(detected.map((d) => d.meta.id)),
    [detected],
  );

  return { detected, detectedIds };
}

// Minimal mobile test
export function useIsMobile() {
  const [isMobile, set] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    set(/Android|iPhone|iPad|iPod/i.test(ua));
  }, []);
  return isMobile;
}
