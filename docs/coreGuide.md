# Trustware Core Guide

Use the core API when you want Trustware routing and wallet plumbing without the prebuilt widget UI.

The core shares the same provider config and wallet state as the widget.

## Setup

```tsx
import { TrustwareProvider, type TrustwareConfigOptions } from "@trustware/sdk";
```

```ts
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
} satisfies TrustwareConfigOptions;
```

Mount the provider once:

```tsx
<TrustwareProvider config={trustwareConfig}>{children}</TrustwareProvider>
```

Then use the core:

```ts
import { Trustware } from "@trustware/sdk";
```

## Core Usage Modes

### 1. Reuse Host Wallet State

```ts
import { useEffect } from "react";
import { useWalletClient } from "wagmi";
import { useWagmi } from "@trustware/sdk/wallet";
import { Trustware } from "@trustware/sdk";

export function useTrustwareWalletBridge() {
  const { data } = useWalletClient();

  useEffect(() => {
    if (!data) return;
    Trustware.useWallet(useWagmi(data));
  }, [data]);
}
```

### 2. Let Trustware Detect Wallets

```ts
await Trustware.autoDetect();
```

### 3. Set Runtime Destination Address

```ts
Trustware.setDestinationAddress("0xDestination...");
```

## Read The Resolved Config

```ts
const cfg = Trustware.getConfig();
console.log(cfg.routes.toChain);
```

Current config fields that matter most for headless integrations:

- `routes.toChain`
- `routes.toToken`
- `routes.fromToken`
- `routes.fromAddress`
- `routes.toAddress`
- `routes.defaultSlippage`
- `routes.routeType`
- `routes.options.routeRefreshMs`
- `routes.options.fixedFromAmount`
- `routes.options.minAmountOut`
- `routes.options.maxAmountOut`

## Build A Route

```ts
const route = await Trustware.buildRoute({
  amount: "0.1",
  fromAddress: await Trustware.getAddress(),
});
```

Use `buildRoute` when:

- you want to inspect route details before submission
- you are building your own amount/token UI
- you need a quote-first flow

## Get A Quote

```ts
const quote = await Trustware.getQuote(route);
console.log(quote.expectedAmountOut);
```

## Run The Full Headless Flow

```ts
const result = await Trustware.runTopUp({
  amount: "0.1",
  fromAddress: await Trustware.getAddress(),
});

console.log(result.txHash);
```

Use `runTopUp` when:

- you want the SDK to handle the route + approval + submit path for you
- you are building a custom UI but not custom transaction orchestration

## Events

```ts
const unsubscribe = Trustware.on("status", (status) => {
  console.log("status", status);
});

unsubscribe();
```

Common events:

- `status`
- `quote`
- `error`

## Error Handling

```ts
import { RateLimitError, Trustware } from "@trustware/sdk";

try {
  await Trustware.buildRoute({
    amount: "0.1",
    fromAddress: await Trustware.getAddress(),
  });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error("Rate limited", error.rateLimitInfo);
  }
}
```

## When To Use The Widget Instead

Use the widget if you want:

- built-in wallet selection
- built-in amount/token/confirmation UI
- built-in processing and success/error steps

See [intergrationGuide.md](./intergrationGuide.md) for the widget-based paths.
