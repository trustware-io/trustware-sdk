# Trustware SDK Integration Guide

The Trustware SDK ships a React provider, UI widget, and a typed core API for
bridging/top-up routes. This guide outlines the two supported integration
patterns and the key primitives exposed by the SDK.

## Installation

```bash
npm install @trustware/sdk
# or
pnpm add @trustware/sdk
```

The package exposes ESM modules and ships TypeScript types.

## Core Concepts

- **`TrustwareProvider`** – wraps your app to make the Trustware core and widget
  configuration available through React context.
- **`TrustwareWidget`** – renders the prebuilt widget that walks a user through
  quoting and submitting a top-up route.
- **`Trustware` core** – an imperative facade with helpers such as
  `Trustware.runTopUp`, `Trustware.buildRoute`, and wallet management utilities.
- **Config** – `TrustwareConfigOptions` defines the API key, default route
  targets, optional theme/messages, and wallet-detection behavior.

Every integration starts by creating a config object:

```ts
const trustwareConfig = {
  apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY!,
  routes: {
    toChain: "8453", // Base chain id
    toToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native ETH on Base
    defaultSlippage: 1,
    // Optional defaults:
    // fromAddress: "0x...",
    // toAddress: "0x...", // can be overridden later via Trustware.setDestinationAddress
    options: {
      // fixedFromAmount: "0.05",
      // minAmountOut: "0",
      // maxAmountOut: "0.5",
    },
  },
  autoDetectProvider: true,
  theme: {
    primaryColor: "#FCB514",
    secondaryColor: "#FFFFFF",
    backgroundColor: "#000000",
    borderColor: "#FCB514",
    textColor: "#FFFFFF",
    radius: 16,
  },
  messages: {
    title: "Top up BasePass",
    description: "Bridge and add funds directly to your BasePass wallet.",
  },
} satisfies TrustwareConfigOptions;
```

## Integration Modes

### 1. Headless / Trustware-managed Wallet Detection

Use this mode when your app does **not** manage the connected wallet itself.
Trustware will attempt to discover EIP-6963/EIP-1193 providers in the browser
and attach to whichever wallet the user selects during the widget flow.

```tsx
import { TrustwareProvider, TrustwareWidget } from "@trustware/sdk";

export function App() {
  return (
    <TrustwareProvider config={trustwareConfig}>
      <TrustwareWidget />
    </TrustwareProvider>
  );
}
```

Key points:

- `autoDetectProvider: true` allows the SDK to silently look for installed
  wallets so the widget can offer them without wiring additional UI.
- No Wagmi/RainbowKit integration is required. The SDK connects to the selected
  wallet only when the user starts a top-up.
- If your destination address is determined later (for example after the user
  generates a smart wallet address), call
  `Trustware.setDestinationAddress(address)` before rendering the widget.

### 2. Host-managed Wallet Injection

Use this mode when your dapp already controls a wallet connection (e.g., via
Wagmi, RainbowKit, or a custom wallet abstraction) and you want Trustware to
reuse that connection. You can adapt existing clients into the required
`WalletInterFaceAPI` and pass it to the provider.

```tsx
import { useEffect, useMemo } from "react";
import { useWalletClient } from "wagmi"; // Wagmi hook
import { TrustwareProvider, TrustwareWidget, Trustware } from "@trustware/sdk";
import { useWagmi } from "@trustware/sdk/wallet"; // adapter helper re-export

export function App() {
  const { data: wagmiClient } = useWalletClient();
  const wallet = useMemo(
    () => (wagmiClient ? useWagmi(wagmiClient) : undefined),
    [wagmiClient],
  );

  useEffect(() => {
    if (!wallet) return;
    Trustware.setDestinationAddress("0xDestination...");
  }, [wallet]);

  return (
    <TrustwareProvider
      config={trustwareConfig}
      wallet={wallet}
      autoDetect={false}
    >
      <TrustwareWidget />
    </TrustwareProvider>
  );
}
```

Key points:

- Pass `wallet={wallet}` to `TrustwareProvider` to skip detection and reuse your
  existing signer.
- Set `autoDetect={false}` if you do not want Trustware to search for other
  wallets.
- Adapter utilities:
  - `useWagmi(client)` converts a Wagmi/Viem wallet client.
  - `useEIP1193(window.ethereum)` wraps a raw EIP-1193 provider.
- You can also attach later via `Trustware.useWallet(wallet)` if you need to
  wait until after the provider mounts.

## Using the Widget vs. Imperative API

- **Widget** (`<TrustwareWidget />`) handles quoting, wallet prompting, and
  transaction submission automatically.
- **Imperative** (`Trustware.runTopUp`) lets you run the same flow without the
  widget UI. Pass an explicit `toAddress` or rely on the config fallbacks:

```ts
await Trustware.runTopUp({
  fromAddress: "0xUser...",
  toAddress: "0xDestination...", // optional; falls back to routes.toAddress then fromAddress
  amount: "0.1",
});
```

Both approaches share the resolved configuration and wallet context provided by
`TrustwareProvider`.

## Additional Utilities

- `Trustware.getConfig()` returns the resolved config (including defaults).
- `Trustware.getWallet()` / `Trustware.getAddress()` expose the active wallet
  connection.
- `Trustware.setDestinationAddress()` updates `routes.toAddress` at runtime.
- Hooks such as `useTrustware()` and `useTrustwareRoute()` are available for
  advanced flows within the SDK.

## Troubleshooting

- Ensure the provider is mounted once at the root of your app.
- When using host-managed wallets, only call `Trustware.useWallet` or pass the
  `wallet` prop after the wallet is actually connected.
- For SSR/Next.js apps, mark components that touch the SDK as client components
  (`"use client";`).

For deeper API details explore the `sdk/src` directory or your editor’s type
hints; the SDK is fully typed.
