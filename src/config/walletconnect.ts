// // walletconnect.ts
// "use client";

// import type { SessionTypes } from "@walletconnect/types";

// export const CHAINS = {
//   SOLANA_MAINNET: "solana:5eykt4UsFv8P8NJdTREpY1vzqAQ3H1FQ",
//   SEI_MAINNET_EVM: "eip155:1329",
//   BITCOIN_MAINNET: "bip122:000000000019d6689c085ae165831e93",
// };

// const PROJECT_ID = "896c4c8fa652baf14b9614e4026aff6a";

// export class WalletConnectSDK {
//   provider: any;
//   uri: string | null = null;

//   async init() {
//     const { default: UniversalProvider } =
//       await import("@walletconnect/universal-provider");

//     this.provider = await UniversalProvider.init({
//       projectId: PROJECT_ID,
//       metadata: {
//         name: "TW SDK",
//         description: "Multi-chain SDK",
//         url: typeof window !== "undefined" ? window.location.origin : "",
//         icons: ["https://api.trustware.io/icon.png"],
//       },
//     });

//     // Save URI for QR rendering
//     this.uri = this.provider.uri;

//     return this.provider;
//   }

//   async connect() {
//     if (!this.provider) throw new Error("WalletConnect not initialized");

//     const namespaces = {
//       solana: {
//         methods: ["solana_signMessage", "solana_signTransaction"],
//         chains: [CHAINS.SOLANA_MAINNET],
//         events: [],
//       },
//       eip155: {
//         methods: ["eth_sendTransaction", "eth_sign", "personal_sign"],
//         chains: [CHAINS.SEI_MAINNET_EVM],
//         events: ["accountsChanged", "chainChanged"],
//       },
//       bip122: {
//         methods: ["btc_signMessage", "btc_sendTransaction"],
//         chains: [CHAINS.BITCOIN_MAINNET],
//         events: [],
//       },
//     };

//     const sessionPromise: SessionTypes.Struct = await this.provider.connect({
//       namespaces,
//     });

//     return this.getAccounts();
//   }

//   getAccounts() {
//     return {
//       solana: this.provider?.session?.namespaces?.solana?.accounts ?? [],
//       sei: this.provider?.session?.namespaces?.eip155?.accounts ?? [],
//       bitcoin: this.provider?.session?.namespaces?.bip122?.accounts ?? [],
//     };
//   }

//   disconnect() {
//     return this.provider?.disconnect();
//   }
// }

// walletconnect.ts
"use client";

export const CHAINS = {
  SOLANA_MAINNET: "solana:5eykt4UsFv8P8NJdTREpY1vzqAQ3H1FQ",
  SEI_MAINNET_EVM: "eip155:1329",
  BITCOIN_MAINNET: "bip122:000000000019d6689c085ae165831e93",
};

const PROJECT_ID = "896c4c8fa652baf14b9614e4026aff6a";

export class WalletConnectSDK {
  private provider: any;
  private modal: any;
  private _uri: string | undefined; // Store URI for access
  private uriResolver?: (uri: string) => void;

  async init() {
    // 🚨 Dynamic imports — browser only
    const { default: UniversalProvider } =
      await import("@walletconnect/universal-provider");
    const { WalletConnectModal } = await import("@walletconnect/modal");

    this.modal = new WalletConnectModal({
      projectId: PROJECT_ID,
      themeMode: "dark",
    });

    this.provider = await UniversalProvider.init({
      projectId: PROJECT_ID,
      metadata: {
        name: "TW SDK",
        description: "Multi-chain SDK with WalletConnect",
        url: typeof window !== "undefined" ? window.location.origin : "",
        icons: ["https://my-sdk.io/icon.png"],
      },
    });

    return this.provider;
  }

  async connect() {
    if (!this.provider) {
      throw new Error("WalletConnect not initialized");
    }

    const namespaces = {
      solana: {
        methods: ["solana_signMessage", "solana_signTransaction"],
        chains: [CHAINS.SOLANA_MAINNET],
        events: [],
      },
      eip155: {
        methods: ["eth_sendTransaction", "eth_sign", "personal_sign"],
        chains: [CHAINS.SEI_MAINNET_EVM],
        events: ["accountsChanged", "chainChanged"],
      },
      bip122: {
        methods: ["btc_signMessage", "btc_sendTransaction"],
        chains: [CHAINS.BITCOIN_MAINNET],
        events: [],
      },
    };

    this.provider.on("display_uri", (uri: string) => {
      this._uri = uri;
      this.uriResolver?.(uri);
      console.log({ uri: this.provider.uri, provider: this.provider });
    });

    const sessionPromise = this.provider.connect({ namespaces });

    // Subscribe to session ping
    this.provider.on("connect", ({ id, topic }: any) => {
      console.log("✅ WalletConnect session approved");

      const accounts = this.getAccounts();
      //  onConnected?.(accounts);
      console.log({ id, topic, accounts });
    });

    // The URI is available immediately after connect() is called
    // this._uri = this.provider.uri;

    // this.modal.openModal({
    //   uri: this.provider.uri,
    // });

    await sessionPromise;
    // this.modal.closeModal();

    return this.getAccounts();
  }

  public async getAccounts() {
    return {
      solana: this.provider?.session?.namespaces?.solana?.accounts ?? [],
      sei: this.provider?.session?.namespaces?.eip155?.accounts ?? [],
      bitcoin: this.provider?.session?.namespaces?.bip122?.accounts ?? [],
    };
  }

  public disconnect() {
    return this.provider?.disconnect();
  }

  public getUri() {
    // Return stored URI or from provider
    return this._uri || this.provider?.uri;
  }

  public waitForUri(): Promise<string> {
    return new Promise((resolve) => {
      this.uriResolver = resolve;
    });
  }
}
