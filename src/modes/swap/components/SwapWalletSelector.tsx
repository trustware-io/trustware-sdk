import React, { useEffect, useRef, useState } from "react";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from "src/widget/styles";
import { mergeStyles } from "src/widget/lib/utils";
import { useWalletDetection } from "src/wallets";
import { toast } from "src/widget/components/Toast";
import type { DetectedWallet, WalletInterFaceAPI } from "src/types";
import type { WalletStatus } from "src/widget/state/deposit/types";

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
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
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

  const handleClick = async (wallet: DetectedWallet) => {
    if (walletStatus === "connecting") return;
    if (wallet.meta.id === "walletconnect" || wallet.via === "walletconnect") {
      toast.error("Not Available", "WalletConnect is not currently available.");
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

  const isDetecting = detected.length === 0 && !timerExpired;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
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
            marginRight: "1.75rem",
          }}
        >
          Connect Wallet
        </h1>
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
        ) : detected.length === 0 ? (
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
            {detected.map((wallet) => {
              const isConnecting = connectingId === wallet.meta.id;
              const isConnected =
                walletStatus === "connected" &&
                connectingId === null &&
                walletAddress !== null;

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
                    isConnected && {
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

                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontWeight: fontWeight.semibold,
                        color: colors.foreground,
                      }}
                    >
                      {wallet.meta.name}
                    </p>
                    {isConnected && walletAddress && (
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
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => handleClick(wallet)}
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
      </div>
    </div>
  );
}
