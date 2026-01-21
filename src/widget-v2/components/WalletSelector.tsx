import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/utils";
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
  /** Additional CSS classes */
  className?: string;
}

/**
 * WalletSelector displays available wallets for connection.
 * Uses the SDK's wallet detection to find installed browser wallets.
 */
export function WalletSelector({
  onWalletSelect,
  className,
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
    if (walletStatus === "connecting") return;

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
    try {
      await connectWallet(wallet);
      onWalletSelect?.(wallet);
    } catch (error) {
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
        toast.error("Connection Declined", "You declined the connection request.");
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
    toast.success("Wallet Connected", "Successfully connected via WalletConnect.");
  }, []);

  // Handle WalletConnect connection error
  const handleWalletConnectError = useCallback((error: unknown) => {
    setConnectingWalletId(null);
    const message =
      error instanceof Error ? error.message : "WalletConnect connection failed";
    toast.error("Connection Failed", message);
  }, []);

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      toast.success("Wallet Disconnected", "Your wallet has been disconnected.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect wallet";
      toast.error("Disconnect Failed", message);
    }
  };

  // Loading state
  if (isDetecting) {
    return (
      <div className={cn("tw-p-4", className)}>
        <div className="tw-flex tw-flex-col tw-gap-3">
          {/* Loading skeleton */}
          {[1, 2].map((i) => (
            <div
              key={i}
              className="tw-flex tw-items-center tw-gap-4 tw-p-4 tw-rounded-2xl tw-bg-muted tw-animate-pulse"
            >
              <div className="tw-w-12 tw-h-12 tw-rounded-xl tw-bg-muted-foreground/20" />
              <div className="tw-flex-1">
                <div className="tw-h-4 tw-w-24 tw-rounded tw-bg-muted-foreground/20" />
              </div>
            </div>
          ))}
        </div>
        <p className="tw-text-center tw-text-sm tw-text-muted-foreground tw-mt-4">
          Detecting wallets...
        </p>
      </div>
    );
  }

  // No wallets detected
  if (detected.length === 0) {
    return (
      <div className={cn("tw-p-4", className)}>
        <div className="tw-text-center tw-py-8">
          <div className="tw-text-4xl tw-mb-4">👛</div>
          <h3 className="tw-text-lg tw-font-semibold tw-text-foreground tw-mb-2">
            No Wallets Found
          </h3>
          <p className="tw-text-sm tw-text-muted-foreground tw-mb-4">
            Please install a web3 wallet to continue.
          </p>
          <div className="tw-flex tw-flex-col tw-gap-2">
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-px-4 tw-py-2 tw-rounded-lg tw-bg-primary tw-text-primary-foreground tw-text-sm tw-font-medium hover:tw-opacity-90 tw-transition-opacity"
            >
              Install MetaMask
            </a>
            <a
              href="https://rainbow.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-px-4 tw-py-2 tw-rounded-lg tw-bg-secondary tw-text-secondary-foreground tw-text-sm tw-font-medium hover:tw-opacity-90 tw-transition-opacity"
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
      <div className={cn("tw-p-4", className)}>
        <div className="tw-flex tw-flex-col tw-gap-3">
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
                className={cn(
                  "tw-w-full tw-flex tw-items-center tw-gap-4 tw-p-4 tw-rounded-2xl tw-transition-all tw-duration-200",
                  "tw-bg-card tw-border tw-border-border",
                  isThisWalletConnected &&
                    "tw-ring-2 tw-ring-primary tw-border-primary"
                )}
              >
                {/* Wallet Icon */}
                <div className="tw-w-12 tw-h-12 tw-rounded-xl tw-bg-muted tw-flex tw-items-center tw-justify-center tw-overflow-hidden">
                  {wallet.meta.logo ? (
                    <img
                      src={wallet.meta.logo}
                      alt={wallet.meta.name}
                      className="tw-w-8 tw-h-8 tw-object-contain"
                    />
                  ) : wallet.detail?.info?.icon ? (
                    <img
                      src={wallet.detail.info.icon}
                      alt={wallet.meta.name}
                      className="tw-w-8 tw-h-8 tw-object-contain"
                    />
                  ) : (
                    <span className="tw-text-2xl">
                      {wallet.meta.emoji || "👛"}
                    </span>
                  )}
                </div>

                {/* Wallet Info */}
                <div className="tw-flex-1 tw-text-left">
                  <p className="tw-font-semibold tw-text-foreground">
                    {wallet.meta.name}
                  </p>
                  {isWalletConnect && !isThisWalletConnected && (
                    <p className="tw-text-xs tw-text-muted-foreground">
                      Scan QR code
                    </p>
                  )}
                  {isThisWalletConnected && walletAddress && (
                    <p className="tw-text-sm tw-text-muted-foreground">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </p>
                  )}
                </div>

                {/* Status / Actions */}
                {isConnecting ? (
                  <div className="tw-w-5 tw-h-5 tw-border-2 tw-border-muted-foreground tw-border-t-transparent tw-rounded-full tw-animate-spin" />
                ) : isThisWalletConnected ? (
                  <button
                    onClick={handleDisconnect}
                    className="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-full tw-bg-red-500/10 tw-text-red-600 hover:tw-bg-red-500/20 tw-transition-colors tw-text-xs tw-font-medium"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleWalletClick(wallet)}
                    disabled={walletStatus === "connecting"}
                    className="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-full tw-bg-primary/10 tw-text-primary hover:tw-bg-primary/20 tw-transition-colors tw-text-xs tw-font-medium disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
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
