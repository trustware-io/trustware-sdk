# Trustware SDK

The Trustware SDK provides a React provider, prebuilt UI widget, and typed core API for bridging and top-up routes. It powers seamless fund transfers across chains, reusing resolved configurations for quoting, route selection, and transaction execution. Whether you embed the widget for a quick integration or use the imperative core for custom UIs, the SDK handles wallet detection, approvals, submission, and asset settlement under the hood.

This guide covers installation, configuration, integration patterns (widget-based and headless), and advanced usage.

## Installation

```bash
npm install @trustware/sdk
# or
pnpm add @trustware/sdk
```

The package exposes ESM modules and ships full TypeScript types.

## Core Concepts

- **`TrustwareProvider`** – Wraps your app to provide configuration (API key, routes, theme) via React context, making it available to the widget and core API.
- **`TrustwareWidget`** – A prebuilt React component that renders a UI for quoting, wallet selection, top-up submission, and asset settlement.
- **`Trustware core`** – An imperative singleton with helpers like `Trustware.runTopUp`, `Trustware.buildRoute`, and wallet utilities. Import once the provider is mounted.
- **Config** – `TrustwareConfigOptions` defines your API key, default routes (e.g., toChain, toToken), slippage, theme, messages, and wallet detection behavior.

## Configuration

Create a config object at the root of your app. It merges defaults for routes, slippage, and fallbacks (e.g., `toAddress` defaults to `fromAddress` if unset). By default the widget will route funds to original address that initiated the transaction, if that address can support the new funds.

```ts
const trustwareConfig = {
  apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY!,
  routes: {
    toChain: "8453", // Base chain ID
    toToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native ETH on Base
    defaultSlippage: 1,
    // Optional defaults:
    // fromAddress: "0x...", // User's wallet address
    // toAddress: "0x...", // Destination; can be set later via Trustware.setDestinationAddress
    options: {
      // fixedFromAmount: "0.05",
      // minAmountOut: "0",
      // maxAmountOut: "0.5",
    },
  },
  autoDetectProvider: true, // Enable EIP-6963/EIP-1193 wallet discovery
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

Retrieve the resolved config anytime via `Trustware.getConfig()` (after provider mount).

```ts
const cfg = Trustware.getConfig();
console.log(cfg.routes.toChain); // "8453"
```

## Integration Modes

### 1. Widget with Trustware-managed Wallet Detection

Ideal for apps without existing wallet connections. The SDK auto-discovers wallets (if `autoDetectProvider: true`) and prompts during the flow.

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

- No external wallet libs (e.g., Wagmi) needed.
- Call `Trustware.setDestinationAddress(address)` dynamically if the `toAddress` is determined at runtime (e.g., after smart wallet generation).

### 2. Widget or Headless with Host-managed Wallet

Reuse your app's wallet (e.g., via Wagmi/RainbowKit). Adapt clients to the `WalletInterfaceAPI` and inject via prop or `Trustware.useWallet`.

```tsx
import { useEffect, useMemo } from "react";
import { useWalletClient } from "wagmi";
import { TrustwareProvider, TrustwareWidget, Trustware } from "@trustware/sdk";
import { useWagmi } from "@trustware/sdk/wallet"; // Adapter helper

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
      autoDetect={false} // Skip detection; use injected wallet
    >
      <TrustwareWidget /> {/* Or omit for headless */}
    </TrustwareProvider>
  );
}
```

- Adapters: `useWagmi(client)` for Viem/Wagmi, `useEIP1193(provider)` for raw EIP-1193.
- Attach imperatively post-mount: `Trustware.useWallet(wallet)`.
- Bridge example for Wagmi:

```ts
import { useEffect } from "react";
import { useWalletClient } from "wagmi";
import { useWagmi } from "@trustware/sdk/wallet";
import { Trustware } from "@trustware/sdk";

export function useTrustwareWalletBridge() {
  const { data } = useWalletClient();

  useEffect(() => {
    if (!data) return;
    const wallet = useWagmi(data);
    Trustware.useWallet(wallet);
  }, [data]);
}
```

## Using the Widget

The `<TrustwareWidget />` handles the full flow: quoting, wallet prompts, approvals, submission, and final asset settlement. It mirrors the core's lifecycle and uses the provider's config/wallet, without disrupting user flows in your application.

- Customize via `theme` and `messages` in config.
- For dynamic `toAddress`: Call `Trustware.setDestinationAddress` before render.

## Imperative API (Headless / Without Widget)

Import the core after mounting `TrustwareProvider`:

```ts
import { Trustware } from "@trustware/sdk";
```

Build custom UIs with these helpers, reusing the provider's config and wallet.

### Wallet Detection and Management

- `Trustware.autoDetect()` – Starts provider discovery (if enabled); returns unsubscribe.
- `Trustware.useWallet(wallet)` – Inject a connected wallet.
- `Trustware.getWallet()` / `Trustware.getAddress()` – Get active wallet/address.

### Building and Quoting Routes

Create routes and fetch quotes before user interaction.

```ts
const cfg = Trustware.getConfig();
const fromAddress = await Trustware.getAddress();

const route = await Trustware.buildRoute({
  amount: "0.1", // In fromToken currency (e.g., ETH)
  fromAddress,
  toAddress: cfg.routes.toAddress ?? fromAddress, // Fallbacks applied
});

const quote = await Trustware.getQuote(route);
console.log(quote.expectedAmountOut);
```

- `amount`: Denominated in `fromToken` (defaults to native).
- Fallbacks: `fromAddress` → connected wallet; `toAddress` → config → `fromAddress`.

### Running a Top-up

Orchestrates quoting, approvals, and submission. Wrap with your UI (e.g., loading states).

```ts
try {
  const result = await Trustware.runTopUp({
    amount: "0.25",
    fromAddress: await Trustware.getAddress(),
    toAddress: "0xDestination...", // Optional; uses config fallbacks
  });

  console.log("Top-up confirmed", result.txHash);
} catch (err) {
  console.error("Top-up failed", err);
}
```

Returns: `{ txHash, receipt?, approvals? }`.

### Lifecycle Events

Listen for updates mirroring the widget:

```ts
const unsub = Trustware.on("status", (status) => {
  console.log("Status:", status); // e.g., "idle", "quoting", "submitting"
});

// Later:
unsub();
```

Events:
- `status`: High-level updates.
- `quote`: Latest quote.
- `error`: Thrown errors (e.g., approval/bridge failures).

## Additional Utilities

- `Trustware.setDestinationAddress(address)`: Updates runtime `toAddress`.
- `Trustware.getConfig()`: Resolved config.
- Hooks: `useTrustware()`, `useTrustwareRoute()` for advanced React flows.
- Explore `src/core` for types on balances, tokens, chain metadata.

## Error Handling Tips

- Surface actionable errors from `runTopUp` or `error` events (e.g., network/approval issues).
- Add retry logic for transients.
- Guard calls: Ensure provider mounted and wallet connected.

## Rate Limiting

The SDK automatically handles API rate limits with retry logic. The backend enforces per-API-key limits and returns standard rate limit headers.

### Default Behavior

Rate limiting is **enabled by default**. When a 429 (Too Many Requests) response is received:
1. The SDK waits for the time specified in the `Retry-After` header
2. Automatically retries the request (up to 3 times by default)
3. Uses exponential backoff if `Retry-After` is not provided

### Configuration

Customize rate limit handling in your config:

```ts
const config = {
  apiKey: "...",
  routes: { toChain: "8453", toToken: "0x..." },
  retry: {
    autoRetry: true,         // Enable/disable auto-retry on 429 (default: true)
                             // Note: This does NOT disable backend rate limits,
                             // only client-side retry behavior
    maxRetries: 3,           // Max retry attempts (default: 3)
    baseDelayMs: 1000,       // Base delay for exponential backoff (default: 1000)
    approachingThreshold: 5, // Trigger warning when remaining < threshold (default: 5)

    // Callbacks for monitoring
    onRateLimitInfo: (info) => {
      console.log(`${info.remaining}/${info.limit} requests remaining`);
    },
    onRateLimited: (info, retryCount) => {
      console.warn(`Rate limited! Retry ${retryCount}, waiting ${info.retryAfter}s`);
    },
    onRateLimitApproaching: (info, threshold) => {
      console.warn(`Approaching limit: ${info.remaining} remaining`);
    },
  },
};
```

### Rate Limit Info

The `RateLimitInfo` object contains:

| Field | Type | Description |
|-------|------|-------------|
| `limit` | number | Maximum requests allowed in the window |
| `remaining` | number | Requests remaining in current window |
| `reset` | number | Unix timestamp when window resets |
| `retryAfter` | number? | Seconds to wait (only on 429) |

### Handling RateLimitError

If retries are exhausted, a `RateLimitError` is thrown:

```ts
import { Trustware, RateLimitError } from "@trustware/sdk";

try {
  await Trustware.buildRoute({ ... });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.error(`Rate limited: ${err.message}`);
    console.log(`Try again in ${err.rateLimitInfo.retryAfter}s`);
  }
}
```

### Disabling Auto-Retry

To handle rate limits manually (disable client-side retry):

```ts
const config = {
  // ...
  retry: {
    autoRetry: false, // Disable auto-retry; 429s will throw immediately
                      // Note: Backend rate limits still apply
  },
};
```

## Troubleshooting

- Mount `TrustwareProvider` once at app root.
- For host wallets: Inject only after connection.
- SSR/Next.js: Use `"use client";` for SDK-touching components.
- No wallet? Enable `autoDetectProvider` or inject manually.

## Further Reading

- TypeScript defs in `src/core` for full API.
- Source: Explore `sdk/src` for implementation details.
- [Core Guide](docs/coreGuide.md)
- [Integrations](docs/integrationGuide.md)
