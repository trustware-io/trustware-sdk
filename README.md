<div align="center">

<pre>
    ████████╗██████╗ ██╗   ██╗███████╗████████╗██╗    ██╗  █████╗ ██████╗ ███████╗
    ╚══██╔══╝██╔══██╗██║   ██║██╔════╝╚══██╔══╝██║    ██║ ██╔══██╗██╔══██╗██╔════╝
       ██║   ██████╔╝██║   ██║███████╗   ██║   ██║ █╗ ██║ ███████║██████╔╝█████╗
       ██║   ██╔══██╗██║   ██║╚════██║   ██║   ██║███╗██║ ██╔══██║██╔══██╗██╔══╝
       ██║   ██║  ██║╚██████╔╝███████║   ██║   ╚███╔███╔╝ ██║  ██║██║  ██║███████╗
       ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝    ╚══╝╚══╝  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
                         ▓▓▓▓▓▓▓▓  S · D · K  ▓▓▓▓▓▓▓▓

           ◆ ─── Ξ ─── ◇ ─── ⬢ ─── ₿ ─── ⬡ ─── ✦ ─── ◈ ─── ◊
             c r o s s   ·   c h a i n   ·   l i q u i d i t y
</pre>

# Trustware SDK

**Any chain. Any token. Any wallet. One drop-in widget for everyone.**

[![npm version](https://img.shields.io/npm/v/@trustware/sdk?style=flat-square&color=0ea5e9&label=npm)](https://www.npmjs.com/package/@trustware/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@trustware/sdk?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@trustware/sdk)
[![license](https://img.shields.io/npm/l/@trustware/sdk?style=flat-square&color=64748b)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/trustware-io/trustware-sdk/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/trustware-io/trustware-sdk/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-18.2+%20%7C%2019-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[📚 Docs](https://docs.trustware.io) · [🌐 Website](https://trustware.io) · [📦 npm](https://www.npmjs.com/package/@trustware/sdk) · [💬 Issues](https://github.com/trustware-io/trustware-sdk/issues)

</div>

---

> 📚 **Full documentation is now at [docs.trustware.io](https://docs.trustware.io).** This README covers installation and a quick start — see the docs site for the complete API reference, integration guides, and examples.

Trustware SDK gives you three integration styles on top of the same routing and wallet infrastructure:

- a prebuilt React widget for the full deposit flow
- a provider + host wallet bridge for apps that already manage wallet state
- a headless core API for custom UIs

The current widget flow is:

`Home -> Select Token -> Confirm Deposit -> Processing -> Success/Error`

The refactored widget keeps the same behavior, but the configuration surface is now documented around the actual `TrustwareConfigOptions` shape and the current widget step model.

## Installation

Supports React `18.2+` and `19`.

```bash
npm install @trustware/sdk
# or
pnpm add @trustware/sdk
```

## Main Exports

- `TrustwareProvider`
- `TrustwareWidget`
- `Trustware`
- `useTrustware`

## Quick Start

```tsx
import {
  TrustwareProvider,
  TrustwareWidget,
  type TrustwareConfigOptions,
} from "@trustware/sdk";

const trustwareConfig = {
  apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY!,
  routes: {
    toChain: "8453",
    toToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    defaultSlippage: 1,
    options: {
      routeRefreshMs: 15000,
    },
  },
  autoDetectProvider: true,
  messages: {
    title: "Deposit",
    description: "Move funds into the destination asset and chain.",
  },
} satisfies TrustwareConfigOptions;

export function App() {
  return (
    <TrustwareProvider config={trustwareConfig}>
      <TrustwareWidget />
    </TrustwareProvider>
  );
}
```

## Config Reference

`TrustwareConfigOptions` is the single source of truth. The current supported shape is:

```ts
type TrustwareConfigOptions = {
  apiKey: string;
  routes: {
    toChain: string;
    toToken: string;
    fromToken?: string;
    fromAddress?: string;
    toAddress?: string;
    defaultSlippage?: number;
    routeType?: string;
    options?: {
      routeRefreshMs?: number;
      fixedFromAmount?: string | number;
      minAmountOut?: string | number;
      maxAmountOut?: string | number;
    };
  };
  autoDetectProvider?: boolean;
  theme?: TrustwareWidgetTheme;
  messages?: Partial<TrustwareWidgetMessages>;
  retry?: RetryConfig;
  walletConnect?: WalletConnectConfig;
  onError?: (error: TrustwareError) => void;
  onSuccess?: (transaction: Transaction) => void;
  onEvent?: (event: TrustwareEvent) => void;
};
```

### Route Fields

- `routes.toChain`: destination chain key or chain id string.
- `routes.toToken`: destination token address or registry token identifier.
- `routes.fromToken`: optional source token preference.
- `routes.fromAddress`: optional source wallet override.
- `routes.toAddress`: optional destination address override.
- `routes.defaultSlippage`: optional slippage percentage. Defaults to `1`.
- `routes.routeType`: optional route flavor. Defaults to `"swap"`.

### Route Options

- `routes.options.routeRefreshMs`: auto-refresh cadence for route previews.
- `routes.options.fixedFromAmount`: locks the widget amount input to a fixed USD amount.
- `routes.options.minAmountOut`: minimum allowed USD amount.
- `routes.options.maxAmountOut`: maximum allowed USD amount.

### Other Config Groups

- `autoDetectProvider`: enables Trustware-managed wallet discovery.
- `theme`: widget color and radius customization.
- `messages`: top-level copy overrides.
- `retry`: API retry and rate-limit behavior.
- `walletConnect`: WalletConnect overrides.
- `onError`, `onSuccess`, `onEvent`: lifecycle callbacks.

## Widget Usage Patterns

### 1. Drop-In Widget With Trustware-Managed Wallet Detection

Use this when your app does not already manage a connected wallet.

```tsx
import { TrustwareProvider, TrustwareWidget } from "@trustware/sdk";

export function DepositPanel() {
  return (
    <TrustwareProvider config={trustwareConfig}>
      <TrustwareWidget />
    </TrustwareProvider>
  );
}
```

Use this mode when:

- you want the built-in wallet selection flow
- you want the full hosted deposit UX
- `autoDetectProvider` should stay enabled

### 2. Widget With a Host-Managed Wallet

Use this when your app already controls wallet connection through Wagmi, Viem, or another adapter.

```tsx
import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { TrustwareProvider, TrustwareWidget } from "@trustware/sdk";
import { useWagmi } from "@trustware/sdk/wallet";

export function DepositPanel() {
  const { data: walletClient } = useWalletClient();
  const wallet = useMemo(
    () => (walletClient ? useWagmi(walletClient) : undefined),
    [walletClient]
  );

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

Use this mode when:

- your app already owns wallet state
- you do not want the SDK to pick another provider
- you want the widget UX but not the widget’s wallet discovery responsibilities

### 3. Controlled Widget Shell

`TrustwareWidget` also supports basic shell control through props and a ref.

```tsx
import { useRef } from "react";
import {
  TrustwareProvider,
  TrustwareWidget,
  type TrustwareWidgetRef,
} from "@trustware/sdk";

export function ControlledWidget() {
  const widgetRef = useRef<TrustwareWidgetRef>(null);

  return (
    <TrustwareProvider config={trustwareConfig}>
      <button onClick={() => widgetRef.current?.open()}>Open</button>
      <TrustwareWidget
        ref={widgetRef}
        defaultOpen={false}
        initialStep="home"
        showThemeToggle={false}
        onOpen={() => console.log("opened")}
        onClose={() => console.log("closed")}
      />
    </TrustwareProvider>
  );
}
```

Current widget props:

- `theme?: "light" | "dark" | "system"`
- `initialStep?: "home" | "select-token" | "crypto-pay" | "processing" | "success" | "error"`
- `defaultOpen?: boolean`
- `onOpen?: () => void`
- `onClose?: () => void`
- `showThemeToggle?: boolean`

### 4. Headless Core API

Use this when you want Trustware’s routing and wallet plumbing without the widget UI.

```ts
import { Trustware } from "@trustware/sdk";

const route = await Trustware.buildRoute({
  amount: "0.1",
  fromAddress: await Trustware.getAddress(),
});

const quote = await Trustware.getQuote(route);

const result = await Trustware.runTopUp({
  amount: "0.1",
  fromAddress: await Trustware.getAddress(),
});
```

## Common Config Examples

### Fixed Amount Deposit

```ts
const fixedAmountConfig = {
  ...trustwareConfig,
  routes: {
    ...trustwareConfig.routes,
    options: {
      fixedFromAmount: "25",
    },
  },
} satisfies TrustwareConfigOptions;
```

### Min / Max Guardrails

```ts
const guardedConfig = {
  ...trustwareConfig,
  routes: {
    ...trustwareConfig.routes,
    options: {
      minAmountOut: "10",
      maxAmountOut: "250",
      routeRefreshMs: 10000,
    },
  },
} satisfies TrustwareConfigOptions;
```

### Runtime Destination Address

```ts
import { Trustware } from "@trustware/sdk";

Trustware.setDestinationAddress("0xDestination...");
```

## Headless / Core Notes

- `Trustware.getConfig()` returns the resolved config.
- `Trustware.getWallet()` and `Trustware.getAddress()` expose the active wallet.
- `Trustware.useWallet(wallet)` attaches a wallet imperatively.
- `Trustware.autoDetect()` can still be used if you want SDK-managed discovery outside the widget.

## Rate Limiting

Client retry behavior is configured through `retry`.

```ts
const config = {
  ...trustwareConfig,
  retry: {
    autoRetry: true,
    maxRetries: 3,
    baseDelayMs: 1000,
    approachingThreshold: 5,
  },
} satisfies TrustwareConfigOptions;
```

If retries are exhausted, the SDK throws `RateLimitError`.

## Docs

- [Integration Guide](docs/intergrationGuide.md)
- [Core Guide](docs/coreGuide.md)
- [Backend RPC Offload PDR](docs/backend-rpc-offload-pdr.md)
- [Widget Architecture Boundaries](docs/widget-architecture-boundaries.md)
- [Widget Refactor Baseline](docs/widget-refactor-baseline.md)
