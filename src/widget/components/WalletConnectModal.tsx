// import React, { useEffect, useState, useCallback, useRef } from "react";
// import * as Dialog from "@radix-ui/react-dialog";
// import { mergeStyles } from "../lib/utils";
// import { colors, spacing, fontSize, fontWeight, borderRadius, zIndex } from "../styles/tokens";
// import { walletConnectEvents } from "../../wallets/walletconnect";
// import { formatWalletConnectDeepLink } from "../../wallets/deepLink";
// import { useIsMobile } from "../../wallets/detect";

// interface WalletConnectModalProps {
//   /** Whether the modal is open */
//   open: boolean;
//   /** Callback when modal should close */
//   onClose: () => void;
//   /** Optional callback when connection succeeds */
//   onConnect?: () => void;
//   /** Optional callback when connection fails */
//   onError?: (error: unknown) => void;
// }

// const overlayStyle: React.CSSProperties = {
//   position: "fixed",
//   inset: 0,
//   backgroundColor: "rgba(0, 0, 0, 0.5)",
//   backdropFilter: "blur(4px)",
//   zIndex: zIndex[50],
// };

// const contentStyle: React.CSSProperties = {
//   position: "fixed",
//   left: "50%",
//   top: "50%",
//   transform: "translate(-50%, -50%)",
//   width: "90vw",
//   maxWidth: "360px",
//   maxHeight: "85vh",
//   backgroundColor: colors.background,
//   borderRadius: borderRadius["2xl"],
//   boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
//   zIndex: zIndex[50],
//   padding: spacing[6],
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
//   border: `1px solid ${colors.border}`,
// };

// const titleStyle: React.CSSProperties = {
//   fontSize: fontSize.lg,
//   fontWeight: fontWeight.semibold,
//   color: colors.foreground,
//   marginBottom: spacing[2],
// };

// const descriptionStyle: React.CSSProperties = {
//   fontSize: fontSize.sm,
//   color: colors.mutedForeground,
//   textAlign: "center",
//   marginBottom: spacing[4],
// };

// const qrContainerStyle: React.CSSProperties = {
//   width: "280px",
//   height: "280px",
//   backgroundColor: colors.white,
//   borderRadius: borderRadius.xl,
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   marginBottom: spacing[4],
//   overflow: "hidden",
// };

// const errorContainerStyle: React.CSSProperties = {
//   textAlign: "center",
//   padding: spacing[4],
// };

// const errorIconStyle: React.CSSProperties = {
//   color: colors.red[500],
//   fontSize: "1.875rem",
//   marginBottom: spacing[2],
// };

// const errorTextStyle: React.CSSProperties = {
//   color: colors.red[600],
//   fontSize: fontSize.sm,
// };

// const loadingContainerStyle: React.CSSProperties = {
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
//   gap: spacing[2],
// };

// const loadingSpinnerStyle: React.CSSProperties = {
//   width: "2rem",
//   height: "2rem",
//   border: `2px solid ${colors.primary}`,
//   borderTopColor: "transparent",
//   borderRadius: "9999px",
//   animation: "tw-spin 1s linear infinite",
// };

// const loadingTextStyle: React.CSSProperties = {
//   color: colors.mutedForeground,
//   fontSize: fontSize.sm,
// };

// const qrImageStyle: React.CSSProperties = {
//   width: "100%",
//   height: "100%",
//   objectFit: "contain",
// };

// const actionsContainerStyle: React.CSSProperties = {
//   display: "flex",
//   flexDirection: "column",
//   gap: spacing[2],
//   width: "100%",
// };

// const primaryButtonStyle: React.CSSProperties = {
//   width: "100%",
//   padding: `${spacing[3]} ${spacing[4]}`,
//   borderRadius: borderRadius.xl,
//   backgroundColor: colors.primary,
//   color: colors.primaryForeground,
//   fontWeight: fontWeight.medium,
//   fontSize: fontSize.sm,
//   transition: "opacity 0.2s",
//   border: 0,
//   cursor: "pointer",
// };

// const secondaryButtonStyle: React.CSSProperties = {
//   width: "100%",
//   padding: `${spacing[3]} ${spacing[4]}`,
//   borderRadius: borderRadius.xl,
//   backgroundColor: colors.secondary,
//   color: colors.secondaryForeground,
//   fontWeight: fontWeight.medium,
//   fontSize: fontSize.sm,
//   transition: "opacity 0.2s",
//   border: 0,
//   cursor: "pointer",
// };

// const closeButtonStyle: React.CSSProperties = {
//   position: "absolute",
//   top: spacing[4],
//   right: spacing[4],
//   width: "2rem",
//   height: "2rem",
//   borderRadius: "9999px",
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   color: colors.mutedForeground,
//   transition: "background-color 0.2s",
//   backgroundColor: "transparent",
//   border: 0,
//   cursor: "pointer",
// };

// /**
//  * Modal component for WalletConnect QR code display.
//  * Listens to walletConnectEvents for the display_uri and shows a QR code.
//  */
// export function WalletConnectModal({
//   open,
//   onClose,
//   onConnect,
//   onError,
// }: WalletConnectModalProps): React.ReactElement {
//   const [wcUri, setWcUri] = useState<string | null>(null);
//   const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [isGeneratingQr, setIsGeneratingQr] = useState(false);
//   const isMobile = useIsMobile();
//   const qrGenerationRef = useRef<AbortController | null>(null);

//   // Generate QR code from URI
//   const generateQrCode = useCallback(async (uri: string) => {
//     // Abort any previous generation
//     if (qrGenerationRef.current) {
//       qrGenerationRef.current.abort();
//     }
//     qrGenerationRef.current = new AbortController();

//     setIsGeneratingQr(true);
//     setError(null);

//     try {
//       // Lazy load qrcode library with graceful fallback
//       // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       let QRCode: any;
//       try {
//         QRCode = await import(/* webpackIgnore: true */ "qrcode");
//       } catch {
//         console.warn(
//           "[Trustware SDK] qrcode library not installed. " +
//             "Install it with: npm install qrcode"
//         );
//         setError("QR code library not installed. Use 'Copy Link' instead.");
//         setIsGeneratingQr(false);
//         return;
//       }

//       // Check if aborted
//       if (qrGenerationRef.current?.signal.aborted) return;

//       const dataUrl = await QRCode.toDataURL(uri, {
//         width: 280,
//         margin: 2,
//         color: {
//           dark: "#000000",
//           light: "#ffffff",
//         },
//         errorCorrectionLevel: "M",
//       });

//       if (qrGenerationRef.current?.signal.aborted) return;

//       setQrDataUrl(dataUrl);
//     } catch (err) {
//       console.error("[Trustware SDK] Failed to generate QR code:", err);
//       setError("Failed to generate QR code");
//     } finally {
//       setIsGeneratingQr(false);
//     }
//   }, []);

//   // Listen for WalletConnect events
//   useEffect(() => {
//     if (!open) return;

//     const handleDisplayUri = (uri: unknown) => {
//       if (typeof uri === "string") {
//         setWcUri(uri);
//         generateQrCode(uri);
//       }
//     };

//     const handleConnect = () => {
//       onConnect?.();
//       onClose();
//     };

//     const handleError = (err: unknown) => {
//       setError(
//         err instanceof Error ? err.message : "WalletConnect connection failed"
//       );
//       onError?.(err);
//     };

//     const handleDisconnect = () => {
//       // Reset state on disconnect
//       setWcUri(null);
//       setQrDataUrl(null);
//     };

//     const unsubUri = walletConnectEvents.on("display_uri", handleDisplayUri);
//     const unsubConnect = walletConnectEvents.on("connect", handleConnect);
//     const unsubError = walletConnectEvents.on("error", handleError);
//     const unsubDisconnect = walletConnectEvents.on(
//       "disconnect",
//       handleDisconnect
//     );

//     return () => {
//       unsubUri();
//       unsubConnect();
//       unsubError();
//       unsubDisconnect();
//       // Abort any pending QR generation
//       qrGenerationRef.current?.abort();
//     };
//   }, [open, onConnect, onClose, onError, generateQrCode]);

//   // Reset state when modal closes
//   useEffect(() => {
//     if (!open) {
//       setWcUri(null);
//       setQrDataUrl(null);
//       setError(null);
//     }
//   }, [open]);

//   const handleOpenInWallet = useCallback(() => {
//     if (!wcUri) return;
//     const deepLink = formatWalletConnectDeepLink(wcUri);
//     window.open(deepLink, "_blank");
//   }, [wcUri]);

//   const handleCopyUri = useCallback(async () => {
//     if (!wcUri) return;
//     try {
//       await navigator.clipboard.writeText(wcUri);
//     } catch {
//       // Fallback for older browsers
//       const textArea = document.createElement("textarea");
//       textArea.value = wcUri;
//       document.body.appendChild(textArea);
//       textArea.select();
//       document.execCommand("copy");
//       document.body.removeChild(textArea);
//     }
//   }, [wcUri]);

//   return (
//     <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
//       <Dialog.Portal>
//         <Dialog.Overlay style={overlayStyle} />
//         <Dialog.Content style={contentStyle}>
//           <Dialog.Title style={titleStyle}>
//             Connect with WalletConnect
//           </Dialog.Title>

//           <Dialog.Description style={descriptionStyle}>
//             {isMobile
//               ? "Tap the button below to open your wallet app"
//               : "Scan this QR code with your wallet app"}
//           </Dialog.Description>

//           {/* QR Code Display */}
//           <div style={qrContainerStyle}>
//             {error ? (
//               <div style={errorContainerStyle}>
//                 <div style={errorIconStyle}>!</div>
//                 <p style={errorTextStyle}>{error}</p>
//               </div>
//             ) : isGeneratingQr || !qrDataUrl ? (
//               <div style={loadingContainerStyle}>
//                 <div style={loadingSpinnerStyle} />
//                 <p style={loadingTextStyle}>Generating QR code...</p>
//               </div>
//             ) : (
//               <img
//                 src={qrDataUrl}
//                 alt="WalletConnect QR Code"
//                 style={qrImageStyle}
//               />
//             )}
//           </div>

//           {/* Actions */}
//           <div style={actionsContainerStyle}>
//             {isMobile && wcUri && (
//               <button onClick={handleOpenInWallet} style={primaryButtonStyle}>
//                 Open in Wallet
//               </button>
//             )}

//             <button
//               onClick={handleCopyUri}
//               disabled={!wcUri}
//               style={mergeStyles(
//                 secondaryButtonStyle,
//                 !wcUri && { opacity: 0.5, cursor: "not-allowed" }
//               )}
//             >
//               Copy Link
//             </button>
//           </div>

//           {/* Close button */}
//           <Dialog.Close asChild>
//             <button style={closeButtonStyle} aria-label="Close">
//               <svg
//                 width="15"
//                 height="15"
//                 viewBox="0 0 15 15"
//                 fill="none"
//                 xmlns="http://www.w3.org/2000/svg"
//               >
//                 <path
//                   d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
//                   fill="currentColor"
//                   fillRule="evenodd"
//                   clipRule="evenodd"
//                 />
//               </svg>
//             </button>
//           </Dialog.Close>
//         </Dialog.Content>
//       </Dialog.Portal>
//     </Dialog.Root>
//   );
// }

// export default WalletConnectModal;
