// /**
//  * Type declarations for optional WalletConnect dependencies.
//  * These are lazy-loaded at runtime and may not be installed.
//  */

// declare module "@walletconnect/ethereum-provider" {
//   export interface EthereumProviderOptions {
//     projectId: string;
//     chains?: number[];
//     optionalChains?: number[];
//     metadata?: {
//       name: string;
//       description?: string;
//       url: string;
//       icons?: string[];
//     };
//     relayUrl?: string;
//     showQrModal?: boolean;
//   }

//   export interface EthereumProviderEvents {
//     on(event: "display_uri", listener: (uri: string) => void): void;
//     on(event: "connect", listener: () => void): void;
//     on(event: "disconnect", listener: () => void): void;
//     on(event: string, listener: (...args: unknown[]) => void): void;
//   }

//   export interface EthereumProvider extends EthereumProviderEvents {
//     connected: boolean;
//     request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
//     connect(): Promise<void>;
//     disconnect(): Promise<void>;
//   }

//   export const EthereumProvider: {
//     init(options: EthereumProviderOptions): Promise<EthereumProvider>;
//   };
// }

// declare module "qrcode" {
//   export interface QRCodeToDataURLOptions {
//     width?: number;
//     margin?: number;
//     color?: {
//       dark?: string;
//       light?: string;
//     };
//     errorCorrectionLevel?: "L" | "M" | "Q" | "H";
//   }

//   export function toDataURL(
//     text: string,
//     options?: QRCodeToDataURLOptions
//   ): Promise<string>;
// }
