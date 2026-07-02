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

## Release Process

Publishing is **tag-driven**. Branch pushes never publish — pushing a version tag is what cuts a release. Two npm packages are published from this repo:

| Tag | Package | Dist-tag | Environment |
|-----|---------|----------|-------------|
| `v1.2.3`           | `@trustware/sdk`         | `latest`  | `npm-production` |
| `v1.2.3-staging.5` | `@trustware/sdk-staging` | `staging` | `npm-staging`    |

### Automated release (recommended)

Use the **Release** workflow (`.github/workflows/release.yml`) — GitHub Actions → Release → Run workflow → enter version (e.g. `1.1.8` or `1.1.8-staging.1`). It picks the branch from the version pattern, runs `npm version`, commits, pushes the branch, and pushes the tag. The tag push triggers `publish.yml`.

It does **not** merge staging → main. For a production release: merge staging → main yourself, then run the workflow with the production version — `CHANGELOG.md` is regenerated automatically (see below).

### Changelog automation

`cliff.toml` configures [git-cliff](https://git-cliff.org) to generate Keep-a-Changelog entries from Conventional Commits. On production releases (`X.Y.Z`), the Release workflow runs git-cliff and commits the updated `CHANGELOG.md` alongside the version bump. Staging tags are skipped (`skip_tags` in `cliff.toml`), so their commits roll into the next production release section. `publish.yml` also creates a GitHub Release for every published tag with git-cliff-generated notes (staging releases marked as prereleases).

Preview locally before cutting: `git-cliff --tag v1.2.3 --unreleased`.

### Bumping the version

**ALWAYS use `npm version` — never hand-edit `package.json`.** `npm version` updates both `package.json` and `package-lock.json` atomically. Hand-editing leaves `package-lock.json` stale, which makes `npm ci` (used in both CI and publish workflows) fail, and silently ships a lockfile whose top-level `version` lies about the release.

```bash
npm version 1.2.3 --no-git-tag-version          # production
npm version 1.2.3-staging.5 --no-git-tag-version # staging
```

If you've already hand-edited `package.json`, recover with:
```bash
npm install --package-lock-only --ignore-scripts
```

### Cutting a production release

```bash
# Bump version (updates package.json AND package-lock.json)
npm version 1.2.3 --no-git-tag-version
git commit -am "chore(release): v1.2.3"
git push origin main

# Tag and push
git tag v1.2.3
git push origin v1.2.3
```

The publish workflow runs `publish-production`, verifies the tag matches `package.json`, builds against the production API, and publishes `@trustware/sdk@1.2.3`.

### Cutting a staging release

```bash
# From the staging branch — bump first so package.json matches the tag
npm version 1.2.3-staging.5 --no-git-tag-version
git commit -am "chore(release): v1.2.3-staging.5"
git push origin staging

git tag v1.2.3-staging.5
git push origin v1.2.3-staging.5
```

The publish workflow runs `publish-staging`, rewrites the package to `@trustware/sdk-staging` with version `1.2.3-staging.5`, builds against the staging API, and publishes.

### Why tag-driven (not branch-driven)

`workflow_run` jobs execute in the repo's default-branch context, not the upstream workflow's `head_branch`. Combined with environment deployment-branch policies, that meant a CI success on `main` couldn't deploy to `npm-production` because the run's actual ref was the default branch (`staging`). Tag pushes run in the tag's context, which the `npm-production` environment allows via tag-pattern policies (`v*` for prod, `v*-staging.*` for staging).

### npm trusted publishing

Each npm package's trusted-publisher config references the matching GitHub environment (`@trustware/sdk` ↔ `npm-production`, `@trustware/sdk-staging` ↔ `npm-staging`). Mismatch returns 404 from npm publish.

### Build-time secrets

`TRUSTWARE_API_ROOT`, `TRUSTWARE_GTM_ID`, and `TRUSTWARE_WALLETCONNECT_PROJECT_ID` are sourced from Doppler (`trustware-sdk` project, `stg`/`prd` configs) and synced to the matching GitHub environment. Do **not** add a `prepublishOnly` script — npm runs it during `npm publish` after the workflow's package.json rewrite, with no env scoping, baking empty secrets into the bundle.

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

> The widget formerly lived under `src/widget-v2/`; it is now `src/widget/`. There is no `widget-v2` directory anymore (the exported component is still internally named `TrustwareWidgetV2` and aliased to `TrustwareWidget` in `src/widget/index.tsx`).

### Entry Point
- `src/index.ts` — single barrel. Re-exports: `Trustware`/`TrustwareCore` (core facade), `TrustwareProvider`/`useTrustware`, `TrustwareWidget`, `TrustwareError`, wallet helpers (`walletManager`, `useWalletDetection`, `WagmiBridge`, …), `RateLimitError`, plus `./identity`, `./validation/address`, `./types`, `./constants`.

### Core Facade (`src/core/`)
`Trustware` (type alias `TrustwareCore`) is a plain object facade — the headless API. Key surface (`src/core/index.ts`):
- **Lifecycle**: `init(config)` (loads config into `TrustwareConfigStore` + validates the API key once via `validateSdkAccess`), `getConfig()`, `useWallet(w)`, `autoDetect(timeoutMs)`.
- **Config setters**: `setDestinationAddress/Chain/Token`, `setTheme`/`getTheme` (toggle the widget's light/dark/system mode at runtime, e.g. from a host app's own theme toggle), `addIdentityAddress`, `resolveAddressForChain`, `getWallet`, `getIdentity`, `getAddress`.
- **REST** (`core/routes.ts`, `core/balances.ts`): `buildRoute`, `buildDepositAddress`, `submitReceipt`, `getStatus`, `pollStatus`, `getBalances`, `getBalancesByAddress`, `getBalancesByAddressStream`.
- **Data hooks** (`core/useChains.ts`, `core/useTokens.ts`): `useChains`, `useTokens`.
- **Tx** (`core/tx.ts`): `sendRouteTransaction`, `runTopUp`.
- Other core modules: `http.ts` (fetch wrapper + retry/rate-limit, exports `RateLimitError`), `forex.ts`, `registryClient.ts`, `sdkRpc.ts`.

### Provider (`src/provider.tsx`)
`TrustwareProvider` props: `config: TrustwareConfigOptions` (required), `wallet?`, `autoDetect = true`. On mount it runs `Trustware.init(config)`, attaches a passed wallet or `autoDetect`s one, and tracks `status: "idle" | "initializing" | "ready" | "error"`. `useTrustware()` returns `{ status, errors, core, emitError, emitSuccess, emitEvent, revalidate }`. The provider bridges `config.onError` / `onSuccess` / `onEvent` callbacks to the emit helpers.

`TrustwareConfigOptions` (`src/types/config.ts`): `apiKey`, `routes { toChain, toToken, fromToken?, fromChain?, toAddress?, defaultSlippage?, options? }`, `theme` (`light|dark|system`), `messages?`, `retry?`, `walletConnect?`, `features?` (feature flags incl. `swapMode`, `balanceStreaming`, `tokensPagination`, swap-dest-token controls), `onError/onSuccess/onEvent`.

### Widget (`src/widget/`)
- `index.tsx` — exports `TrustwareWidget` (= internal `TrustwareWidgetV2`).
- `pages/` — `Home`, `SelectToken`, `CryptoPay/` (deposit/amount flow + `RouteQuoteLoader.tsx`), `Processing`, `Success`, `Error`.
- `state/deposit/` — navigation + wallet/token state hooks (`useDepositNavigationState`, `useWalletTokenState`, `useWalletConnect`, `useWalletSessionState`, `useThemePreference`, `types.ts`).
- `features/` — feature folders (`amount`, `route-preview`, `token-selection`, `transaction`, `wallet`).
- `components/`, `hooks/`, `context/`, `data/` (`popularChains.json`, `featuredAssets.json`), `helpers/`, `lib/` (`mapError.ts` — maps backend/route errors → user-facing messages for the Error page; `utils.ts`), `styles/`, `utils/`, `__tests__/`.

### Widget Navigation (real flow)
`src/widget/state/deposit/useDepositNavigationState.ts` is a history-stack navigator, **not** the old 8-state machine. Steps (`NavigationStep`):
```
home → select-token → crypto-pay → processing → success | error
```
`goBack()` pops the history stack; `resetNavigation()` returns to `home`.

### Other Subsystems
- `src/modes/swap/` — swap mode (gated by `features.swapMode`): `SwapMode.tsx`, `currency.ts`, hooks (`useSwapRoute`, `useSwapExecution`, `useForex`), components.
- `src/smart-account/` — ERC-4337 path: `createTrustwareSmartAccountClient`, `sendRouteAsUserOperation`, `permit2.ts` (`PERMIT2`, `randomPermit2Nonce`), `uniswap.ts`, `fee-utils.ts`.
- `src/identity/` — multi-chain wallet identity resolution (address ↔ chain normalization, used by `Trustware.getIdentity()`/`resolveAddressForChain`).
- `src/wallets/` — detection + connection (`detect.ts`, `connect.ts`, `manager.ts` (`walletManager`), `adapters.ts`, `bridges.ts` (wagmi bridge), `eipWallets.ts`, `solana.ts`, `deepLink.ts`, `metadata.ts`).
- `src/config/` — `store.ts` (`TrustwareConfigStore`), `defaults.ts`, `merge.ts`, `walletconnect.ts`.
- `src/errors/` — `TrustwareError.ts` + `errorCodes.ts` (`INVALID_CONFIG`, `INVALID_API_KEY`, `WALLET_NOT_CONNECTED`, `BRIDGE_FAILED`, `NETWORK_ERROR`, `INPUT_ERROR`, `UNKNOWN_ERROR`).
- `src/events/events.ts` — `TrustwareEvent` union (`error`, `transaction_started`, `transaction_success`, `wallet_connected`, `token_page_loaded/error`, `balance_stream_chunk/fallback`, `swap_route_changed`), surfaced via `config.onEvent`.
- `src/validation/address.ts` — `validateAddressForChain`, `validateRouteAddresses`.
- `src/utils/chains.ts` — chain key/type normalization. `src/logos/` — bundled logo asset.

### WalletConnect Integration
WalletConnect uses `@reown/appkit-universal-connector` (`@reown/appkit*` ^1.8.x), configured in `src/config/walletconnect.ts` (defines the Solana CAIP network + Universal Connector). A built-in project ID ships in `src/constants`; override via `config.walletConnect.projectId`.

## Build Configuration

- **Bundler**: tsup (esbuild-based)
- **Output**: ESM + CJS + TypeScript declarations
- **External deps**: react, react-dom, wagmi, @rainbow-me/rainbowkit, @walletconnect/ethereum-provider, qrcode, radix-ui (viem stays external too — peer dep)

## Code Style

- ESLint 9.x flat config
- Prettier (2-space indent, 80 char width, semicolons)
- Module resolution: `baseUrl: "."` (no `paths` configured). Imports use `src/...` (baseUrl-relative) or relative paths. **No `@/` alias** — do not introduce it without also wiring `tsconfig` `paths` and the tsup/build resolver.

### Import Conventions

Each directory has a barrel `index.ts` that re-exports all public symbols. **Always import from the barrel**, not individual files:

```typescript
// Good - import from barrel
import { AmountSlider, TokenSwipePill, LoadingSkeleton } from "../components";
import { useRouteBuilder, useTransactionSubmit } from "../hooks";
import { colors, spacing, fontSize } from "../styles";

// Bad - import from individual files
import { AmountSlider } from "../components/AmountSlider";
import { useRouteBuilder } from "../hooks/useRouteBuilder";
import { colors } from "../styles/tokens";
```

When adding a new component/hook/module, export it from the directory's `index.ts` barrel file.

## Styling Architecture (CRITICAL)

**DO NOT use Tailwind CSS, external CSS files, or any CSS-in-JS library for widget styling.**

The widget uses **inline styles only** to ensure it works when embedded in any host application (Next.js, Vite, etc.) without requiring the host to process CSS.

### Style System Structure

```
src/widget/styles/
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

## Changelog

Per-release history is auto-generated by git-cliff in `CHANGELOG.md` (see Release Process). Do not hand-maintain a changelog here.
