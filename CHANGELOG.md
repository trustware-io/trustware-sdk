# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - Unreleased

### Breaking Changes

- **Widget Rewrite**: The `TrustwareWidget` component has been completely rewritten with a new architecture:
  - New modern UI design with Tailwind CSS and shadcn-ui styling
  - Swipe-to-confirm interaction for transaction approval
  - Improved accessibility with keyboard navigation and long-press alternatives
  - Dark/light mode toggle with system preference support
  - Animated page transitions

- **Props Changes**:
  - Removed: Internal state props (widget now manages its own state)
  - Added: `theme` prop accepts `'light' | 'dark' | 'system'`
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

- **CSS Import Required**: The new widget requires importing its styles:
  ```tsx
  import '@trustware/sdk/styles.css';
  ```

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
import '@trustware/sdk/styles.css';

<TrustwareWidget theme="dark" />
```

#### Programmatic Control

The new widget supports programmatic open/close control via refs:

```tsx
import { TrustwareWidget, TrustwareWidgetRef } from '@trustware/sdk';
import '@trustware/sdk/styles.css';
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
