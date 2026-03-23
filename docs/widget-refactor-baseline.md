# Widget Refactor Baseline

This document records the behavior that must stay intact during the widget performance and DX refactor.

## Primary User Flows

### Flow 1: Standard Crypto Path

1. User lands on `Home`.
2. User enters a valid amount unless the amount is fixed by config.
3. User opens wallet options and connects a supported wallet.
4. User reaches token selection or crypto payment flow depending on the wallet path.
5. User reviews route details on the crypto payment screen.
6. User confirms the transaction in the wallet.
7. User sees `Processing`.
8. User eventually reaches `Success` or `Error`.

### Flow 2: Fixed Amount Path

1. Config provides `routes.options.fixedFromAmount`.
2. The amount field is locked to that configured value.
3. Amount input mode remains USD.
4. Downstream route building uses the configured fixed amount unchanged.

### Flow 3: Resume in Same Session

1. Widget writes session state to session storage.
2. Refresh or remount should preserve the current step and transaction progress state where supported by the current widget implementation.
3. Reset should clear persisted widget flow state and return to `Home`.

### Flow 4: Wallet Token Loading

1. Connected wallet address triggers token balance loading.
2. Widget resolves balances into supported token metadata.
3. First token with balance may seed default token and chain selection.
4. Failed balance loading should degrade gracefully without crashing the widget.

## Invariants to Preserve

- `TrustwareProvider`, `TrustwareWidget`, `Trustware`, and `TrustwareError` remain exported from the package root.
- Package subpath exports remain available for `./core`, `./wallet`, `./react`, `./constants`, and `./types`.
- `TrustwareWidget` remains the public React widget export.
- Page transitions remain functionally equivalent even if animation internals move.
- Current wallet connection and transaction submission behavior must not be dropped.
- Balance-call optimization is out of scope for this refactor phase.

## Manual Validation Checklist

- `npm run build`
- `npm run typecheck`
- `npm run check:surface`
- Mount the widget and verify `Home` renders.
- Connect a wallet and confirm the widget advances correctly.
- Confirm amount validation still behaves the same for invalid, valid, and fixed amounts.
- Confirm the crypto payment page still builds a route when inputs are valid.
- Confirm successful submission still transitions to `Processing`.
- Confirm transaction failure still transitions to `Error`.
- Confirm reset returns to `Home`.

## Verification Status

Automated checks completed during the refactor:

- `npm run format`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run check:surface`

Automated status:

- Package public surface remained intact during the split.
- Type safety, lint, and build remain green after the refactor passes completed so far.

Manual flow checks still recommended in a mounted widget session:

- `Home` renders and fixed-amount mode still locks correctly.
- Wallet connect still advances through the intended step path.
- Token selection still preserves chain/token semantics.
- `CryptoPay` still builds routes with valid inputs and preserves validation behavior.
- `Processing -> Success/Error` transitions still match live transaction outcomes.
- Refresh/reset behavior still matches the persistence baseline.

## Known High-Risk Files

- `src/widget/context/DepositContext.tsx`
- `src/widget/pages/CryptoPay.tsx`
- `src/widget/pages/SelectToken.tsx`
- `src/widget/pages/Home.tsx`
- `src/widget/TrustwareWidgetV2.tsx`
