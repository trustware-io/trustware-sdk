import React, { useEffect, useState, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../lib/utils";
import { walletConnectEvents } from "../../wallets/walletconnect";
import { formatWalletConnectDeepLink } from "../../wallets/deepLink";
import { useIsMobile } from "../../wallets/detect";

interface WalletConnectModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Optional callback when connection succeeds */
  onConnect?: () => void;
  /** Optional callback when connection fails */
  onError?: (error: unknown) => void;
}

/**
 * Modal component for WalletConnect QR code display.
 * Listens to walletConnectEvents for the display_uri and shows a QR code.
 */
export function WalletConnectModal({
  open,
  onClose,
  onConnect,
  onError,
}: WalletConnectModalProps): React.ReactElement {
  const [wcUri, setWcUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const isMobile = useIsMobile();
  const qrGenerationRef = useRef<AbortController | null>(null);

  // Generate QR code from URI
  const generateQrCode = useCallback(async (uri: string) => {
    // Abort any previous generation
    if (qrGenerationRef.current) {
      qrGenerationRef.current.abort();
    }
    qrGenerationRef.current = new AbortController();

    setIsGeneratingQr(true);
    setError(null);

    try {
      // Lazy load qrcode library with graceful fallback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let QRCode: any;
      try {
        QRCode = await import(/* webpackIgnore: true */ "qrcode");
      } catch {
        console.warn(
          "[Trustware SDK] qrcode library not installed. " +
            "Install it with: npm install qrcode"
        );
        setError("QR code library not installed. Use 'Copy Link' instead.");
        setIsGeneratingQr(false);
        return;
      }

      // Check if aborted
      if (qrGenerationRef.current?.signal.aborted) return;

      const dataUrl = await QRCode.toDataURL(uri, {
        width: 280,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      });

      if (qrGenerationRef.current?.signal.aborted) return;

      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("[Trustware SDK] Failed to generate QR code:", err);
      setError("Failed to generate QR code");
    } finally {
      setIsGeneratingQr(false);
    }
  }, []);

  // Listen for WalletConnect events
  useEffect(() => {
    if (!open) return;

    const handleDisplayUri = (uri: unknown) => {
      if (typeof uri === "string") {
        setWcUri(uri);
        generateQrCode(uri);
      }
    };

    const handleConnect = () => {
      onConnect?.();
      onClose();
    };

    const handleError = (err: unknown) => {
      setError(
        err instanceof Error ? err.message : "WalletConnect connection failed"
      );
      onError?.(err);
    };

    const handleDisconnect = () => {
      // Reset state on disconnect
      setWcUri(null);
      setQrDataUrl(null);
    };

    const unsubUri = walletConnectEvents.on("display_uri", handleDisplayUri);
    const unsubConnect = walletConnectEvents.on("connect", handleConnect);
    const unsubError = walletConnectEvents.on("error", handleError);
    const unsubDisconnect = walletConnectEvents.on(
      "disconnect",
      handleDisconnect
    );

    return () => {
      unsubUri();
      unsubConnect();
      unsubError();
      unsubDisconnect();
      // Abort any pending QR generation
      qrGenerationRef.current?.abort();
    };
  }, [open, onConnect, onClose, onError, generateQrCode]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setWcUri(null);
      setQrDataUrl(null);
      setError(null);
    }
  }, [open]);

  const handleOpenInWallet = useCallback(() => {
    if (!wcUri) return;
    const deepLink = formatWalletConnectDeepLink(wcUri);
    window.open(deepLink, "_blank");
  }, [wcUri]);

  const handleCopyUri = useCallback(async () => {
    if (!wcUri) return;
    try {
      await navigator.clipboard.writeText(wcUri);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = wcUri;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }, [wcUri]);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="tw-fixed tw-inset-0 tw-bg-black/50 tw-backdrop-blur-sm tw-z-50" />
        <Dialog.Content
          className={cn(
            "tw-fixed tw-left-1/2 tw-top-1/2 tw--translate-x-1/2 tw--translate-y-1/2",
            "tw-w-[90vw] tw-max-w-[360px] tw-max-h-[85vh]",
            "tw-bg-background tw-rounded-2xl tw-shadow-xl tw-z-50",
            "tw-p-6 tw-flex tw-flex-col tw-items-center",
            "tw-border tw-border-border"
          )}
        >
          <Dialog.Title className="tw-text-lg tw-font-semibold tw-text-foreground tw-mb-2">
            Connect with WalletConnect
          </Dialog.Title>

          <Dialog.Description className="tw-text-sm tw-text-muted-foreground tw-text-center tw-mb-4">
            {isMobile
              ? "Tap the button below to open your wallet app"
              : "Scan this QR code with your wallet app"}
          </Dialog.Description>

          {/* QR Code Display */}
          <div className="tw-w-[280px] tw-h-[280px] tw-bg-white tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-mb-4 tw-overflow-hidden">
            {error ? (
              <div className="tw-text-center tw-p-4">
                <div className="tw-text-red-500 tw-text-3xl tw-mb-2">!</div>
                <p className="tw-text-red-600 tw-text-sm">{error}</p>
              </div>
            ) : isGeneratingQr || !qrDataUrl ? (
              <div className="tw-flex tw-flex-col tw-items-center tw-gap-2">
                <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-primary tw-border-t-transparent tw-rounded-full tw-animate-spin" />
                <p className="tw-text-muted-foreground tw-text-sm">
                  Generating QR code...
                </p>
              </div>
            ) : (
              <img
                src={qrDataUrl}
                alt="WalletConnect QR Code"
                className="tw-w-full tw-h-full tw-object-contain"
              />
            )}
          </div>

          {/* Actions */}
          <div className="tw-flex tw-flex-col tw-gap-2 tw-w-full">
            {isMobile && wcUri && (
              <button
                onClick={handleOpenInWallet}
                className="tw-w-full tw-py-3 tw-px-4 tw-rounded-xl tw-bg-primary tw-text-primary-foreground tw-font-medium tw-text-sm hover:tw-opacity-90 tw-transition-opacity"
              >
                Open in Wallet
              </button>
            )}

            <button
              onClick={handleCopyUri}
              disabled={!wcUri}
              className="tw-w-full tw-py-3 tw-px-4 tw-rounded-xl tw-bg-secondary tw-text-secondary-foreground tw-font-medium tw-text-sm hover:tw-opacity-90 tw-transition-opacity disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
            >
              Copy Link
            </button>
          </div>

          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className="tw-absolute tw-top-4 tw-right-4 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-text-muted-foreground hover:tw-bg-muted tw-transition-colors"
              aria-label="Close"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default WalletConnectModal;
