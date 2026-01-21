/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import type {
  DetectedWallet,
  EIP6963ProviderDetail,
  WalletMeta,
  WalletId,
} from "../types/";
import { WALLETS } from "./metadata";
import { isWalletConnectConfigured } from "./walletconnect";

type AnnounceEvent = CustomEvent<{
  info: EIP6963ProviderDetail["info"];
  provider: any;
}>;

// ────────────────────────────────────────────────────────────
// Lookup tables
// ────────────────────────────────────────────────────────────

const WALLET_BY_ID = new Map<WalletId, WalletMeta>(
  WALLETS.map((w) => [w.id, w])
);

// Used for ranking detected wallets
const DETECT_PRIORITY = new Map<WalletId, number>(
  WALLETS.map((w, idx) => [w.id, idx])
);

// Flags that are "compat only" and should never beat a more specific match
const GENERIC_FLAGS = new Set(["isMetaMask"]);

// rdns → wallet id for 6963
const RDNS_WALLET_MAP: { pattern: RegExp; id: WalletId }[] = [
  { pattern: /com\.bitget\.web3/i, id: "bitget" },
  { pattern: /io\.zerion\.wallet/i, id: "zerion" },
  { pattern: /io\.metamask/i, id: "metamask" },
  { pattern: /wallet\.coinbase\.com|com\.coinbase\.wallet/i, id: "coinbase" },
  { pattern: /app\.phantom|phantom\.app/i, id: "phantom-evm" },
  { pattern: /com\.okex\.wallet|com\.okx\.wallet/i, id: "okx" },
  { pattern: /com\.trustwallet/i, id: "trust" },
  { pattern: /taho/i, id: "taho" }, // 🔧 fixed id to "taho"
  { pattern: /safe\.gnosis/i, id: "safe" },
  { pattern: /kucoin/i, id: "kucoin" },
  { pattern: /io\.rabby/i, id: "rabby" },
  { pattern: /io\.rainbow/i, id: "rainbow" },
];

// name → wallet id
const NAME_WALLET_MAP: { pattern: RegExp; id: WalletId }[] = [
  { pattern: /metamask/i, id: "metamask" },
  { pattern: /rabby/i, id: "rabby" },
  { pattern: /coinbase/i, id: "coinbase" },
  { pattern: /rainbow/i, id: "rainbow" },
  { pattern: /\btaho\b|\btally\b/i, id: "taho" },
  { pattern: /okx|okex/i, id: "okx" },
  { pattern: /trust\s*wallet/i, id: "trust" },
  { pattern: /bitget/i, id: "bitget" },
  { pattern: /phantom/i, id: "phantom-evm" },
  { pattern: /\bsafe\b/i, id: "safe" },
  { pattern: /zerion/i, id: "zerion" },
  { pattern: /kucoin/i, id: "kucoin" },
];

// ────────────────────────────────────────────────────────────
// Helpers – generic utilities
// ────────────────────────────────────────────────────────────

function getProviderName(
  detail?: EIP6963ProviderDetail,
  provider?: any
): string | undefined {
  return (
    detail?.info?.name ||
    provider?.providerInfo?.name ||
    provider?.info?.name ||
    undefined
  );
}

function getProviderRdns(
  detail?: EIP6963ProviderDetail,
  provider?: any
): string | undefined {
  return (
    detail?.info?.rdns ||
    provider?.providerInfo?.rdns ||
    provider?.info?.rdns ||
    provider?.walletMeta?.rdns ||
    undefined
  );
}

function findWalletByRdns(rdns?: string): WalletMeta | undefined {
  if (!rdns) return undefined;
  for (const { pattern, id } of RDNS_WALLET_MAP) {
    if (pattern.test(rdns)) {
      return WALLET_BY_ID.get(id);
    }
  }
  return undefined;
}

function findWalletByName(rawName?: string): WalletMeta | undefined {
  const name = rawName?.trim();
  if (!name) return undefined;

  // 1) Regex mapping
  for (const { pattern, id } of NAME_WALLET_MAP) {
    if (pattern.test(name)) {
      return WALLET_BY_ID.get(id);
    }
  }

  // 2) Simple normalized id
  const rawId = name.toLowerCase().replace(/\s+/g, "-");
  let normalizedId = rawId as WalletId;

  if (rawId === "bitget-wallet") normalizedId = "bitget";
  if (rawId === "coinbase-wallet") normalizedId = "coinbase";
  if (rawId === "brave-wallet") normalizedId = "brave";
  if (rawId === "trust-wallet") normalizedId = "trust";

  return WALLET_BY_ID.get(normalizedId);
}

function createGenericWalletMeta(name: string): WalletMeta {
  const rawId = name.toLowerCase().replace(/\s+/g, "-") || "injected-wallet";
  return {
    id: rawId as WalletId,
    name,
    category: "injected",
    logo: "",
    emoji: "👛",
  };
}

// ────────────────────────────────────────────────────────────
// Flag-based detection
// ────────────────────────────────────────────────────────────

// IMPORTANT: only look at *this* provider’s flags.
// Do NOT walk provider.providers – that caused Rabby/MM
// flags to "bleed" into other providers like Taho.
function hasFlagOnProvider(provider: any, flag: string): boolean {
  return Boolean(provider?.[flag]);
}

type FlagMatch = {
  meta: WalletMeta;
  isGeneric: boolean;
};

function findWalletByFlags(provider: any): FlagMatch | undefined {
  const matches: FlagMatch[] = [];

  for (const meta of WALLETS) {
    if (!meta.detectFlags?.length) continue;
    const hit = meta.detectFlags.some((flag) =>
      hasFlagOnProvider(provider, flag)
    );
    if (!hit) continue;

    const isGeneric = meta.detectFlags.every((f) => GENERIC_FLAGS.has(f));
    matches.push({ meta, isGeneric });
  }

  if (!matches.length) return undefined;

  // Prefer non-generic matches (e.g., isRabby) over generic (isMetaMask only)
  const nonGeneric = matches.filter((m) => !m.isGeneric);
  const pool = nonGeneric.length ? nonGeneric : matches;

  return pool.reduce((best, current) => {
    const bestScore =
      DETECT_PRIORITY.get(best.meta.id as WalletId) ?? Number.MAX_SAFE_INTEGER;
    const currentScore =
      DETECT_PRIORITY.get(current.meta.id as WalletId) ??
      Number.MAX_SAFE_INTEGER;
    return currentScore < bestScore ? current : best;
  });
}

// ────────────────────────────────────────────────────────────
// Main resolver – how a provider becomes WalletMeta
// ────────────────────────────────────────────────────────────

function resolveWalletMeta(
  provider: any,
  detail?: EIP6963ProviderDetail
): WalletMeta {
  const rdns = getProviderRdns(detail, provider);
  const nameFromProvider =
    getProviderName(detail, provider) ||
    (provider?.isRabby && "Rabby") ||
    (provider?.isBraveWallet && "Brave Wallet") ||
    (provider?.isCoinbaseWallet && "Coinbase Wallet") ||
    (provider?.isOkxWallet && "OKX") ||
    (provider?.isRainbow && "Rainbow") ||
    (provider?.isTahoWallet && "Taho") ||
    (provider?.isTally && "Taho") ||
    (provider?.isTrustWallet && "Trust Wallet") ||
    (provider?.isBitGetWallet && "Bitget Wallet") ||
    (provider?.isMetaMask && "MetaMask") ||
    "Injected Wallet";

  // 1) rdns is the most precise
  const rdnsMatch = findWalletByRdns(rdns);
  if (rdnsMatch) return rdnsMatch;

  // 2) Try name-based mapping
  const nameMatch = findWalletByName(nameFromProvider);

  // 3) Try flag-based mapping
  const flagMatch = findWalletByFlags(provider);

  // 4) Combine name vs flag in a sane way:
  //    - If both agree on id → use that meta.
  //    - If they disagree and the flag is generic (MetaMask compat),
  //      trust the name instead.
  if (nameMatch && flagMatch) {
    if (nameMatch.id === flagMatch.meta.id) {
      return nameMatch;
    }
    if (flagMatch.isGeneric && nameMatch.id !== "metamask") {
      return nameMatch;
    }
    return flagMatch.meta;
  }

  if (nameMatch) return nameMatch;
  if (flagMatch) return flagMatch.meta;

  // 5) Fallback generic
  return createGenericWalletMeta(nameFromProvider);
}

// ────────────────────────────────────────────────────────────
// WalletConnect virtual entry
// ────────────────────────────────────────────────────────────

/**
 * Create a "virtual" WalletConnect detected wallet entry.
 * This is shown when WalletConnect is configured but not an injected wallet.
 */
export function createWalletConnectEntry(): DetectedWallet {
  const wcMeta = WALLET_BY_ID.get("walletconnect");
  if (!wcMeta) {
    throw new Error("WalletConnect metadata not found");
  }
  return {
    meta: wcMeta,
    via: "walletconnect",
    provider: undefined, // No provider until connected
  };
}

// ────────────────────────────────────────────────────────────
// Ranking + conversion
// ────────────────────────────────────────────────────────────

function rankDetected(list: DetectedWallet[]): DetectedWallet[] {
  const priority = (id: WalletId) =>
    DETECT_PRIORITY.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort(
    (a, b) => priority(a.meta.id as WalletId) - priority(b.meta.id as WalletId)
  );
}

export function buildDetectedWalletFromProvider(
  provider: any,
  providerDetailMap: Map<any, EIP6963ProviderDetail>
): DetectedWallet {
  const detail = providerDetailMap.get(provider);
  const meta = resolveWalletMeta(provider, detail);

  return {
    meta,
    via: detail ? "eip6963" : "injected-flag",
    provider,
    detail,
  };
}

// ────────────────────────────────────────────────────────────
// React hooks
// ────────────────────────────────────────────────────────────

export function useWalletDetection(timeoutMs = 400) {
  const [detected, setDetected] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    let done = false;
    const w = window as any;
    const announced: EIP6963ProviderDetail[] = [];
    const providerDetailMap = new Map<any, EIP6963ProviderDetail>();

    const onAnnounce = (e: Event) => {
      const ce = e as AnnounceEvent;
      if (ce?.detail?.provider?.request) {
        const detail = {
          info: ce.detail.info,
          provider: ce.detail.provider,
          methods: [],
          events: [],
        } as unknown as EIP6963ProviderDetail;

        providerDetailMap.set(detail.provider, detail);
        announced.push(detail);
      }
    };

    // EIP-6963 discovery
    w.addEventListener?.("eip6963:announceProvider", onAnnounce);
    w.dispatchEvent?.(new Event("eip6963:requestProvider"));

    const tid = setTimeout(() => {
      if (done) return;

      const candidates = new Map<any, EIP6963ProviderDetail | undefined>();

      // Legacy injected: window.ethereum / window.ethereum.providers
      if (w.ethereum?.request) {
        const multi = Array.isArray(w.ethereum.providers)
          ? w.ethereum.providers
          : [w.ethereum];

        for (const p of multi) {
          if (!p?.request) continue;
          const detail = providerDetailMap.get(p);
          candidates.set(p, detail);
        }
      }

      // EIP-6963-announced providers
      for (const d of announced) {
        if (!d.provider?.request) continue;
        providerDetailMap.set(d.provider, d);
        candidates.set(d.provider, d);
      }

      const out: DetectedWallet[] = [];
      const seenIds = new Set<string>();

      for (const [provider] of candidates) {
        const wallet = buildDetectedWalletFromProvider(provider, providerDetailMap);
        // Deduplicate by wallet ID (same wallet can be detected via multiple methods)
        if (!seenIds.has(wallet.meta.id)) {
          seenIds.add(wallet.meta.id);
          out.push(wallet);
        }
      }

      // Always add WalletConnect as an option (built-in, enabled by default)
      // Only skip if explicitly disabled via config
      const hasWalletConnect = seenIds.has("walletconnect");
      if (!hasWalletConnect && isWalletConnectConfigured()) {
        out.push(createWalletConnectEntry());
      }

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
    [detected]
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
