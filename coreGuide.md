# Trustware SDK without the Widget

The Trustware core exports the same routing engine and wallet plumbing that
powers the widget. You can call it directly to embed quoting, route selection,
and transaction execution into your own UI while still reusing the resolved
configuration from `TrustwareProvider`.

## Prerequisites

- Install and configure `@trustware/sdk` as described in the [Integration Guide](../README.md).
- Wrap your app with `TrustwareProvider` so the core has access to your API key,
  default routes, theme, and wallet options.
- (Optional) Pass an existing wallet connection to the provider via the
  `wallet` prop or attach it later with `Trustware.useWallet(wallet)`.

Once the provider is mounted you can import the singleton core helpers from
`@trustware/sdk`.

```ts
import { Trustware } from "@trustware/sdk";
```

## Reading the Resolved Configuration

The core shares the same configuration instance that the widget uses. Retrieve
it via `Trustware.getConfig()` once the provider has mounted.

```ts
const cfg = Trustware.getConfig();
console.log(cfg.routes.toChain); // "8453"
```

The configuration automatically merges defaults from `resolveConfig`, including
fallbacks for `routes.toAddress` when you call `Trustware.setDestinationAddress`
or when only a `fromAddress` is present.

## Detecting / Managing Wallets

The SDK exposes light-weight helpers for wallet management:

- `Trustware.autoDetect()` – kicks off provider discovery if
  `autoDetectProvider` is enabled. Returns an `Unsub` function.
- `Trustware.useWallet(wallet)` – inject an already-connected wallet.
- `Trustware.getWallet()` / `Trustware.getAddress()` – read the active wallet or
  connected address.

You can combine these to build your own connection prompts or reuse a dapp’s
existing Wagmi/RainbowKit wiring.

```ts
// Example: attach a Wagmi wallet client imperatively
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

## Building and Quoting Routes

Use `Trustware.buildRoute` to create a route payload and
`Trustware.getQuote` to request pricing before showing anything to the user.

```ts
const cfg = Trustware.getConfig();
const fromAddress = await Trustware.getAddress();

const route = await Trustware.buildRoute({
  amount: "0.1",
  fromAddress,
  toAddress: cfg.routes.toAddress ?? fromAddress,
});

const quote = await Trustware.getQuote(route);
console.log(quote.expectedAmountOut);
```

- `amount` is denominated in the `fromToken` currency (typically native ETH).
- `fromAddress` defaults to the connected wallet if omitted.
- `toAddress` falls back to `cfg.routes.toAddress` and then `fromAddress` just
  like the widget does.

## Running a Top-up Without the Widget

`Trustware.runTopUp` orchestrates quoting, approvals, and transaction
submission. You can wrap it with your own UI state and progress indicators.

```ts
try {
  const result = await Trustware.runTopUp({
    amount: "0.25",
    fromAddress: await Trustware.getAddress(),
    // Optional if already set via setDestinationAddress or in config
    toAddress: "0xDestination...",
  });

  console.log("Top-up confirmed", result.txHash);
} catch (err) {
  console.error("Top-up failed", err);
}
```

The return value includes the transaction hash, receipt (when available), and
any intermediate approvals performed on the user’s behalf.

## Responding to Lifecycle Events

The core emits events that mirror the widget lifecycle. Register listeners with
`Trustware.on(event, handler)` and dispose of them via the returned
unsubscribe function.

```ts
const unsub = Trustware.on("status", (status) => {
  console.log("Trustware status", status);
});

// Later, when no longer needed:
unsub();
```

Useful events include:

- `status` – high-level status updates ("idle", "quoting", "submitting", etc.).
- `quote` – the most recent quote payload.
- `error` – errors thrown during route construction or submission.

## Error Handling Tips

- Display actionable errors surfaced from `Trustware.runTopUp` or event
  listeners, especially when approvals or bridge providers fail upstream.
- Consider wrapping calls in retry logic for transient network issues.
- Always guard core calls to ensure the provider has mounted and a wallet is
  available if required.

## Further Reading

- [Integration Guide](../README.md) – end-to-end overview and widget examples.
- Explore the TypeScript definitions in [`src/core`](../src/core) for the
  complete surface area, including advanced helpers for balances, tokens, and
  chain metadata.
