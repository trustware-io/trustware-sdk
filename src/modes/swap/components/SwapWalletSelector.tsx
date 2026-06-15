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
import { TrustwareConfigStore } from "src/config";
import { toast } from "src/widget/components/Toast";
import type {
  DetectedWallet,
  WalletInterFaceAPI,
  WalletConnectConfig,
} from "src/types";
import type { WalletStatus } from "src/widget/state/deposit/types";

type SwapNamespace = "evm" | "solana";

interface SwapWalletSelectorProps {
  walletStatus: WalletStatus;
  walletAddress: string | null;
  connectWallet: (
    wallet: DetectedWallet
  ) => Promise<{ error: string | null; api: WalletInterFaceAPI | null }>;
  onBack: () => void;
}

export function SwapWalletSelector({
  walletStatus,
  walletAddress,
  connectWallet,
  onBack,
}: SwapWalletSelectorProps): React.ReactElement {
  const { detected } = useWalletDetection();
  const {
    isConnected: managerConnected,
    walletMetaId,
    connectedVia,
    disconnect,
  } = useWalletInfo();

  const walletConnectCfg = TrustwareConfigStore.peek()?.walletConnect as
    | WalletConnectConfig
    | undefined;
  const connectWC = useWalletConnectConnect(walletConnectCfg);
  const [wcConnecting, setWcConnecting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const [selectedNamespace, setSelectedNamespace] =
    useState<SwapNamespace>("evm");
  const prevStatusRef = useRef(walletStatus);

  useEffect(() => {
    const t = setTimeout(() => setTimerExpired(true), 450);
    return () => clearTimeout(t);
  }, []);

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

  // Filter by namespace — matches deposit mode's ecosystem comparison
  const filteredWallets = useMemo(
    () =>
      detected.filter(
        (w) => (w.meta?.ecosystem ?? "").toLowerCase() === selectedNamespace
      ),
    [detected, selectedNamespace]
  );

  const isDetecting = detected.length === 0 && !timerExpired;

  const handleDisconnect = () => {
    void disconnect();
  };

  const handleWalletConnect = async () => {
    if (wcConnecting) return;
    if (connectedVia === "walletconnect" && managerConnected) {
      onBack();
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

  const handleClick = async (wallet: DetectedWallet) => {
    if (walletStatus === "connecting") return;
    if (wallet.meta.id === "walletconnect" || wallet.via === "walletconnect") {
      toast.error("Not Available", "WalletConnect is not currently available.");
      return;
    }
    // Already connected to this exact wallet — no need to reconnect
    if (managerConnected && walletMetaId === wallet.meta.id) {
      onBack();
      return;
    }
    setConnectingId(wallet.meta.id);
    try {
      await connectWallet(wallet);
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
  };

  const tabs: { id: SwapNamespace; label: string }[] = [
    { id: "evm", label: "EVM" },
    { id: "solana", label: "Solana" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
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

        {/* EVM / Solana pill tabs */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            borderRadius: "9999px",
            background: colors.background,
            border: `1px solid ${colors.mutedForeground}`,
            padding: "3px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              width: "calc(50% - 3px)",
              borderRadius: "9999px",
              background: `linear-gradient(to bottom, ${colors.zinc[100]}, ${colors.zinc[200]})`,
              border: `1px solid ${colors.mutedForeground}`,
              transition: "transform 300ms ease-out",
              transform:
                selectedNamespace === "evm"
                  ? "translateX(0)"
                  : "translateX(100%)",
            }}
          />
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedNamespace(t.id)}
              style={{
                position: "relative",
                zIndex: 10,
                padding: "4px 11px",
                fontSize: "10px",
                outline: "none",
                fontWeight: 600,
                borderRadius: "9999px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "color 200ms",
                color:
                  selectedNamespace === t.id
                    ? colors.black
                    : colors.mutedForeground,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: spacing[4] }}>
        {isDetecting ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[3],
            }}
          >
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[4],
                  padding: spacing[4],
                  borderRadius: borderRadius["2xl"],
                  backgroundColor: colors.muted,
                  animation:
                    "tw-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              >
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: borderRadius.xl,
                    backgroundColor: "rgba(161,161,170,0.2)",
                  }}
                />
                <div
                  style={{
                    height: "1rem",
                    width: "6rem",
                    borderRadius: borderRadius.md,
                    backgroundColor: "rgba(161,161,170,0.2)",
                  }}
                />
              </div>
            ))}
            <p
              style={{
                textAlign: "center",
                fontSize: fontSize.sm,
                color: colors.mutedForeground,
                marginTop: spacing[4],
              }}
            >
              Detecting wallets...
            </p>
          </div>
        ) : filteredWallets.length === 0 ? (
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
            {filteredWallets.map((wallet) => {
              // Read connected state from the manager directly — no local shadow state
              const isWalletConnected =
                managerConnected && walletMetaId === wallet.meta.id;
              const isConnecting =
                connectingId === wallet.meta.id &&
                walletStatus === "connecting";

              return (
                <div
                  key={wallet.meta.id}
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
                    {wallet.meta.logo ? (
                      <img
                        src={wallet.meta.logo}
                        alt={wallet.meta.name}
                        style={{
                          width: "2rem",
                          height: "2rem",
                          objectFit: "contain",
                        }}
                      />
                    ) : wallet.detail?.info?.icon ? (
                      <img
                        src={wallet.detail.info.icon}
                        alt={wallet.meta.name}
                        style={{
                          width: "2rem",
                          height: "2rem",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "1.5rem" }}>
                        {wallet.meta.emoji || "👛"}
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
                      {wallet.meta.name}
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
                      onClick={() => void handleClick(wallet)}
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

        {/* WalletConnect — EVM only, matches deposit mode behavior */}
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
                  {/* WalletConnect logo box */}
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
    </div>
  );
}
