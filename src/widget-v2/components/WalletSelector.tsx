import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { useWalletDetection } from "../../wallets/detect";
import { useDeposit } from "../context/DepositContext";
import type { DetectedWallet } from "../../types";

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
  const { walletStatus, walletAddress, connectWallet, selectedWallet } =
    useDeposit();

  const [isDetecting, setIsDetecting] = useState(true);
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(
    null
  );

  // Detection completes after useWalletDetection populates detected array
  useEffect(() => {
    // Give detection time to complete (matches useWalletDetection timeout)
    const timer = setTimeout(() => {
      setIsDetecting(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  // Update detection state when wallets are found
  useEffect(() => {
    if (detected.length > 0) {
      setIsDetecting(false);
    }
  }, [detected]);

  // Reset connecting state when wallet status changes
  useEffect(() => {
    if (walletStatus === "connected" || walletStatus === "error") {
      setConnectingWalletId(null);
    }
  }, [walletStatus]);

  const handleWalletClick = async (wallet: DetectedWallet) => {
    if (walletStatus === "connecting") return;

    setConnectingWalletId(wallet.meta.id);
    try {
      await connectWallet(wallet);
      onWalletSelect?.(wallet);
    } catch {
      setConnectingWalletId(null);
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
    <div className={cn("tw-p-4", className)}>
      <div className="tw-flex tw-flex-col tw-gap-3">
        {detected.map((wallet) => {
          const isConnecting = connectingWalletId === wallet.meta.id;
          const isConnected =
            selectedWallet &&
            walletStatus === "connected" &&
            selectedWallet.type !== undefined;

          // Check if this wallet is the connected one
          const isThisWalletConnected =
            isConnected && connectingWalletId === null;

          return (
            <button
              key={wallet.meta.id}
              onClick={() => handleWalletClick(wallet)}
              disabled={isConnecting || walletStatus === "connecting"}
              className={cn(
                "tw-w-full tw-flex tw-items-center tw-gap-4 tw-p-4 tw-rounded-2xl tw-transition-all tw-duration-200",
                "tw-bg-card hover:tw-bg-muted/50 tw-border tw-border-border",
                "active:tw-scale-[0.98] disabled:tw-opacity-70 disabled:tw-cursor-not-allowed",
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
                {isThisWalletConnected && walletAddress && (
                  <p className="tw-text-sm tw-text-muted-foreground">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                )}
              </div>

              {/* Status */}
              {isConnecting ? (
                <div className="tw-w-5 tw-h-5 tw-border-2 tw-border-muted-foreground tw-border-t-transparent tw-rounded-full tw-animate-spin" />
              ) : isThisWalletConnected ? (
                <div className="tw-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-full tw-bg-green-500/10 tw-text-green-600">
                  <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-green-500" />
                  <span className="tw-text-xs tw-font-medium">Connected</span>
                </div>
              ) : (
                <div className="tw-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-full tw-bg-green-500/10 tw-text-green-600">
                  <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-green-500" />
                  <span className="tw-text-xs tw-font-medium">Ready</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default WalletSelector;
