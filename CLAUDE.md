# Trustware SDK

React provider, widget, and headless API for cross-chain bridging and top-up routes.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (rebuilds on changes)
npm run build        # Production build to dist/
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

## Architecture

### Entry Points
- `src/index.ts` - Main exports (provider, widget, hooks, types)
- `src/styles.css` - Widget styles (imported separately)

### Key Directories
- `src/widget-v2/` - TrustwareWidget component and state machine
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

### 3. UI Migration to New Design System
**Files**: `src/widget-v2/styles.css`, `tailwind.config.js`, `src/widget-v2/components/WidgetContainer.tsx`, `src/widget-v2/pages/Home.tsx`

**Changes**:
- Updated color palette to bright blue primary (HSL 217 91% 60%)
- Added three-tier shadow system (soft, medium, large)
- Updated border-radius from 0.5rem to 1rem
- Added new animations (fade-in, slide-up, scale-in, token-hint-bounce)
- Home page: Replaced radio buttons with dropdown pill selectors for payment methods
