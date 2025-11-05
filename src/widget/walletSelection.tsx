import React, { useState, useEffect, useMemo } from "react";
import {
  useIsMobile,
  useWalletDetection,
  POPULAR_ORDER,
  WALLETS,
  walletManager,
  formatDeepLink,
} from "../wallets/";
import { WalletMeta } from "../types/";
import { useTrustwareConfig } from "../hooks/useTrustwareConfig";

// =============================================
// Notes & Integration
// =============================================
// • Ensure logos exist at /public/assets/wallets/*.svg. If not, the emoji fallback is used.
// • Wagmi config should include connectors for: injected(), walletConnect({ projectId }), coinbaseWallet(), and optionally safe().
// • This component prefers a connector by name, then by category (injected/walletConnect), then falls back to app store / deep link.
// • Mobile: if no connector, deep-links into installed app using the current URL (DApp browser).
// • EIP-6963: multiple injected providers supported; legacy window.ethereum flags are also recognized.
// • Customize POPULAR_ORDER and WALLETS to your liking.
//
type WalletSelectionProps = {
  onBack?: () => void;
  onNext: () => void;
};

export function WalletSelection({ onBack, onNext }: WalletSelectionProps) {
  const isMobile = useIsMobile();
  const { detected, detectedIds } = useWalletDetection();
  const config = useTrustwareConfig();
  const [selectedWallet, setSelectedWallet] = useState<WalletMeta | null>(null);
  const [destinationChain, setDestinationChain] = useState(
    () => config.routes.toChain,
  );
  const [destinationToken, setDestinationToken] = useState(
    () => config.routes.toToken,
  );
  const [slippage, setSlippage] = useState(
    () => config.routes.defaultSlippage,
  );

  useEffect(() => {
    walletManager.setDetected(detected);
  }, [detected]);

  useEffect(() => {
    setDestinationChain(config.routes.toChain);
  }, [config.routes.toChain]);

  useEffect(() => {
    setDestinationToken(config.routes.toToken);
  }, [config.routes.toToken]);

  useEffect(() => {
    setSlippage(config.routes.defaultSlippage);
  }, [config.routes.defaultSlippage]);

  const theme = config.theme;
  const messages = config.messages;
  const [showPopular, setShowPopular] = useState(false);
  const [status, setStatus] = useState(walletManager.status);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : ""),
    [],
  );

  useEffect(() => {
    const unsubscribe = walletManager.onChange((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus === "error") {
        const error = walletManager.error;
        const description =
          typeof error === "string"
            ? error
            : error instanceof Error && error.message
              ? error.message
              : "Failed to connect to wallet. Please try again.";
        setErrorMessage(description);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const detectedWallets = useMemo(() => {
    return WALLETS.filter((wallet) => detectedIds.has(wallet.id));
  }, [detectedIds]);

  const popularWallets = useMemo(() => {
    const map = new Map(WALLETS.map((meta) => [meta.id, meta]));
    return POPULAR_ORDER.map((id) => map.get(id)).filter(
      (meta): meta is WalletMeta => Boolean(meta),
    );
  }, []);

  const otherWallets = useMemo(() => {
    const popularIds = new Set(POPULAR_ORDER);
    return WALLETS.filter(
      (wallet) => !popularIds.has(wallet.id) && !detectedIds.has(wallet.id),
    );
  }, [detectedIds]);

  const openInstallOrDeepLink = (wallet: WalletMeta) => {
    if (typeof window === "undefined") return;
    const deepLink = formatDeepLink(wallet.id, currentUrl);
    if (isMobile && deepLink) {
      window.location.href = deepLink;
      return;
    }
    if (wallet.chromeWebStore) {
      window.open(wallet.chromeWebStore, "_blank", "noopener,noreferrer");
      return;
    }
    if (wallet.homepage) {
      window.open(wallet.homepage, "_blank", "noopener,noreferrer");
    }
  };

  const attemptConnection = async (wallet: WalletMeta) => {
    console.log("Selected wallet:", wallet);
    setSelectedWallet(wallet);
    setErrorMessage(null);
    if (walletManager.status === "connecting") return;

    if (detectedIds.has(wallet.id)) {
      const match = detected.find((dw) => dw.meta.id === wallet.id);
      if (match) {
        await walletManager.connectDetected(match);
        if (walletManager.status === "connected") {
          onNext();
        } else if (walletManager.status === "error") {
          const error = walletManager.error;
          const description =
            typeof error === "string"
              ? error
              : error instanceof Error && error.message
                ? error.message
                : "Failed to connect to wallet. Please try again.";
          setErrorMessage(description);
        }
        return;
      }
    }

    openInstallOrDeepLink(wallet);
  };

  const handleSelectWallet = (wallet: WalletMeta) => {
    void attemptConnection(wallet);
  };

  const handleContinue = () => {
    console.log("Continuing with wallet:", selectedWallet);
    if (status === "connected") {
      onNext();
      return;
    }
    if (!selectedWallet) return;
    void attemptConnection(selectedWallet);
  };


  const renderWalletRow = (wallet: WalletMeta) => {
    const detected = detectedIds.has(wallet.id);
    const isSelected = selectedWallet?.id === wallet.id;
    const isConnecting = status === "connecting" && isSelected;
    const isDisabled = status === "connecting";
    return (
      <button
        key={wallet.id}
        onClick={() => handleSelectWallet(wallet)}
        disabled={isDisabled}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px",
          borderRadius: `${theme.radius}px`,
          border: `1px solid ${isSelected ? theme.primaryColor : theme.borderColor
            }`,
          backgroundColor: isSelected
            ? theme.primaryColor
            : theme.backgroundColor,
          color: isSelected ? theme.backgroundColor : theme.textColor,
          cursor: isDisabled ? "not-allowed" : "pointer",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
          gap: "12px",
          opacity: isDisabled && !isSelected ? 0.65 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {wallet.logo ? (
            <img
              src={wallet.logo}
              alt={wallet.name}
              width={40}
              height={40}
              style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "contain" }}
            />
          ) : (
            <div style={{ fontSize: "1.5rem" }}>{wallet.emoji ?? "👛"}</div>
          )}
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, display: "flex", gap: "8px", alignItems: "center" }}>
              <span>{wallet.name}</span>
              {detected && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: `${theme.radius}px`,
                    backgroundColor: isSelected
                      ? theme.backgroundColor
                      : theme.primaryColor,
                    color: isSelected ? theme.primaryColor : theme.backgroundColor,
                  }}
                >
                  Detected
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              {isConnecting
                ? "Connecting…"
                : detected
                  ? "Detected in browser"
                  : wallet.category === "walletconnect"
                    ? "WalletConnect"
                    : wallet.category === "injected"
                      ? "Browser extension"
                      : isMobile
                        ? "Open in mobile app"
                        : "Use with mobile app"}
            </div>
          </div>
        </div>
        {isConnecting ? (
          <div style={{ fontSize: "1.25rem" }}>⏳</div>
        ) : (
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: `2px solid ${isSelected ? theme.backgroundColor : theme.borderColor}`,
              backgroundColor: isSelected ? theme.backgroundColor : "transparent",
            }}
          />
        )}
      </button>
    );
  };

  return (
    <>
      {errorMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#d32f2f",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: `${theme.radius}px`,
            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
            maxWidth: "280px",
          }}
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: theme.textColor,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxHeight: "90vh",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
              Select Your Wallet
            </h2>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex" }}>
                {["avax-logo-2.png", "ethereum-logo.svg", "fantom-logo.png", "tether-logo.svg", "polygon-logo.png", "usdc-logo.webp"].map(
                  (asset) => (
                    <img
                      key={asset}
                      src={`https://bv.trustware.io/assets/tokens/${asset}`}
                      alt={asset}
                      width={28}
                      height={28}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        border: `2px solid ${theme.borderColor}`,
                        marginLeft: "-8px",
                      }}
                    />
                  ),
                )}
              </div>
              <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                All tokens on all EVM networks accepted
              </span>
            </div>
          </div>

          <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: theme.primaryColor,
                }}
              />
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                Detected Wallets
              </h3>
            </div>
            {detectedWallets.length === 0 ? (
              <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
                No browser wallets detected.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {detectedWallets.map(renderWalletRow)}
              </div>
            )}
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              type="button"
              onClick={() => setShowPopular((value) => !value)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "transparent",
                border: "none",
                color: theme.textColor,
                cursor: "pointer",
                padding: 0,
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              <span>Popular Wallets</span>
              <span
                style={{
                  display: "inline-block",
                  transition: "transform 0.2s ease",
                  transform: showPopular ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                ▼
              </span>
            </button>
            {showPopular && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {popularWallets.map(renderWalletRow)}
              </div>
            )}
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
              More Wallets
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {otherWallets.map(renderWalletRow)}
            </div>
          </section>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: `${theme.radius}px`,
                border: `1px solid ${theme.borderColor}`,
                backgroundColor: theme.backgroundColor,
                color: theme.textColor,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={status !== "connected"}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: `${theme.radius}px`,
              border: "none",
              backgroundColor:
                status === "connected"
                  ? theme.primaryColor
                  : theme.borderColor,
              color:
                status === "connected"
                  ? theme.backgroundColor
                  : theme.textColor,
              cursor: status === "connected" ? "pointer" : "not-allowed",
            }}
          >
            {status === "connecting" ? "Connecting…" : "Continue"}
          </button>
        </div>

        <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
          Destination chain: {destinationChain} • Token: {destinationToken} •
          Slippage: {slippage}%
        </div>
      </div>
    </>
  );
}

