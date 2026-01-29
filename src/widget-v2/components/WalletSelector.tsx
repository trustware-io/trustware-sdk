import React, { useState, useEffect, useRef, useCallback } from "react";
import { mergeStyles } from "../lib/utils";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../styles/tokens";
import { useWalletDetection } from "../../wallets/detect";
import { useDeposit } from "../context/DepositContext";
import { toast } from "./Toast";
import type { DetectedWallet } from "../../types";
import { WalletConnectModal } from "./WalletConnectModal";
import { connectWalletConnect } from "../../wallets/walletconnect";
import { walletManager } from "../../wallets/manager";

export interface WalletSelectorProps {
  /** Optional callback when a wallet is selected */
  onWalletSelect?: (wallet: DetectedWallet) => void;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const containerStyle: React.CSSProperties = {
  padding: spacing[4],
};

const walletListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[3],
};

const skeletonItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[4],
  padding: spacing[4],
  borderRadius: borderRadius["2xl"],
  backgroundColor: colors.muted,
  animation: "tw-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
};

const skeletonIconStyle: React.CSSProperties = {
  width: "3rem",
  height: "3rem",
  borderRadius: borderRadius.xl,
  backgroundColor: "rgba(161, 161, 170, 0.2)",
};

const skeletonTextStyle: React.CSSProperties = {
  height: "1rem",
  width: "6rem",
  borderRadius: borderRadius.md,
  backgroundColor: "rgba(161, 161, 170, 0.2)",
};

const detectingTextStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
  marginTop: spacing[4],
};

const emptyStateContainerStyle: React.CSSProperties = {
  textAlign: "center",
  paddingTop: spacing[8],
  paddingBottom: spacing[8],
};

const emptyStateEmojiStyle: React.CSSProperties = {
  fontSize: "2.5rem",
  marginBottom: spacing[4],
};

const emptyStateTitleStyle: React.CSSProperties = {
  fontSize: fontSize.lg,
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
  marginBottom: spacing[2],
};

const emptyStateDescStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
  marginBottom: spacing[4],
};

const emptyStateLinksStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[2],
};

const installLinkPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  padding: `${spacing[2]} ${spacing[4]}`,
  borderRadius: borderRadius.lg,
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
  textDecoration: "none",
  transition: "opacity 0.2s",
};

const installLinkSecondaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  padding: `${spacing[2]} ${spacing[4]}`,
  borderRadius: borderRadius.lg,
  backgroundColor: colors.secondary,
  color: colors.secondaryForeground,
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium,
  textDecoration: "none",
  transition: "opacity 0.2s",
};

const walletCardStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: spacing[4],
  padding: spacing[4],
  borderRadius: borderRadius["2xl"],
  transition: "all 0.2s",
  backgroundColor: colors.card,
  border: `1px solid ${colors.border}`,
};

const walletIconContainerStyle: React.CSSProperties = {
  width: "3rem",
  height: "3rem",
  borderRadius: borderRadius.xl,
  backgroundColor: colors.muted,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const walletIconImgStyle: React.CSSProperties = {
  width: "2rem",
  height: "2rem",
  objectFit: "contain",
};

const walletEmojiStyle: React.CSSProperties = {
  fontSize: "1.5rem",
};

const walletInfoStyle: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
};

const walletNameStyle: React.CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: colors.foreground,
};

const walletSubtextStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  color: colors.mutedForeground,
};

const walletAddressStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  color: colors.mutedForeground,
};

const spinnerStyle: React.CSSProperties = {
  width: "1.25rem",
  height: "1.25rem",
  border: `2px solid ${colors.mutedForeground}`,
  borderTopColor: "transparent",
  borderRadius: "9999px",
  animation: "tw-spin 1s linear infinite",
};

const disconnectButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1.5],
  padding: `${spacing[1.5]} ${spacing[3]}`,
  borderRadius: "9999px",
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  color: colors.red[600],
  transition: "background-color 0.2s",
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  border: 0,
  cursor: "pointer",
};

const connectButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1.5],
  padding: `${spacing[1.5]} ${spacing[3]}`,
  borderRadius: "9999px",
  backgroundColor: "rgba(59, 130, 246, 0.1)",
  color: colors.primary,
  transition: "background-color 0.2s",
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  border: 0,
  cursor: "pointer",
};

/**
 * WalletSelector displays available wallets for connection.
 * Uses the SDK's wallet detection to find installed browser wallets.
 */
export function WalletSelector({
  onWalletSelect,
  style,
}: WalletSelectorProps): React.ReactElement {
  const { detected } = useWalletDetection();
  const { walletStatus, walletAddress, connectWallet, disconnectWallet } =
    useDeposit();

  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(
    null
  );
  const [connectedWalletId, setConnectedWalletId] = useState<string | null>(
    null
  );
  const [detectionTimerExpired, setDetectionTimerExpired] = useState(false);
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false);

  // Track previous wallet status to detect transitions
  const prevWalletStatusRef = useRef(walletStatus);

  // Detection timer - give wallet detection time to complete
  useEffect(() => {
    const timer = setTimeout(() => {
      setDetectionTimerExpired(true);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  // Derive detection state: detecting if no wallets found AND timer hasn't expired
  const isDetecting = detected.length === 0 && !detectionTimerExpired;

  // Track wallet status transitions using ref comparison
  // This effect correctly synchronizes local state with external wallet status changes
  // The setState calls here are intentional: we're responding to wallet manager state changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const prevStatus = prevWalletStatusRef.current;
    const currentStatus = walletStatus;

    // Only handle transitions, not initial mount
    if (prevStatus !== currentStatus) {
      // Connection completed: connecting -> connected
      if (prevStatus === "connecting" && currentStatus === "connected") {
        if (connectingWalletId) {
          setConnectedWalletId(connectingWalletId);
        }
        setConnectingWalletId(null);
      }
      // Connection failed: connecting -> error
      else if (prevStatus === "connecting" && currentStatus === "error") {
        setConnectingWalletId(null);
      }
      // Wallet disconnected: connected -> idle
      else if (prevStatus === "connected" && currentStatus === "idle") {
        setConnectedWalletId(null);
      }

      prevWalletStatusRef.current = currentStatus;
    }
  }, [walletStatus, connectingWalletId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleWalletClick = async (wallet: DetectedWallet) => {
    console.log("[WalletSelector] handleWalletClick called", {
      walletId: wallet.meta.id,
      walletName: wallet.meta.name,
      walletStatus,
      hasProvider: !!wallet.provider,
    });
    if (walletStatus === "connecting") {
      console.log("[WalletSelector] Already connecting, ignoring click");
      return;
    }

    // Special handling for WalletConnect - show QR modal
    if (wallet.meta.id === "walletconnect" || wallet.via === "walletconnect") {
      setConnectingWalletId(wallet.meta.id);
      setShowWalletConnectModal(true);
      // Start the WalletConnect connection (this will emit display_uri event)
      try {
        const api = await connectWalletConnect();
        if (api) {
          walletManager.attachWallet(api);
          setConnectedWalletId(wallet.meta.id);
          onWalletSelect?.(wallet);
        }
      } catch (error) {
        setConnectingWalletId(null);
        const message =
          error instanceof Error ? error.message : "WalletConnect failed";
        toast.error("Connection Failed", message);
      }
      return;
    }

    setConnectingWalletId(wallet.meta.id);
    console.log("[WalletSelector] Starting EIP-1193 connection...");
    try {
      await connectWallet(wallet);
      console.log("[WalletSelector] connectWallet returned successfully");
      onWalletSelect?.(wallet);
    } catch (error) {
      console.error("[WalletSelector] connectWallet threw:", error);
      setConnectingWalletId(null);
      // Show error toast with user-friendly message
      const message =
        error instanceof Error ? error.message : "Failed to connect wallet";
      // Check for common wallet rejection errors
      if (
        message.toLowerCase().includes("rejected") ||
        message.toLowerCase().includes("denied") ||
        message.toLowerCase().includes("cancelled") ||
        message.toLowerCase().includes("user refused")
      ) {
        toast.error(
          "Connection Declined",
          "You declined the connection request."
        );
      } else if (message.toLowerCase().includes("already pending")) {
        toast.error(
          "Connection Pending",
          "Please check your wallet for a pending request."
        );
      } else {
        toast.error("Connection Failed", message);
      }
    }
  };

  // Handle WalletConnect modal close
  const handleWalletConnectModalClose = useCallback(() => {
    setShowWalletConnectModal(false);
    // Only clear connecting state if not connected
    if (walletStatus !== "connected") {
      setConnectingWalletId(null);
    }
  }, [walletStatus]);

  // Handle WalletConnect connection success
  const handleWalletConnectSuccess = useCallback(() => {
    setShowWalletConnectModal(false);
    setConnectingWalletId(null);
    toast.success(
      "Wallet Connected",
      "Successfully connected via WalletConnect."
    );
  }, []);

  // Handle WalletConnect connection error
  const handleWalletConnectError = useCallback((error: unknown) => {
    setConnectingWalletId(null);
    const message =
      error instanceof Error
        ? error.message
        : "WalletConnect connection failed";
    toast.error("Connection Failed", message);
  }, []);

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      toast.success(
        "Wallet Disconnected",
        "Your wallet has been disconnected."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect wallet";
      toast.error("Disconnect Failed", message);
    }
  };

  // Loading state
  if (isDetecting) {
    return (
      <div style={mergeStyles(containerStyle, style)}>
        <div style={walletListStyle}>
          {/* Loading skeleton */}
          {[1, 2].map((i) => (
            <div key={i} style={skeletonItemStyle}>
              <div style={skeletonIconStyle} />
              <div style={{ flex: 1 }}>
                <div style={skeletonTextStyle} />
              </div>
            </div>
          ))}
        </div>
        <p style={detectingTextStyle}>Detecting wallets...</p>
      </div>
    );
  }

  // No wallets detected
  if (detected.length === 0) {
    return (
      <div style={mergeStyles(containerStyle, style)}>
        <div style={emptyStateContainerStyle}>
          <div style={emptyStateEmojiStyle}>👛</div>
          <h3 style={emptyStateTitleStyle}>No Wallets Found</h3>
          <p style={emptyStateDescStyle}>
            Please install a web3 wallet to continue.
          </p>
          <div style={emptyStateLinksStyle}>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              style={installLinkPrimaryStyle}
            >
              Install MetaMask
            </a>
            <a
              href="https://rainbow.me/"
              target="_blank"
              rel="noopener noreferrer"
              style={installLinkSecondaryStyle}
            >
              Install Rainbow
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Wallet list
  return (
    <>
      <div style={mergeStyles(containerStyle, style)}>
        <div style={walletListStyle}>
          {detected.map((wallet) => {
            const isConnecting = connectingWalletId === wallet.meta.id;
            const isThisWalletConnected =
              walletStatus === "connected" &&
              connectedWalletId === wallet.meta.id;
            const isWalletConnect =
              wallet.meta.id === "walletconnect" ||
              wallet.via === "walletconnect";

            return (
              <div
                key={wallet.meta.id}
                style={mergeStyles(
                  walletCardStyle,
                  isThisWalletConnected && {
                    boxShadow: `0 0 0 2px ${colors.primary}`,
                    borderColor: colors.primary,
                  }
                )}
              >
                {/* Wallet Icon */}
                <div style={walletIconContainerStyle}>
                  {wallet.meta.logo ? (
                    <img
                      src={wallet.meta.logo}
                      alt={wallet.meta.name}
                      style={walletIconImgStyle}
                    />
                  ) : wallet.detail?.info?.icon ? (
                    <img
                      src={wallet.detail.info.icon}
                      alt={wallet.meta.name}
                      style={walletIconImgStyle}
                    />
                  ) : (
                    <span style={walletEmojiStyle}>
                      {wallet.meta.emoji || "👛"}
                    </span>
                  )}
                </div>

                {/* Wallet Info */}
                <div style={walletInfoStyle}>
                  <p style={walletNameStyle}>{wallet.meta.name}</p>
                  {isWalletConnect && !isThisWalletConnected && (
                    <p style={walletSubtextStyle}>Scan QR code</p>
                  )}
                  {isThisWalletConnected && walletAddress && (
                    <p style={walletAddressStyle}>
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </p>
                  )}
                </div>

                {/* Status / Actions */}
                {isConnecting ? (
                  <div style={spinnerStyle} />
                ) : isThisWalletConnected ? (
                  <button onClick={handleDisconnect} style={disconnectButtonStyle}>
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleWalletClick(wallet)}
                    disabled={walletStatus === "connecting"}
                    style={mergeStyles(
                      connectButtonStyle,
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
      </div>

      {/* WalletConnect QR Modal */}
      <WalletConnectModal
        open={showWalletConnectModal}
        onClose={handleWalletConnectModalClose}
        onConnect={handleWalletConnectSuccess}
        onError={handleWalletConnectError}
      />
    </>
  );
}

export default WalletSelector;
