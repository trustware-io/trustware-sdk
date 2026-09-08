# Trustware SDK

React provider, widget, and headless API for cross-chain bridging and top-up routes.

## Development Commands

**CRITICAL: Always build with local backend URL during development:**

```bash
TRUSTWARE_API_ROOT=http://localhost:8000 npm run build
```

Other commands:

```bash
npm install               # Install dependencies
npm run dev               # Watch mode (rebuilds on changes) - NOTE: doesn't set API URL
npm run build:local       # Build against http://localhost:8000
npm run build:staging     # Build against the staging API
npm run validate          # Full validation (typecheck + lint:strict + format:check)
npm run test:unit         # Unit tests (scripts/run-unit-tests.mjs)
npm run test:widget-smoke # Builds, then runs the widget flow smoke test
npm run check:surface     # Assert the public export surface hasn't drifted
npm run size              # Report gzipped size per entry point
npm run size:check        # Same, but fails when an entry exceeds its budget
```

Bundle size is budgeted **per entry**, not as one number — `size-limit` in
`package.json` sets each one, and react/react-dom/viem/wagmi/rainbowkit/
walletconnect/qrcode/radix-ui are excluded as external. Current budgets:
smart-account 65 KB, wallet 525 KB, core 540 KB, widget and full SDK 665 KB
(all gzipped).

## Release Process

Publishing is **tag-driven**. Branch pushes never publish — pushing a version tag is what cuts a release. Two npm packages are published from this repo:

| Tag                | Package                  | Dist-tag  | Environment      |
| ------------------ | ------------------------ | --------- | ---------------- |
| `v1.2.3`           | `@trustware/sdk`         | `latest`  | `npm-production` |
| `v1.2.3-staging.5` | `@trustware/sdk-staging` | `staging` | `npm-staging`    |

### Automated release (recommended)

Use the **Release** workflow (`.github/workflows/release.yml`) — GitHub Actions → Release → Run workflow → enter version (e.g. `1.1.8` or `1.1.8-staging.1`). It picks the branch from the version pattern, runs `npm version`, commits, pushes the branch, and pushes the tag. The tag push triggers `publish.yml`.

It does **not** merge staging → main. For a production release: merge staging → main yourself, then run the workflow with the production version — `CHANGELOG.md` is regenerated automatically (see below).

### Changelog automation

`cliff.toml` configures [git-cliff](https://git-cliff.org) to generate Keep-a-Changelog entries from Conventional Commits. On production releases (`X.Y.Z`), the Release workflow runs git-cliff and commits the updated `CHANGELOG.md` alongside the version bump. Staging tags are skipped (`skip_tags` in `cliff.toml`), so their commits roll into the next production release section. `publish.yml` also creates a GitHub Release for every published tag with git-cliff-generated notes (staging releases marked as prereleases).

Commits that aren't Conventional Commits are **not** dropped — they land under an `### Other` heading. Prefix with `feat:`/`fix:`/`chore:` to get a properly grouped entry instead; merge and `chore(release):` commits are skipped entirely.

Preview locally before cutting: `git-cliff --tag v1.2.3 --unreleased` (for a version not yet tagged) or `git-cliff --latest` (for the newest existing tag). Note the distinction — `--unreleased` matches nothing once the tag exists, which is why `publish.yml` uses `--latest`.

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

- `src/index.ts` — single barrel. Re-exports: `Trustware`/`TrustwareCore` (core facade), `TrustwareProvider`/`useTrustware`, `TrustwareWidget`, `TrustwareError`, wallet helpers (`walletManager`, `useWalletDetection`, `WagmiBridge`, `useWagmi`, …), `RateLimitError`, plus `./identity`, `./validation/address`, `./types`, `./constants`.

### Core Facade (`src/core/`)

`Trustware` (type alias `TrustwareCore`) is a plain object facade — the headless API. Key surface (`src/core/index.ts`):

- **Lifecycle**: `init(config)` (loads config into `TrustwareConfigStore` + validates the API key once via `validateSdkAccess`), `getConfig()`, `useWallet(w)`, `autoDetect(timeoutMs)`.
- **Config setters**: `setDestinationAddress/Chain/Token`, `setTheme`/`getTheme` (toggle the widget's light/dark/system mode at runtime, e.g. from a host app's own theme toggle), `addIdentityAddress`, `resolveAddressForChain`, `getWallet`, `getIdentity`, `getAddress`.
- **REST** (`core/routes.ts`, `core/balances.ts`): `buildRoute`, `buildDepositAddress`, `submitReceipt`, `submitStepReceipt`, `getStatus`, `pollStatus`, `getBalances`, `getBalancesByAddress`, `getBalancesByAddressStream`.
  - `buildRoute` takes a full `BuildRouteBody` — `fromChain`, `toChain`, `fromToken`, `toToken`, `fromAmount`, `fromAddress`, `toAddress` are all **required**; it does not fall back to the provider config. `fromAmount` is in the source token's smallest unit (`fromAmountUsd` carries the USD figure). Optional `hooks.postHook` does bridge-and-call; `buildRoute`/`buildDepositAddress` run `assertValidPostHook` on it internally. That helper is defined in `src/core/routes.ts` and re-exported from both the package root and `./core`, so hosts can validate a hook before building.
  - There is **no** `getQuote` — the estimate comes back on the route (`route.route?.estimate`, `route.finalExchangeRate`).
  - The status wire payload is entirely snake_case while `Transaction` is camelCase. `getStatus` runs `normalizeStatusPayload` (`src/core/routes.ts`) to map every field onto the camelCase names the type advertises, keeping the raw wire keys alongside them. Before 1.1.11 it mapped only `request_id`/`provider_request_id`, so `sourceTxHash`/`destTxHash`/`intentId` read `undefined` everywhere except swap mode, which re-mapped four of them itself in `normalizeTx`.
- **Validation**: `validateAddressForChain`, `validateRouteAddresses`.
- **Data hooks** (`core/useChains.ts`, `core/useTokens.ts`): `useChains`, `useTokens`.
- **Tx** (`core/tx.ts`): `sendRouteTransaction`, `runTopUp`. `runTopUp({ fromAmount, ... })` resolves the rest from config, sends, submits the receipt, and polls — it resolves to the `Transaction` that `pollStatus` returns (read `sourceTxHash`/`destTxHash`; there is no `txHash` field).

There is **no** event-emitter on the facade (`Trustware.on` does not exist). Events reach the host through `config.onEvent`.

- **Route value guard** (`core/routeValue.ts`): `buildRoute`, `buildDepositAddress` and `sendRouteTransaction` all run `assertRouteDeliversValue`, which throws a `RouteError` (`code: "fees_exceed_output"`, one `declined` provider outcome with the same code, `status: 0`) when `toAmountUsd − totalFeesUsd < 0`. The backend ranks on that `net_usd` but never sends it or rejects on it, so the SDK recomputes it from the estimate. Fails open when either USD figure is missing. Lives in core, not a mode, so every consumer gets the same verdict; `mapError` maps the code to category `"fees_exceed_output"`.
- Other core modules: `http.ts` (fetch wrapper + retry/rate-limit, exports `RateLimitError`), `routeError.ts` (structured `RouteError` + code vocabularies), `forex.ts`, `registryClient.ts`, `sdkRpc.ts`.

### Provider (`src/provider.tsx`)

`TrustwareProvider` props: `config: TrustwareConfigOptions` (required), `wallet?`, `autoDetect = true`. On mount it runs `Trustware.init(config)`, attaches a passed wallet or `autoDetect`s one, and tracks `status: "idle" | "initializing" | "ready" | "error"`. `useTrustware()` returns `{ status, errors, core, emitError, emitSuccess, emitEvent, revalidate }`. The provider bridges `config.onError` / `onSuccess` / `onEvent` callbacks to the emit helpers.

`TrustwareConfigOptions` (`src/types/config.ts`) is a union discriminated on `mode`: `apiKey`, `mode?` (`"deposit"` default — `routes` required; `"swap"` — `routes` optional), `routes { toChain, toToken, fromToken?, fromChain?, fromAddress?, toAddress?, defaultSlippage?, options? }`, `autoDetectProvider?`, `theme?` (`"light" | "dark" | "system"`, default `"system"` — a **mode string, not a palette object**), `messages?`, `retry?` (observability callbacks only — the limit is server-side), `walletConnect?`, `features?` (`tokensPagination`, `balanceStreaming`, `swapMode`, `swapDefaultDestToken`, `swapLockDestToken`, `swapAllowedDestTokens`), `onError/onSuccess/onEvent`.

### Widget (`src/widget/`)

- `index.tsx` — exports `TrustwareWidget` (= internal `TrustwareWidgetV2`).
- `pages/` — `Home`, `SelectToken`, `CryptoPay/` (deposit/amount flow + `RouteQuoteLoader.tsx`), `Processing`, `Success`, `Error`.
- `state/deposit/` — navigation + wallet/token state hooks (`useDepositNavigationState`, `useWalletTokenState`, `useWalletConnect`, `useWalletSessionState`, `useThemePreference`, `types.ts`).
- `features/` — feature folders (`amount`, `route-preview`, `token-selection`, `transaction`, `wallet`). Domain logic and view-model hooks live here, not in `pages/`.
- `app/` — shell plumbing: `WidgetRouter.tsx`, `WidgetPersistence.ts`, `WidgetShellOverlays.tsx`, `widgetSteps.ts`, `WidgetAnalytics.tsx`.
- `components/`, `hooks/`, `context/`, `data/` (`popularChains.json`, `featuredAssets.json`), `helpers/`, `lib/` (`mapError.ts` — maps backend/route errors → user-facing messages for the Error page; `utils.ts`), `styles/`, `utils/`, `__tests__/`. `components/` is shell UI and reusable primitives; it should not import SDK orchestration code.

### Analytics (GA4 via GTM)

`src/hooks/useGTM.ts` exposes two hooks with different jobs. `useGTM(gtmId)`
loads the container; `useGTMTracker()` only pushes to an already-loaded one.
Event-only consumers must use the tracker.

`WidgetAnalytics` (`src/widget/app/`) is the single `useGTM` caller. It wraps
the mode branch in `TrustwareWidgetV2`, above both `SwapMode` and
`DepositProvider`, so the container loads for either mode. It used to sit
inside `WidgetInner`, which only renders on the deposit path, and swap-mode
hosts consequently reported nothing to GA4 at all. Keep it above the branch;
`grep -rn "useGTM(" src/` should return exactly one call site.

Container ownership is refcounted at module scope in `useGTM.ts`: the script
loads on 0 → 1 owners and unloads on 1 → 0, so two widgets on one page share
one container and the first to unmount does not silence the second.

Two events reach BigQuery, and their names and param keys are fixed by the BI
queries in `quicklinks_v1/iluvatar/db/g4a_repo.go` — renaming either breaks
dashboards outside this repo:

| Event               | Deposit                                                   | Swap                                        |
| ------------------- | --------------------------------------------------------- | ------------------------------------------- |
| `payment_initiated` | `features/transaction/hooks/useTransactionActionModel.ts` | `modes/swap/SwapMode.tsx` (`handleExecute`) |
| `payment_completed` | `widget/hooks/useTransactionPolling.ts`                   | `modes/swap/SwapMode.tsx` (`onSuccess`)     |

Both carry `from_chain`, `from_token`, `to_chain`, `to_token`, `domain`. Deposit
reads its destination from `config.routes`; **swap must not** — `routes` is
optional under `mode: "swap"` and is usually undefined, so swap reads its own
`toChain`/`toToken` state. `modes/swap/analytics.ts` builds the payload and
guards each emit with `claimAttemptOnce`, keyed on the route **object
identity** rather than `intentId`: `buildRoute` falls back to `intentId: ""`,
which an id-keyed guard would read as unclaimable and silently drop.

Collection is gated on `features.shouldAllowGA4` (default true), checked inside
`useGTM`. `GTM_ID` is baked at build time from `TRUSTWARE_GTM_ID`; an empty
value in a dev build logs and no-ops rather than throwing.

### Widget Navigation (real flow)

`src/widget/state/deposit/useDepositNavigationState.ts` is a history-stack navigator, **not** the old 8-state machine. Steps (`NavigationStep`):

```
home → select-token → crypto-pay → processing → success | error
```

`goBack()` pops the history stack; `resetNavigation()` returns to `home`.

### Other Subsystems

- `src/modes/swap/` — swap mode, selected with top-level `mode: "swap"` (the older `features.swapMode: true` is deprecated but still honored as equivalent): `SwapMode.tsx`, `currency.ts`, `analytics.ts` (GA4 payload builder + once-per-attempt guard), hooks (`useSwapRoute`, `useSwapExecution`, `useForex`), components.
- `src/smart-account/` — ERC-4337 path: `createTrustwareSmartAccountClient`, `sendRouteAsUserOperation`, `permit2.ts` (`PERMIT2`, `randomPermit2Nonce`), `uniswap.ts`, `fee-utils.ts`.
- `src/identity/` — multi-chain wallet identity resolution (address ↔ chain normalization, used by `Trustware.getIdentity()`/`resolveAddressForChain`).
- `src/wallets/` — detection + connection (`detect.ts`, `connect.ts`, `manager.ts` (`walletManager`), `adapters.ts`, `bridges.ts` (wagmi bridge), `eipWallets.ts`, `solana.ts`, `deepLink.ts`, `metadata.ts`). `eipWallets.ts` exports `useEIP1193` and `useWagmi` — plain adapter factories, **not** React hooks, despite the `use` prefix. **Do not rename them**: the names are the published API (docs.trustware.io and host integrations import them by name). The prefix means `react-hooks/rules-of-hooks` flags host call sites inside `useMemo`/`useEffect`; hosts silence it with an eslint-disable comment.
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
backgroundColor: "hsl(var(--tw-background))";
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
          toChain: 8453, // Base chain ID
          toToken: "USDC",
          toAddress: "0x...", // Destination wallet
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

| Component              | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `TrustwareProvider`    | Required context provider with API key and config |
| `TrustwareWidget`      | Full deposit widget with all UI states            |
| `TokenSwipePill`       | Horizontal token carousel with swipe gestures     |
| `AmountSlider`         | Range slider with snap-to-tick behavior           |
| `SwipeToConfirmTokens` | Swipe gesture for secure confirmation             |

## Changelog

Per-release history is auto-generated by git-cliff in `CHANGELOG.md` (see Release Process). Do not hand-maintain a changelog here.

Known drift: git-cliff commits `CHANGELOG.md` during a **production** release, so the update lands on `main` and nothing merges it back. `staging`'s copy therefore falls behind by every prod cut until someone syncs it (`git show origin/main:CHANGELOG.md > CHANGELOG.md`). A release whose section is missing entirely can be regenerated with `git-cliff vPREV..vTAG --tag vTAG`.

## Documentation

Public docs — API reference, integration guides, examples — live at
[docs.trustware.io](https://docs.trustware.io). **This repo has no `docs/`
folder; do not re-create one.** It previously held `coreGuide.md`,
`integrationGuide.md`, and widget refactor notes, all of which drifted into
documenting methods that never existed (`Trustware.getQuote`, `Trustware.on`, a
`theme` palette object). In-repo prose is limited to:

- `README.md` — install + quick start, and the only place SDK usage examples live
- `CLAUDE.md` — this file, for agents and contributors
- `LINTING.md` — lint/format tooling setup
- `THIRD_PARTY_NOTICES.md` — license attribution for bundled code; the only doc shipped in the npm tarball (`files[]`)

When changing a public API, update `README.md` **and** docs.trustware.io. Verify any example you write by compiling it — the deleted guides all type-checked as errors.
