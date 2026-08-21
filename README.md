<div align="center">

<pre>
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ▓▒░  T R U S T W A R E  ░▒▓   ◢ SDK ◣  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
      ◆ ── Ξ ── ◇ ── ⬢ ── ₿ ── ⬡ ── ✦
        cross · chain · liquidity
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

## Installation

```bash
npm install @trustware/sdk
# or
pnpm add @trustware/sdk
```

Supports React `18.2+` and `19`.

## Main Exports

- `TrustwareProvider`
- `useTrustware`
- `TrustwareWidget`
- `Trustware`
- `TrustwareError`
- `RateLimitError`
- `assertValidPostHook`
- `walletManager`
- `useWalletDetection`
- `useWalletInfo`
- `connectDetectedWallet`
- `WagmiBridge`
- `useWagmi`
- `useEIP1193`
- `WALLETS`
- `./identity`, `./validation/address`, `./types`, `./constants`

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

`TrustwareConfigOptions` is the single source of truth. The shape is a discriminated union
keyed on `mode` — `routes` is only required in the default `"deposit"` mode:

```ts
type TrustwareConfigOptions = {
  apiKey: string;
  mode?: "deposit"; // default, omit this field entirely for a normal deposit/top-up widget
  routes: {
    toChain: string;
    toToken: string;
    fromToken?: string;
    fromChain?: string;
    fromAddress?: string;
    toAddress?: string;
    defaultSlippage?: number;
    options?: {
      routeRefreshMs?: number;
      fixedFromAmount?: string | number;
      minAmountOut?: string | number;
      maxAmountOut?: string | number;
    };
  };
  autoDetectProvider?: boolean;
  theme?: "light" | "dark" | "system"; // TrustwareTheme
  messages?: Partial<TrustwareWidgetMessages>;
  retry?: RetryConfig;
  walletConnect?: WalletConnectConfig;
  features?: FeatureFlags;
  onError?: (error: TrustwareError) => void;
  onSuccess?: (transaction: Transaction) => void;
  onEvent?: (event: TrustwareEvent) => void;
} | {
  apiKey: string;
  mode: "swap"; // swap widget — from/to chain+token are chosen entirely in-widget
  routes?: Partial<TrustwareConfigOptions["routes"]>; // optional, not required
  // ...same common fields as above
};
```

### Modes

- **`"deposit"`** (default — `mode` can be omitted): the standard bridge/top-up widget.
  `routes.toChain` and `routes.toToken` are required.
- **`"swap"`**: an in-widget token swap UI where the user picks both sides themselves.
  `routes` is not required at all:

  ```ts
  const trustwareConfig = {
    apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY!,
    mode: "swap",
  } satisfies TrustwareConfigOptions;
  ```

  Use `features.swapDefaultDestToken` / `features.swapLockDestToken` /
  `features.swapAllowedDestTokens` to steer the destination token selection (see
  `FeatureFlags` in `src/types/config.ts`).

  > The older `features: { swapMode: true }` flag (combined with a `routes` object) still
  > works and is treated as equivalent to `mode: "swap"`, but is deprecated in favor of the
  > `mode` field above.

### Route Fields

- `routes.toChain`: destination chain key or chain id string.
- `routes.toToken`: destination token address or registry token identifier.
- `routes.fromToken`: optional source token preference.
- `routes.fromChain`: optional source chain preference.
- `routes.fromAddress`: optional source wallet override.
- `routes.toAddress`: optional destination address override.
- `routes.defaultSlippage`: optional slippage percentage. Defaults to `1`.

Chain and token fields are strings, including numeric chain ids — `"8453"`, not
`8453`.

### Route Options

- `routes.options.routeRefreshMs`: auto-refresh cadence for route previews.
- `routes.options.fixedFromAmount`: locks the widget amount input to a fixed USD amount.
- `routes.options.minAmountOut`: minimum allowed USD amount.
- `routes.options.maxAmountOut`: maximum allowed USD amount.

### Other Config Groups

- `autoDetectProvider`: enables Trustware-managed wallet discovery. Defaults to
  `false` — set it to `true` if you are not attaching a wallet yourself.
- `theme`: widget color mode — `"light" | "dark" | "system"` (default
  `"system"`). Switch it at runtime with `Trustware.setTheme("dark")`.
- `messages`: top-level copy overrides.
- `retry`: rate-limit observability callbacks — see [Rate Limiting](#rate-limiting).
- `walletConnect`: WalletConnect overrides.
- `features`: feature rollout controls, including swap-mode token selection constraints.
- `onError`, `onSuccess`, `onEvent`: lifecycle callbacks — see [Events](#events).

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

Use this when your app already controls wallet connection through Wagmi or another adapter.

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

`useWagmi` (like `useEIP1193`) is a plain adapter factory, not a React hook,
despite the `use` prefix. If your ESLint setup runs `react-hooks/rules-of-hooks`
it will flag the call inside the `useMemo` callback above; silence it with an
`eslint-disable-next-line react-hooks/rules-of-hooks` comment — the call is
safe. See [docs.trustware.io](https://docs.trustware.io/guides/embedded-wallets#adapt-the-embedded-wallet)
for the same pattern with embedded wallets.

Use this mode when:

- your app already owns wallet state
- you do not want the SDK to pick another provider
- you want the widget UX but not the widget’s wallet discovery responsibilities

### 3. Controlled Widget Shell

`TrustwareWidget` also supports basic shell control through props and a ref.

```tsx
import { useRef } from "react";
import { TrustwareProvider, TrustwareWidget } from "@trustware/sdk";
// The widget's prop and ref types live on the widget entry, not the root barrel.
import type { TrustwareWidgetRef } from "@trustware/sdk/react";

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

- `theme?: "light" | "dark" | "system"` — initial mode only; `Trustware.setTheme()` drives it afterwards
- `initialStep?: "home" | "select-token" | "crypto-pay" | "processing" | "success" | "error"`
- `defaultOpen?: boolean` — defaults to `true`, which is what you want for inline usage
- `style?: React.CSSProperties` — merged onto the widget shell
- `onOpen?: () => void`
- `onClose?: () => void`
- `showThemeToggle?: boolean` — defaults to `true`

And the ref (`TrustwareWidgetRef`): `open()`, `close()`, `isOpen()`. `close()`
asks for confirmation first if a transaction is in flight, so it is safe to wire
straight to a dismiss button.

### 4. Headless Core API

Use this when you want Trustware’s routing and wallet plumbing without the widget UI.

```ts
import { Trustware } from "@trustware/sdk";

// buildRoute states both sides explicitly. fromAmount is in the source token's
// smallest unit, and the estimate comes back on the route — there is no
// separate quote call.
const route = await Trustware.buildRoute({
  fromChain: "1",
  fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
  toChain: "8453",
  toToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // native on Base
  fromAmount: "25000000", // 25 USDC (6 decimals)
  fromAddress: await Trustware.getAddress(),
  toAddress: "0xDestination...",
});
console.log(route.route?.estimate, route.finalExchangeRate);

// Or let the SDK own route + submit + receipt + polling. Missing route fields
// come from the provider config; the sender comes from the attached wallet.
const tx = await Trustware.runTopUp({ fromAmount: "25000000" });
console.log(tx.status, tx.destTxHash);
```

See [docs.trustware.io](https://docs.trustware.io) for the full headless flow.

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

`Trustware` is a plain object, not a class or an event emitter — there is no
`Trustware.on()`. Events reach you through `config.onEvent`.

**Lifecycle and config**

- `Trustware.init(config)` loads the config and validates the API key once.
- `Trustware.getConfig()` returns the resolved config.
- `Trustware.setTheme(mode)` / `getTheme()` switch the widget's color mode at runtime.
- `Trustware.setDestinationAddress/Chain/Token()` update the route defaults in place.

**Wallets**

- `Trustware.useWallet(wallet)` attaches a wallet imperatively.
- `Trustware.getWallet()` and `Trustware.getAddress()` expose the active wallet.
- `Trustware.autoDetect()` can still be used if you want SDK-managed discovery outside the widget.
- `Trustware.getIdentity()` / `resolveAddressForChain()` / `addIdentityAddress()` handle
  multi-chain identities, so an EVM address and a Solana address can belong to one user.

**Routes, status and balances**

- `buildRoute`, `buildDepositAddress` — build a route, or an address to deposit into.
- `submitReceipt`, `submitStepReceipt`, `sendRouteTransaction`, `runTopUp` — execution.
- `getStatus`, `pollStatus` — read a transaction through to a terminal state.
- `getBalances`, `getBalancesByAddress`, `getBalancesByAddressStream`.
- `useChains`, `useTokens` — React hooks over the chain and token registries.
- `validateAddressForChain`, `validateRouteAddresses` — check addresses before you spend a request.

There is no `getQuote`: the estimate is part of the route, on
`route.route?.estimate` and `route.finalExchangeRate`.

### Provider Context

`useTrustware()` returns `{ status, errors, core, emitError, emitSuccess,
emitEvent, revalidate }`. `status` is `"idle" | "initializing" | "ready" |
"error"` — gate anything that calls the API on `"ready"`. `core` is the same
`Trustware` facade, handed to you so you don't have to import it separately, and
`revalidate()` re-runs init after a failure (an API key arriving late, for
instance).

## Smart Accounts

For ERC-4337 flows, `@trustware/sdk/smart-account` sends a route as a user
operation rather than a wallet transaction:

```ts
import {
  createTrustwareSmartAccountClient,
  sendRouteAsUserOperation,
} from "@trustware/sdk/smart-account";
```

It is a separate entry point on purpose — 65 KB gzipped, and nothing pulls it in
unless you import it.

## Events

`config.onEvent` receives a discriminated `TrustwareEvent`:

- `error`
- `transaction_started`
- `transaction_success`
- `wallet_connected`
- `token_page_loaded`
- `token_page_error`
- `balance_stream_chunk`
- `balance_stream_fallback`
- `swap_route_changed`

## Rate Limiting

The API is rate limited per API key, and that limit is shared by everyone using
your key — not per end user. Your key's limit, its remaining requests and the
window boundary come back on every response (`X-RateLimit-Limit`, `-Remaining`,
`-Reset`, plus `Retry-After` on a 429).

The SDK retries 429s on the schedule those headers state — it keeps no schedule
of its own to disagree with them. It waits exactly as long as the server asks,
for as long as the total stays under 10 seconds. Past that it stops and throws,
because how long your app can afford to block is the one thing the server can't
know. If a response carries no timing at all, the SDK stops rather than
guessing: the limit is a fixed window, so an invented delay either lands inside
the same closed window or overshoots one it could have read exactly.

None of that is configurable — the limit is enforced server-side, so no client
setting can widen it. If you need more headroom, ask us to raise the limit on
your key. `retry` configures observability only:

```ts
const config = {
  ...trustwareConfig,
  retry: {
    onRateLimitInfo: (info) => console.debug(info.remaining, "requests left"),
    onRateLimited: (info, attempt) => console.warn("429", attempt, info),
    onRateLimitApproaching: (info) => showSoftWarning(info),
    approachingThreshold: 5,
  },
} satisfies TrustwareConfigOptions;
```

`RateLimitError` distinguishes the two ways the SDK gives up:

- `retriesExhausted: false` — the wait is known and simply longer than the SDK
  will block for. `rateLimitInfo.retryAfter` holds it, so show the user when to
  come back instead of leaving them on a spinner.
- `retriesExhausted: true` — the response carried no usable timing, so there was
  nothing to retry against.

## Docs

Full API reference, integration guides, and examples live at
[docs.trustware.io](https://docs.trustware.io).
