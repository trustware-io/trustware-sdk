export type WagmiConnector = {
  /** Human label like "MetaMask", "WalletConnect" */
  name: string;
  /** Free-form type hint: "injected" | "walletConnect" | ... */
  type?: string;
};

export type WagmiBridge = {
  /** Host app believes it’s connected (Wagmi state) */
  isConnected(): boolean;
  /** List of available connectors */
  connectors(): WagmiConnector[];
  /** Try connecting via a specific connector */
  connect(connector: WagmiConnector): Promise<void>;
  /** Disconnect current session */
  disconnect(): Promise<void>;
};
