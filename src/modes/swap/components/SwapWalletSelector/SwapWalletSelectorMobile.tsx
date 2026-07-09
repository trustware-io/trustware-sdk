import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "src/widget/styles";
import { mergeStyles } from "src/widget/lib/utils";
import {
  useWalletDetection,
  useWalletInfo,
  useWalletConnectConnect,
} from "src/wallets";
// Assumption: WALLETS is re-exported from the same "src/wallets" barrel as the
// hooks above — adjust the import path if it actually lives elsewhere.
import { WALLETS } from "src/wallets";
import { TrustwareConfigStore } from "src/config";
import { toast } from "src/widget/components/Toast";
import type {
  DetectedWallet,
  WalletInterFaceAPI,
  WalletConnectConfig,
  WalletMeta,
} from "src/types";
import type { WalletStatus } from "src/widget/state/deposit/types";
// import { useDepositNavigation } from "src/widget/context/DepositContext";

type SwapNamespace = "evm" | "solana";

interface SwapWalletSelectorMobileProps {
  walletStatus: WalletStatus;
  walletAddress: string | null;
  connectWallet: (
    wallet: DetectedWallet
  ) => Promise<{ error: string | null; api: WalletInterFaceAPI | null }>;
  onBack: () => void;
  /** Called when the user taps "Continue" after a wallet is connected. */
  onContinue?: () => void;
}

// A row to render: static wallet metadata, plus the live DetectedWallet if an
// injected provider for it happens to be present right now (e.g. the user is
// browsing inside that wallet's own in-app browser).
interface MobileWalletEntry {
  meta: WalletMeta;
  detectedWallet: DetectedWallet | null;
}

function SwapWalletSelectorMobile({
  walletStatus,
  walletAddress,
  connectWallet,
  onBack,
}: SwapWalletSelectorMobileProps): React.ReactElement {
  const { detected } = useWalletDetection();
  const {
    isConnected: managerConnected,
    walletMetaId,
    connectedVia,
    disconnect,
    // status,
  } = useWalletInfo();

  //   const { setCurrentStep } = useDepositNavigation();

  const walletConnectCfg = TrustwareConfigStore.peek()?.walletConnect as
    WalletConnectConfig | undefined;
  const connectWC = useWalletConnectConnect(walletConnectCfg);

  const [wcConnecting, setWcConnecting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] =
    useState<SwapNamespace>("evm");
  const prevStatusRef = useRef(walletStatus);
  const storeFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev !== walletStatus) {
      if (
        prev === "connecting" &&
        (walletStatus === "connected" || walletStatus === "error")
      ) {
        setConnectingId(null);
      }
      prevStatusRef.current = walletStatus;
    }
  }, [walletStatus]);

  // Clear any pending app-store fallback redirect on unmount
  useEffect(() => {
    return () => {
      if (storeFallbackTimeoutRef.current !== null) {
        clearTimeout(storeFallbackTimeoutRef.current);
      }
    };
  }, []);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Merge the static wallet registry with whatever is actually detected
  // (injected) right now. WalletConnect is excluded here — it gets its own
  // dedicated row below, matching desktop.
  const mobileWalletEntries: MobileWalletEntry[] = useMemo(() => {
    return WALLETS.filter((w) => {
      if (w.id === "walletconnect") return false;

      const hasMobileLink = Boolean(w.deepLink);
      if (!hasMobileLink) return false;

      const ecosystem = w.ecosystem.trim().toLowerCase();
      return ecosystem === "multi" || ecosystem === selectedNamespace;
    }).map((meta) => ({
      meta,
      detectedWallet: detected.find((d) => d.meta.id === meta.id) ?? null,
    }));
  }, [detected, selectedNamespace]);

  const handleDisconnect = () => {
    void disconnect();
  };

  const handleWalletConnect = async () => {
    if (wcConnecting) return;
    if (connectedVia === "walletconnect" && managerConnected) {
      return;
    }
    setWcConnecting(true);
    try {
      const { error } = await connectWC();
      if (error) {
        toast.error("WalletConnect Failed", error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "WalletConnect failed";
      toast.error("WalletConnect Failed", msg);
    } finally {
      setWcConnecting(false);
    }
  };

  // No injected provider for this wallet — send the user out to its app,
  // falling back to the store if it doesn't come back to the foreground.
  const goToAppStore = (meta: WalletMeta) => {
    const isIos = /iPhone|iPad/i.test(navigator.userAgent);
    const storeUrl = isIos ? meta.ios : meta.android;
    if (storeUrl) window.location.assign(storeUrl);
  };

  const handleClick = async (entry: MobileWalletEntry) => {
    const { meta, detectedWallet } = entry;

    if (walletStatus === "connecting") return;

    // Already connected to this exact wallet — no need to reconnect
    if (managerConnected && walletMetaId === meta.id) {
      return;
    }

    // An injected provider for this wallet is present right now (e.g. we're
    // inside that wallet's own in-app browser) — connect directly, same as desktop.
    if (detectedWallet) {
      setConnectingId(meta.id);
      try {
        await connectWallet(detectedWallet);
      } catch (err) {
        setConnectingId(null);
        const msg =
          err instanceof Error ? err.message : "Failed to connect wallet";
        if (
          msg.toLowerCase().includes("rejected") ||
          msg.toLowerCase().includes("denied")
        ) {
          toast.error(
            "Connection Declined",
            "You declined the connection request."
          );
        } else {
          toast.error("Connection Failed", msg);
        }
      }
      return;
    }

    // No injected provider — deep link out to the wallet's app
    if (meta.deepLink) {
      const deepLinkUrl = meta.deepLink(currentUrl);
      if (deepLinkUrl) {
        window.location.assign(deepLinkUrl);
        if (storeFallbackTimeoutRef.current !== null) {
          clearTimeout(storeFallbackTimeoutRef.current);
        }
        storeFallbackTimeoutRef.current = setTimeout(() => {
          storeFallbackTimeoutRef.current = null;
          goToAppStore(meta);
        }, 1500);
        return;
      }
    }

    // No deep link scheme at all — go straight to the store
    goToAppStore(meta);
  };

  //   const isFullyConnected = managerConnected && walletStatus === "connected";

  const tabs: { id: SwapNamespace; label: string }[] = [
    { id: "evm", label: "EVM" },
    { id: "solana", label: "Solana" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `${spacing[4]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: spacing[1],
            marginRight: spacing[2],
            borderRadius: borderRadius.lg,
            backgroundColor: "transparent",
            border: 0,
            cursor: "pointer",
          }}
        >
          <svg
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: colors.foreground,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1
          style={{
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.foreground,
            textAlign: "center",
          }}
        >
          Connect Wallet
        </h1>
        {/* spacer so the title stays visually centered against the back button */}
        <div style={{ width: "1.25rem", marginLeft: spacing[2] }} aria-hidden />
      </div>

      {/* EVM / Solana segmented control */}
      <div style={{ padding: `${spacing[3]} ${spacing[4]} 0` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderRadius: borderRadius.lg,
            backgroundColor: colors.muted,
            padding: "3px",
            gap: "2px",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedNamespace(t.id)}
              style={{
                flex: 1,
                padding: `${spacing[1.5]} ${spacing[3]}`,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                borderRadius: borderRadius.md,
                background:
                  selectedNamespace === t.id ? colors.card : "transparent",
                border:
                  selectedNamespace === t.id
                    ? `1px solid ${colors.border}`
                    : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                color:
                  selectedNamespace === t.id
                    ? colors.foreground
                    : colors.mutedForeground,
                boxShadow:
                  selectedNamespace === t.id
                    ? "0 1px 3px rgba(0,0,0,0.08)"
                    : "none",
                outline: "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable wallet list */}
      <div
        style={{
          overflowY: "auto",
          padding: spacing[4],
          maxHeight: "31.25rem",
        }}
      >
        {mobileWalletEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: `${spacing[8]} 0` }}>
            <div style={{ fontSize: "2.5rem", marginBottom: spacing[4] }}>
              👛
            </div>
            <h3
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: colors.foreground,
                marginBottom: spacing[2],
              }}
            >
              No Wallets Found
            </h3>
            <p
              style={{
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
                marginBottom: spacing[4],
              }}
            >
              Please install a web3 wallet to continue.
            </p>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: `${spacing[2]} ${spacing[4]}`,
                borderRadius: borderRadius.lg,
                backgroundColor: colors.primary,
                color: colors.primaryForeground,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                textDecoration: "none",
              }}
            >
              Install MetaMask
            </a>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[3],
            }}
          >
            {mobileWalletEntries.map((entry) => {
              const { meta } = entry;
              const isWalletConnected =
                managerConnected && walletMetaId === meta.id;
              const isConnecting =
                connectingId === meta.id && walletStatus === "connecting";

              return (
                <div
                  key={meta.id}
                  style={mergeStyles(
                    {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[4],
                      padding: spacing[4],
                      borderRadius: borderRadius["2xl"],
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.border}`,
                    },
                    isWalletConnected && {
                      boxShadow: `0 0 0 2px ${colors.primary}`,
                      border: `1px solid ${colors.primary}`,
                    }
                  )}
                >
                  <div
                    style={{
                      width: "3rem",
                      height: "3rem",
                      borderRadius: borderRadius.xl,
                      backgroundColor: colors.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {meta.logo ? (
                      <img
                        src={meta.logo}
                        alt={meta.name}
                        style={{
                          width: "2rem",
                          height: "2rem",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "1.5rem" }}>
                        {meta.emoji || "👛"}
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontWeight: fontWeight.semibold,
                        color: colors.foreground,
                      }}
                    >
                      {meta.name}
                    </p>
                    {isWalletConnected && walletAddress && (
                      <p
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.mutedForeground,
                        }}
                      >
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </p>
                    )}
                  </div>

                  {isConnecting ? (
                    <div
                      style={{
                        width: "1.25rem",
                        height: "1.25rem",
                        border: `2px solid ${colors.mutedForeground}`,
                        borderTopColor: "transparent",
                        borderRadius: "9999px",
                        animation: "tw-spin 1s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                  ) : isWalletConnected ? (
                    <button
                      onClick={handleDisconnect}
                      style={{
                        padding: `${spacing[1.5]} ${spacing[3]}`,
                        borderRadius: "9999px",
                        backgroundColor: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        border: 0,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleClick(entry)}
                      disabled={walletStatus === "connecting"}
                      style={mergeStyles(
                        {
                          padding: `${spacing[1.5]} ${spacing[3]}`,
                          borderRadius: "9999px",
                          backgroundColor: "rgba(59,130,246,0.1)",
                          color: colors.primary,
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.medium,
                          border: 0,
                          cursor: "pointer",
                          flexShrink: 0,
                        },
                        walletStatus === "connecting" && {
                          opacity: 0.5,
                          cursor: "not-allowed",
                        }
                      )}
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* WalletConnect — EVM only, matches desktop behavior */}
        {selectedNamespace === "evm" && (
          <>
            <div
              style={{
                height: 1,
                backgroundColor: colors.border,
                margin: `${spacing[3]} 0`,
              }}
            />
            {(() => {
              const wcConnected =
                managerConnected && connectedVia === "walletconnect";
              return (
                <div
                  style={mergeStyles(
                    {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[4],
                      padding: spacing[4],
                      borderRadius: borderRadius["2xl"],
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.border}`,
                      cursor: "pointer",
                    },
                    wcConnected && {
                      boxShadow: `0 0 0 2px ${colors.primary}`,
                      border: `1px solid ${colors.primary}`,
                    }
                  )}
                  onClick={
                    !wcConnected ? () => void handleWalletConnect() : undefined
                  }
                >
                  <div
                    style={{
                      width: "3rem",
                      height: "3rem",
                      borderRadius: borderRadius.xl,
                      backgroundColor: colors.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      style={{
                        width: "1.5rem",
                        height: "1.5rem",
                        color: colors.blue[500],
                      }}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6.09 10.56c3.26-3.2 8.56-3.2 11.82 0l.39.39a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53c-2.28-2.23-5.97-2.23-8.24 0l-.58.56a.21.21 0 01-.3 0L5.66 11.6a.4.4 0 010-.58l.43-.46zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.43.43 0 01-.6 0l-3.82-3.74a.11.11 0 00-.15 0l-3.82 3.74a.43.43 0 01-.6 0L2.15 15.03a.4.4 0 010-.58l1.2-1.17a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0z" />
                    </svg>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontWeight: fontWeight.semibold,
                        color: colors.foreground,
                      }}
                    >
                      WalletConnect
                    </p>
                    {wcConnected && walletAddress && (
                      <p
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.mutedForeground,
                        }}
                      >
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </p>
                    )}
                  </div>

                  {wcConnecting ? (
                    <div
                      style={{
                        width: "1.25rem",
                        height: "1.25rem",
                        border: `2px solid ${colors.mutedForeground}`,
                        borderTopColor: "transparent",
                        borderRadius: "9999px",
                        animation: "tw-spin 1s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                  ) : wcConnected ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnect();
                      }}
                      style={{
                        padding: `${spacing[1.5]} ${spacing[3]}`,
                        borderRadius: "9999px",
                        backgroundColor: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        border: 0,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleWalletConnect();
                      }}
                      disabled={wcConnecting}
                      style={{
                        padding: `${spacing[1.5]} ${spacing[3]}`,
                        borderRadius: "9999px",
                        backgroundColor: "rgba(59,130,246,0.1)",
                        color: colors.primary,
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        border: 0,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Sticky continue button */}
      {/* {isFullyConnected && (
        <div
          style={{
            padding: spacing[3],
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
          }}
        >
          <button
            onClick={() => void handleContinue()}
            style={{
              width: "100%",
              padding: `${spacing[2]} ${spacing[3]}`,
              borderRadius: borderRadius.lg,
              border: "none",
              backgroundColor: colors.primary,
              color: colors.primaryForeground,
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
      )} */}
    </div>
  );
}

export default SwapWalletSelectorMobile;
