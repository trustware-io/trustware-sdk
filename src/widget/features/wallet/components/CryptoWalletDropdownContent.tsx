import type { DetectedWallet, WalletMeta } from "../../../../types";
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  shadows,
  spacing,
} from "../../../styles";
import { DetectedWalletRow } from "./DetectedWalletRow";
import { WalletConnectRow } from "./WalletConnectRow";
import { WalletDropdownEmptyState } from "./WalletDropdownEmptyState";
import {
  dividerBorderStyle,
  dropdownSectionHeadingStyle,
  dropdownStatusDotStyle,
  dropdownSurfaceStyle,
} from "./paymentOptionStyles";
import { WalletNamespaceTabs } from "./WalletNamespaceTabs";
import {
  useDepositNavigation,
  useDepositWallet,
  WalletNamespace,
} from "src/widget/context/DepositContext";
import { useIsMobile, useWalletInfo, WALLETS } from "src/wallets";
import { useEffect, useMemo, useRef, useState } from "react";

function ecosystemToNamespace(ecosystem: string): WalletNamespace | null {
  switch (ecosystem.trim().toLowerCase()) {
    case "evm":
      return "evm";
    case "solana":
      return "Solana";
    case "bitcoin":
      return "bitcoin";
    default:
      return null;
  }
}

export interface CryptoWalletDropdownContentProps {
  browserWallets: DetectedWallet[];
  handleWalletConnect: () => Promise<void>;
  handleWalletSelect: (wallet: DetectedWallet) => Promise<void>;
}

function DesktopWalletDropdownContent({
  browserWallets,
  handleWalletConnect,
  handleWalletSelect,
}: CryptoWalletDropdownContentProps) {
  const { selectedNamespace } = useDepositWallet();
  return (
    <div
      style={{
        ...dropdownSurfaceStyle,
        maxHeight: "16rem",
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.large,
        border: `1px solid rgba(63, 63, 70, 0.5)`,
        zIndex: 100,
        overflow: "auto",
        animation: "tw-fade-in 0.2s ease-out",
        scrollbarWidth: "thin",
        scrollbarColor: `${colors.muted} transparent`,
      }}
    >
      <div style={{ padding: spacing[3] }}>
        <div style={dropdownSectionHeadingStyle}>
          <div style={dropdownStatusDotStyle(colors.green[500])} />
          <span
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.normal,
              color: colors.primary,
            }}
          >
            {browserWallets.length > 0
              ? "Detected Wallets"
              : "No Wallets Detected"}
          </span>

          <div style={{ display: "flex", gap: spacing[2] }}>
            <WalletNamespaceTabs showBitcoin={false} />
          </div>
        </div>

        {browserWallets.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[1],
            }}
          >
            {browserWallets.map((wallet) => (
              <DetectedWalletRow
                key={wallet.meta.id}
                wallet={wallet}
                onSelect={handleWalletSelect}
              />
            ))}
          </div>
        ) : (
          <WalletDropdownEmptyState />
        )}
      </div>

      <div style={dividerBorderStyle} />

      <div style={{ padding: spacing[3] }}>
        {selectedNamespace === "evm" && (
          <WalletConnectRow onClick={handleWalletConnect} />
        )}
      </div>
    </div>
  );
}

// A row to render: static wallet metadata, plus the live DetectedWallet if an
// injected provider for it happens to be present right now (e.g. the user is
// browsing inside that wallet's own in-app browser).
interface MobileWalletEntry {
  meta: WalletMeta;
  detectedWallet: DetectedWallet | null;
}

function MobileWalletDropdownContent({
  browserWallets,
  handleWalletConnect,
  handleWalletSelect: connectDetectedWallet,
}: CryptoWalletDropdownContentProps) {
  const { setCurrentStep } = useDepositNavigation();

  const { selectedNamespace, setSelectedNamespace } = useDepositWallet();

  const { walletMetaId, isConnected, status, detected } = useWalletInfo();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const storeFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (storeFallbackTimeoutRef.current !== null) {
        clearTimeout(storeFallbackTimeoutRef.current);
      }
    };
  }, []);

  // A deep link round-trip lands here as a fresh page load inside the
  // target wallet's own in-app browser, where `selectedNamespace` has reset
  // to its default ("evm"). If that wallet's provider is for a different
  // ecosystem (e.g. Phantom's Solana provider), `browserWallets` — already
  // filtered to the current namespace upstream — is empty and its row never
  // appears, so the user has no way to connect without knowing to tap the
  // other tab first. Auto-switch to whatever ecosystem was actually
  // detected when the current tab has nothing to show.
  useEffect(() => {
    if (browserWallets.length > 0) return;

    const otherEcosystemWallet = detected.find((d) => {
      if (d.meta.id === "walletconnect") return false;
      const ecosystem = d.meta.ecosystem.trim().toLowerCase();
      return (
        ecosystem !== "multi" &&
        ecosystem !== selectedNamespace.trim().toLowerCase()
      );
    });
    if (!otherEcosystemWallet) return;

    const nextNamespace = ecosystemToNamespace(
      otherEcosystemWallet.meta.ecosystem
    );
    if (nextNamespace) setSelectedNamespace(nextNamespace);
  }, [browserWallets, detected, selectedNamespace, setSelectedNamespace]);

  const connectedWalletId = isConnected ? walletMetaId : null;

  const currentUrl = window.location.href;

  // Merge the static deep-linkable registry with whatever is actually
  // detected (injected) right now, and include detected wallets even when
  // they have no deep link — inside a wallet's in-app browser the injected
  // provider is the only way to connect.
  const mobileWallets = useMemo<MobileWalletEntry[]>(() => {
    const entries: MobileWalletEntry[] = WALLETS.filter((w) => {
      if (w.id === "walletconnect") {
        return selectedNamespace.trim().toLowerCase() === "evm";
      }

      const isDetected = browserWallets.some((d) => d.meta.id === w.id);
      const hasMobileLink = Boolean(w.deepLink);
      if (!hasMobileLink && !isDetected) return false;

      return (
        w.ecosystem.trim().toLowerCase() === "multi" ||
        w.ecosystem.trim().toLowerCase() ===
          selectedNamespace.trim().toLowerCase()
      );
    }).map((meta) => ({
      meta,
      detectedWallet: browserWallets.find((d) => d.meta.id === meta.id) ?? null,
    }));

    // Detected wallets whose id isn't in the static registry list at all
    const listedIds = new Set(entries.map((e) => e.meta.id));
    for (const detected of browserWallets) {
      if (!listedIds.has(detected.meta.id)) {
        entries.push({ meta: detected.meta, detectedWallet: detected });
      }
    }
    return entries;
  }, [browserWallets, selectedNamespace]);

  const handleWalletSelect = (entry: MobileWalletEntry) => {
    const { meta: wallet, detectedWallet } = entry;

    if (wallet.id === "walletconnect") {
      handleWalletConnect();
      return;
    }

    // An injected provider for this wallet is present right now (e.g. we're
    // inside that wallet's own in-app browser) — connect directly instead of
    // deep-linking, which is a no-op inside the wallet's browser.
    if (detectedWallet) {
      void connectDetectedWallet(detectedWallet);
      return;
    }

    if (wallet.deepLink) {
      const deepLinkUrl = wallet.deepLink(currentUrl);
      if (deepLinkUrl) {
        window.location.assign(deepLinkUrl);

        if (storeFallbackTimeoutRef.current !== null) {
          clearTimeout(storeFallbackTimeoutRef.current);
        }
        storeFallbackTimeoutRef.current = setTimeout(() => {
          storeFallbackTimeoutRef.current = null;
          const isIos = /iPhone|iPad/i.test(navigator.userAgent);
          const storeUrl = isIos ? wallet.ios : wallet.android;
          if (storeUrl) window.location.assign(storeUrl); // ✅
        }, 1500);
        return;
      }
    }

    // App store fallback
    const isIos = /iPhone|iPad/i.test(navigator.userAgent);
    const storeUrl = isIos ? wallet.ios : wallet.android;
    if (storeUrl) window.location.assign(storeUrl); // ✅
  };

  const handleContinue = () => {
    if (isConnected && status === "connected") {
      setCurrentStep("crypto-pay");
    } else {
      alert("Please connect your wallet first.");
    }
  };

  const showContinueButton = useMemo(
    () => isConnected && status === "connected",
    [isConnected, status]
  );

  return (
    <div
      style={{
        ...dropdownSurfaceStyle,
        maxHeight: "16rem",
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.large,
        border: `1px solid rgba(63, 63, 70, 0.5)`,
        zIndex: 100,
        overflow: "hidden", // changed from auto
        animation: "tw-fade-in 0.2s ease-out",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          padding: spacing[2],
        }}
      >
        <div style={{ display: "flex", gap: spacing[2] }}>
          <WalletNamespaceTabs showBitcoin={false} />
        </div>
      </div>
      {/* scrollable wallet list */}
      <div
        style={{
          padding: spacing[3],
          overflowY: "auto",
          flex: 1,
          scrollbarWidth: "thin",
          scrollbarColor: `${colors.muted} transparent`,
        }}
      >
        {mobileWallets.map((entry) => {
          const wallet = entry.meta;
          const isConnectedWallet = wallet.id === connectedWalletId;
          // Rows with a live injected provider stay tappable even while
          // another wallet is connected — selecting one switches wallets.
          const isDisabled =
            isConnected && !isConnectedWallet && !entry.detectedWallet;
          const isHovered = hoveredId === wallet.id;

          return (
            <button
              key={wallet.id}
              type="button"
              onClick={() => !isDisabled && handleWalletSelect(entry)}
              onMouseEnter={() => !isDisabled && setHoveredId(wallet.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: spacing[2],
                borderRadius: borderRadius.lg,
                transition: "background-color 0.2s",
                border: "none",
                backgroundColor: isHovered
                  ? "rgba(255,255,255,0.06)"
                  : "transparent",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
                fontFamily: "inherit",
                fontSize: fontSize.sm,
                outline: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[2],
                }}
              >
                <img
                  src={wallet.logo ?? wallet.emoji}
                  alt={wallet.name}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: borderRadius.lg,
                    objectFit: "cover",
                  }}
                />
                <span
                  style={{
                    fontWeight: fontWeight.medium,
                    fontSize: fontSize.sm,
                    color: colors.foreground,
                  }}
                >
                  {wallet.name}
                </span>
              </div>

              {/* connected indicator */}
              {isConnectedWallet && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing[1],
                  }}
                >
                  <div
                    style={{
                      width: "0.5rem",
                      height: "0.5rem",
                      borderRadius: "50%",
                      backgroundColor: "#22c55e",
                    }}
                  />
                  <span style={{ fontSize: fontSize.xs, color: "#22c55e" }}>
                    {/* Connected */}
                    Continue
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {/* sticky continue button at bottom */}
      {showContinueButton && (
        <div
          style={{
            padding: spacing[3],
            borderTop: `1px solid rgba(63, 63, 70, 0.5)`,
            backgroundColor: colors.card,
          }}
        >
          <button
            onClick={handleContinue}
            style={{
              width: "100%",
              padding: `${spacing[2]} ${spacing[3]}`,
              borderRadius: borderRadius.lg,
              border: "none",
              backgroundColor: colors.primary,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

export function CryptoWalletDropdownContent({
  browserWallets,
  handleWalletConnect,
  handleWalletSelect,
}: CryptoWalletDropdownContentProps): React.ReactElement {
  const isMobile = useIsMobile();
  return (
    <>
      {!isMobile && (
        <DesktopWalletDropdownContent
          browserWallets={browserWallets}
          handleWalletConnect={handleWalletConnect}
          handleWalletSelect={handleWalletSelect}
        />
      )}

      {isMobile && (
        <MobileWalletDropdownContent
          browserWallets={browserWallets}
          handleWalletConnect={handleWalletConnect}
          handleWalletSelect={handleWalletSelect}
        />
      )}
    </>
  );
}
