# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.6] - 2026-05-19

Currently published to the `staging` dist-tag as `@trustware/sdk-staging@1.1.6-staging.1`.

### Added

- Warn the user when funds would be sent to a wrong/unintended address (#69).

### Changed

- Block sending the same token to self — a no-op transfer is no longer offered (#68).
- Disconnect the previously connected wallet when the user switches wallets.

### Fixed

- Gate the allowance probe on token↔chain consistency so it no longer fires
  with a mismatched token/chain pair (#70).
- Chain support corrections.
- TrustWallet connection fix.

### Internal

- Removed dead `getEvmAccount` / `toHexChainId` helpers and a stale
  `eslint-disable`; console-log cleanup. No runtime behavior change.

## [1.1.5] - 2026-05-09

### Changed

- Wired WalletConnect into the wallet manager so connection state is shared.
- Refactored wallet modules to barrel imports.

### Fixed

- Corrected the "Enter an amount" copy on the Home screen.

## [1.1.4] - 2026-05-07

### Added

- Change destination chain and token at runtime.
- GTM / GA4 analytics wiring with per-environment GTM ID.

### Changed

- Release flow is now tag-driven (pushing a version tag publishes; branch
  pushes never publish). CI must pass before a tag is cut.
- CI and publish workflows bumped to Node 24 and actions v5.

### Fixed

- Source the WalletConnect project ID from the environment instead of a
  hardcoded value.
- Fall back to `"unknown"` in the `payment_completed` analytics payload
  instead of dropping the event.

### Security

- `npm audit fix` cleared all outstanding Dependabot alerts.

## [1.1.1] - 2026-03-24

Baseline release. Versions 1.1.2–1.1.3 were release-pipeline fixes only
(npm trusted publishing, provenance, CI gating) with no SDK changes.

## [2.0.0] - Unreleased

> Note: the widget rewrite described below already ships in the 1.1.x line —
> `TrustwareWidget` is the rewritten (v2) widget today. This section is kept
> as the consolidated migration reference for consumers still on the
> pre-rewrite widget; the `2.0.0` tag has not been cut.

### Breaking Changes

- **Widget Rewrite**: The `TrustwareWidget` component has been completely rewritten with a new architecture:
  - New UI rendered entirely with **inline styles** — no Tailwind, no CSS
    file, and no host CSS pipeline required (works embedded in any app)
  - Swipe-to-confirm interaction for transaction approval
  - Improved accessibility with keyboard navigation and long-press alternatives
  - Dark/light mode toggle with system preference support
  - Animated page transitions

- **Props Changes**:
  - Removed: Internal state props (widget now manages its own state)
  - Added: `theme` prop accepts `'light' | 'dark' | 'system'`
  - Added: `style` prop for additional inline styles on the widget container
  - Added: `defaultOpen` prop to control initial visibility (defaults to `true`)
  - Added: `showThemeToggle` prop to show/hide theme toggle button (defaults to `true`)
  - Added: `onClose` and `onOpen` callback props
  - Added: `initialStep` prop for starting at a specific navigation state

- **Ref API**: The widget now exposes a ref with programmatic control methods:
  ```tsx
  interface TrustwareWidgetRef {
    open: () => void;
    close: () => void;
    isOpen: () => boolean;
  }
  ```

- **No CSS Import**: Unlike earlier drafts of this rewrite, the widget ships
  zero CSS. Do **not** `import '@trustware/sdk/styles.css'` — no such file
  exists; all styling is inline and self-contained.

### Added

- **New Types**:
  - `TrustwareWidgetProps` - Props for the TrustwareWidget component
  - `TrustwareWidgetRef` - Ref methods for programmatic control
  - `TrustwareWidgetV2`, `TrustwareWidgetV2Props`, `TrustwareWidgetV2Ref` - Explicit v2 exports

### Removed

- Old widget implementation files:
  - `amountInput.tsx`
  - `confirmPayment.tsx`
  - `paymentFailure.tsx`
  - `paymentStatus.tsx`
  - `paymentSuccuess.tsx`
  - `provider.tsx`
  - `tokenChainSelection.tsx`
  - `walletSelection.tsx`
  - `welcome.tsx`

### Migration Guide

#### Basic Usage

Before:
```tsx
import { TrustwareWidget } from '@trustware/sdk';

<TrustwareWidget />
```

After:
```tsx
import { TrustwareWidget } from '@trustware/sdk';

<TrustwareWidget theme="dark" />
```

#### Programmatic Control

The new widget supports programmatic open/close control via refs:

```tsx
import { TrustwareWidget, TrustwareWidgetRef } from '@trustware/sdk';
import { useRef } from 'react';

function App() {
  const widgetRef = useRef<TrustwareWidgetRef>(null);

  return (
    <>
      <button onClick={() => widgetRef.current?.open()}>
        Open Deposit Widget
      </button>
      <TrustwareWidget
        ref={widgetRef}
        defaultOpen={false}
        onClose={() => console.log('Widget closed')}
        onOpen={() => console.log('Widget opened')}
      />
    </>
  );
}
```

#### Theme Configuration

The new widget supports light/dark/system themes:

```tsx
// Follow system preference (default)
<TrustwareWidget theme="system" />

// Force dark mode
<TrustwareWidget theme="dark" />

// Force light mode
<TrustwareWidget theme="light" />

// Hide the theme toggle button
<TrustwareWidget theme="dark" showThemeToggle={false} />
```
