# Trustware SDK Integration Guide

This guide focuses on the current widget flow, the current config surface, and the supported integration patterns.

## Current Widget Flow

The prebuilt widget currently walks users through:

`Home -> Select Token -> Confirm Deposit -> Processing -> Success/Error`

That flow is driven by `TrustwareProvider` config plus either Trustware-managed wallet detection or a wallet injected by the host app.

## Required Setup

```bash
npm install @trustware/sdk
```

```tsx
import {
  TrustwareProvider,
  TrustwareWidget,
  type TrustwareConfigOptions,
} from "@trustware/sdk";
```

## Config Shape

Use `TrustwareConfigOptions` and avoid stale keys from older examples. The current route-related keys are:

```ts
const trustwareConfig = {
  apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY!,
  routes: {
    toChain: "8453",
    toToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    fromToken: undefined,
    fromAddress: undefined,
    toAddress: undefined,
    defaultSlippage: 1,
    routeType: "swap",
    options: {
      routeRefreshMs: 15000,
      fixedFromAmount: undefined,
      minAmountOut: undefined,
      maxAmountOut: undefined,
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
    title: "Deposit",
    description: "Move funds into the destination asset and chain.",
  },
} satisfies TrustwareConfigOptions;
```

### Config Notes

- `routes.toChain` and `routes.toToken` are the core required route targets.
- `routes.options.fixedFromAmount` locks the amount entry UI to a fixed USD amount.
- `routes.options.minAmountOut` and `routes.options.maxAmountOut` constrain the amount UI.
- `routes.options.routeRefreshMs` controls route preview refresh cadence.
- `walletConnect` and `retry` remain optional config groups.

## Integration Pattern 1: Drop-In Widget

Use this when you want the full built-in UX and do not already manage wallet connection yourself.

```tsx
export function DepositPanel() {
  return (
    <TrustwareProvider config={trustwareConfig}>
      <TrustwareWidget />
    </TrustwareProvider>
  );
}
```

Best for:

- embedded deposit experiences
- apps without existing wallet connection state
- the shortest path to production

## Integration Pattern 2: Widget With Host Wallet

Use this when your app already owns wallet connection state.

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

Best for:

- Wagmi / RainbowKit apps
- apps with custom wallet orchestration already in place
- integrations that want the widget flow but not SDK-managed wallet discovery

## Integration Pattern 3: Controlled Widget

Use the widget ref and shell props when the host app needs to open or close the deposit flow itself.

```tsx
import { useRef } from "react";
import {
  TrustwareProvider,
  TrustwareWidget,
  type TrustwareWidgetRef,
} from "@trustware/sdk";

export function ControlledDepositPanel() {
  const widgetRef = useRef<TrustwareWidgetRef>(null);

  return (
    <TrustwareProvider config={trustwareConfig}>
      <button onClick={() => widgetRef.current?.open()}>Open deposit</button>
      <TrustwareWidget
        ref={widgetRef}
        defaultOpen={false}
        initialStep="home"
        showThemeToggle={false}
      />
    </TrustwareProvider>
  );
}
```

Useful props:

- `initialStep`
- `defaultOpen`
- `onOpen`
- `onClose`
- `showThemeToggle`
- `theme`

## Common Route Config Patterns

### Fixed-Amount Deposit

```ts
const config = {
  ...trustwareConfig,
  routes: {
    ...trustwareConfig.routes,
    options: {
      fixedFromAmount: "25",
    },
  },
} satisfies TrustwareConfigOptions;
```

### Amount Guardrails

```ts
const config = {
  ...trustwareConfig,
  routes: {
    ...trustwareConfig.routes,
    options: {
      minAmountOut: "10",
      maxAmountOut: "250",
    },
  },
} satisfies TrustwareConfigOptions;
```

### Runtime Destination Address

```ts
import { Trustware } from "@trustware/sdk";

Trustware.setDestinationAddress("0xDestination...");
```

## When To Use The Core Instead

If you do not want the widget UI at all, use the headless core API described in [coreGuide.md](./coreGuide.md). That path still shares the same provider config, wallet bridge, and route defaults.
