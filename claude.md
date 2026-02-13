# Trustware SDK

React provider, widget, and headless API for cross-chain bridging and top-up routes.

## Development Commands

**CRITICAL: Always build with local backend URL during development:**
```bash
TRUSTWARE_API_ROOT=http://localhost:8000 npm run build
```

Other commands:
```bash
npm install          # Install dependencies
npm run dev          # Watch mode (rebuilds on changes) - NOTE: doesn't set API URL
npm run validate     # Full validation (typecheck + lint:strict + format:check)
npm run size         # Check bundle size (limit: 50 KB gzipped)
```

## Local Development with Example Webapp

When developing the SDK locally and testing with the example-webapp, use `npm link`:

```bash
# Use nvm to avoid permission issues with global npm link
nvm use 22

# In trustware-sdk directory - create the link
cd /path/to/trustware-sdk
npm link

# In example-webapp directory - consume the link
cd /path/to/example-webapp
npm link @trustware/sdk

# Start SDK in watch mode (terminal 1)
cd /path/to/trustware-sdk
npm run dev

# Start example-webapp (terminal 2)
cd /path/to/example-webapp
npm run dev
```

**Important**: After running `npm install` in the example-webapp, the symlink may be replaced with the published package. Re-run `npm link @trustware/sdk` to restore the local link.

## Local Development with Next.js Apps

Next.js 16+ with Turbopack requires additional configuration to work with npm-linked packages outside the project directory.

```bash
# Use nvm to avoid permission issues with global npm link
nvm use 22

# Create the global link from SDK directory
cd /path/to/trustware-sdk
npm link

# Link in the Next.js app
cd /path/to/next-app
npm link @trustware/sdk
```

**CRITICAL**: Next.js 16 Turbopack doesn't resolve symlinked packages outside the project root by default. You MUST configure `outputFileTracingRoot` to point to a parent directory that contains both projects:

```typescript
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@trustware/sdk"],
  // Required for npm link - points to common parent of this project and linked SDK
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
```

Without `outputFileTracingRoot`, you'll get "Module not found: Can't resolve '@trustware/sdk'" errors even though the symlink exists and resolves correctly. This is because Turbopack restricts module resolution to the project root for caching and performance reasons.

**Sources**:
- [Next.js 16's Turbopack breaks npm link](https://steveharrison.dev/next-js-16s-turbopack-breaks-npm-link/)
- [GitHub Issue #77562](https://github.com/vercel/next.js/issues/77562)

## Pointing SDK to Local Backend

**ALWAYS use this command when building during local development:**

```bash
TRUSTWARE_API_ROOT=http://localhost:8000 npm run build
```

The API URL is baked in at build time. Default is `https://api.trustware.io` (production).
If you run `npm run build` without the env var, the SDK will call production APIs!

## Architecture

### Entry Points
- `src/index.ts` - Main exports (provider, widget, hooks, types)

### Key Directories
- `src/widget-v2/` - TrustwareWidget component and state machine
- `src/widget-v2/styles/` - Design tokens, theme, animations, utilities
- `src/wallets/` - Wallet detection, connection adapters, WalletConnect
- `src/config/` - Configuration store and defaults
- `src/hooks/` - React hooks for quotes, transactions, etc.
- `src/types/` - TypeScript type definitions

### Widget State Machine
The TrustwareWidget uses an 8-state flow:
```
Welcome → ChainTokenSelection → AmountEntry → Quoting →
WalletConnection → PaymentProcessing → Success/Failure
```

### WalletConnect Integration
WalletConnect is enabled by default with a built-in project ID. Users can:
- Use it without any configuration (default)
- Override with their own `walletConnect.projectId`
- Disable with `walletConnect.disabled: true`

## Build Configuration

- **Bundler**: tsup (esbuild-based)
- **Output**: ESM + CJS + TypeScript declarations
- **External deps**: react, react-dom, wagmi, @rainbow-me/rainbowkit, @walletconnect/ethereum-provider, qrcode

## Code Style

- ESLint 9.x flat config
- Prettier (2-space indent, 80 char width, semicolons)
- Path alias: `@/` → `src/`

## Styling Architecture (CRITICAL)

**DO NOT use Tailwind CSS, external CSS files, or any CSS-in-JS library for widget styling.**

The widget uses **inline styles only** to ensure it works when embedded in any host application (Next.js, Vite, etc.) without requiring the host to process CSS.

### Style System Structure

```
src/widget-v2/styles/
  index.ts           # Barrel export
  tokens.ts          # Design tokens (colors, spacing, typography, shadows)
  theme.ts           # CSS variable injection via <style> tag
  animations.ts      # Keyframe definitions for injection
  utils.ts           # mergeStyles() utility for conditional styles
```

### Patterns

**Static styles** - Define as `React.CSSProperties` constants:
```typescript
const buttonStyle: React.CSSProperties = {
  padding: spacing[3],
  backgroundColor: colors.primary,
  borderRadius: borderRadius.xl,
};
```

**Conditional styles** - Use `mergeStyles()`:
```typescript
<div style={mergeStyles(
  baseStyle,
  isActive && activeStyle,
  isDisabled && { opacity: 0.5 }
)}>
```

**Animations** - Keyframes are injected via `<style>` tag in WidgetContainer:
```typescript
<div style={{ animation: 'tw-fade-in 0.3s ease-out' }}>
```

**Theming** - CSS variables injected via `<style>` tag, referenced in inline styles:
```typescript
backgroundColor: 'hsl(var(--tw-background))'
```

### Why No Tailwind/External CSS

When the SDK is embedded in a host app, the host's build system doesn't process the SDK's CSS:
- Tailwind classes won't be compiled
- CSS imports may fail or be ignored
- PostCSS plugins won't run

Inline styles are self-contained and work everywhere.

## SDK Usage in Consumer Apps

### Basic Setup (React/Vite/Next.js)

1. **Install the SDK**:
```bash
npm install @trustware/sdk
```

2. **Wrap your app with TrustwareProvider**:
```tsx
import { TrustwareProvider } from "@trustware/sdk";

function App() {
  return (
    <TrustwareProvider
      apiKey="your-api-key"
      config={{
        routes: {
          toChain: 8453,          // Base chain ID
          toToken: "USDC",
          toAddress: "0x...",     // Destination wallet
        },
      }}
    >
      <YourApp />
    </TrustwareProvider>
  );
}
```

3. **Add the widget anywhere in your app**:
```tsx
import { TrustwareWidget } from "@trustware/sdk";

function TopUpPage() {
  return (
    <div>
      <h1>Top Up Your Wallet</h1>
      <TrustwareWidget />
    </div>
  );
}
```

### With Wagmi/RainbowKit (Recommended)

For apps using wagmi and RainbowKit, wrap TrustwareProvider inside the wagmi providers:

```tsx
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { TrustwareProvider, TrustwareWidget } from "@trustware/sdk";

function Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <TrustwareProvider
            apiKey={process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY}
            config={{
              routes: {
                toChain: 8453,
                toToken: "USDC",
                toAddress: "0x...",
              },
            }}
          >
            {children}
          </TrustwareProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Widget Flow

The widget follows this user flow:
1. **Home** - User sees deposit options (Pay with crypto / Pay with fiat)
2. **Select Token** - Two-column layout to select chain and token
3. **Confirm Deposit** - Amount entry with slider, token carousel, fee summary
4. **Swipe to Confirm** - Final confirmation before transaction
5. **Processing** - Transaction submitted and waiting for confirmation
6. **Success/Error** - Result screen

### Key Components

| Component | Description |
|-----------|-------------|
| `TrustwareProvider` | Required context provider with API key and config |
| `TrustwareWidget` | Full deposit widget with all UI states |
| `TokenSwipePill` | Horizontal token carousel with swipe gestures |
| `AmountSlider` | Range slider with snap-to-tick behavior |
| `SwipeToConfirmTokens` | Swipe gesture for secure confirmation |

## Recent Bug Fixes (2026-01-21)

### 1. Transaction Receipt Not Submitted to Backend
**File**: `src/widget-v2/hooks/useTransactionSubmit.ts`

**Problem**: After `sendRouteTransaction()` returned a transaction hash, the SDK was not calling `submitReceipt(intentId, hash)` to notify the backend. This meant the backend never knew the transaction was sent and couldn't track its status.

**Fix**: Added `submitReceipt()` call after successful transaction submission:
```typescript
// After getting the hash from wallet
await submitReceipt(routeResult.intentId, hash);
```

### 2. Route Amount Not Converted to Smallest Unit
**File**: `src/widget-v2/hooks/useRouteBuilder.ts`

**Problem**: The `fromAmount` was being sent as a decimal string (e.g., "0.1") but the backend expects it in the token's smallest unit (e.g., wei).

**Fix**: Convert amount using token decimals before sending:
```typescript
const decimals = selectedToken.decimals || 18;
const [whole, fraction = ""] = amount.split(".");
const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
const fromAmountWei = (whole + paddedFraction).replace(/^0+/, "") || "0";
```

### 3. UI Migration to Inline Styles (2026-01-29)
**Files**: All `src/widget-v2/**/*.tsx` files

**Changes**:
- Converted from Tailwind CSS to inline styles for full host-app compatibility
- Created design tokens system in `src/widget-v2/styles/`
- Theme/animation CSS injected via `<style>` tag in WidgetContainer
- Removed tailwind.config.js, postcss.config.js, styles.css
- Removed Tailwind dependencies from package.json

### 4. Token Picker/Slider Visual Improvements (2026-02-01)
**Files**: `src/widget-v2/components/AmountSlider.tsx`, `src/widget-v2/components/TokenSwipePill.tsx`

**AmountSlider improvements**:
- Thicker track (0.625rem) with gradient and glow effect
- Larger thumb (1.75rem) with prominent border and shadow
- More visible tick marks with glow when active
- Better-styled value display with border
- Improved spacing and font weights

**TokenSwipePill improvements**:
- Limited pagination dots to max 5 visible (prevents cluttered UI with many tokens)
- Smart dot display: shows first, current, surrounding, and last dots
- Gap indicators for skipped tokens
- Cleaner visual hierarchy
