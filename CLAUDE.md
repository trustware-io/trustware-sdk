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
- Other core modules: `http.ts` (fetch wrapper + retry/rate-limit, exports `RateLimitError`), `routeError.ts` (structured `RouteError` + code vocabularies; provider outcomes are `declined` / `failed` / `rejected`, the last being a 400 `invalid_address` verdict that `mapError` maps to category `"invalid_address"`), `forex.ts`, `registryClient.ts`, `sdkRpc.ts`.

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

# Claude Code Instructions

## Working Style

- Push back on genuinely bad ideas, with reasoning. Point out bugs, misleading names,
  and better approaches when you see them. Direct but collaborative.
- If requirements are ambiguous or a design decision could reasonably go multiple ways,
  ask rather than guess. A quick question is cheaper than reworking a wrong assumption.
- **If a prompt looks damaged or wrong, STOP and say so** — truncated mid-sentence,
  duplicated blocks, garbled copy/paste, references to context that doesn't exist, or
  instructions that contradict prior decisions without acknowledging they do. Do not
  execute a best-guess reconstruction. A mangled prompt executed faithfully is worse
  than a delay.
- **Decisions live in the repo, not in chat.** When a ruling or plan change arrives
  mid-session, write it into the durable work file (progress notes, this file, the
  relevant spec) and commit before executing it. If the session ended the moment
  after the message was read, the repo alone must be enough to act on it.

## No Silent Failures

Crashes make bugs obvious and fixable. Silent fallbacks make bugs hard to find.
Fail loudly when something goes wrong — never hide bugs behind default values or
fallback behavior.

- If a condition indicates a programmer error, crash (throw/panic/assert). Do NOT
  silently fall back to a default. `port = config.port ?? 8080` hides missing config;
  assert it exists instead.
- Do not type values as optional/nullable when they are always expected to be present.
  Use direct access and let violations crash — that's a bug to fix, not a case to handle.
- Do not add defensive code for "impossible" cases. If a branch should be unreachable,
  fail with an error saying so — never a silent default. Use exhaustiveness checking
  in switches/matches over closed sets so adding a variant breaks the build, not the
  runtime.
- Do not catch errors that indicate bugs. If parsing internal data or indexing a
  structure you just built can fail, that's a bug — let it crash. Empty catch blocks
  are forbidden.
- Every raised error includes what went wrong and the offending values:
  `Unknown effect type "reverb2" in project "demo"`, not `invalid input`.
- Validation happens at IO boundaries (file load, network, IPC, user input) with strict
  schemas — reject bad data with specifics, never repair it. Past the boundary, data is
  trusted and invariants are asserted, not handled.
- Environmental failures (disk full, permission denied) are hard errors surfaced to
  the user, naming the operation and the OS error. Never continue in a silently
  degraded mode. Report the error you observed; don't speculate about causes you
  didn't measure.
- Shell scripts use `set -euo pipefail`.
- Gate-then-commit chains must be failure-aborting: `check && commit`, never
  `check; commit` — a red gate must make the commit unreachable, not optional.

## Types Guarantee Correct Use

**A type's signature must guarantee that it can only be used correctly.** Making
invalid states unrepresentable is the best-known instance, but the principle is
broader: design every API so the misuse you would otherwise document, review for,
or debug is instead a compile error or unwritable. If correct use depends on a
calling convention the signature doesn't force, redesign the signature. (In
dynamically-typed languages, apply the same principle via validating constructors,
runtime schemas, and lint rules — the enforcement mechanism changes, not the goal.)

- Constrained values get their own types with validating constructors — a normalized
  0…1 parameter, an ID, a hash. Construction is the only way in, and construction
  fails loudly on violation. Raw numbers/strings are for values with no invariant.
- Parse, don't validate: unvalidated input crosses the boundary exactly once, becoming
  rich domain types. Downstream functions accept only those types, so "forgot to
  validate" cannot be written.
- Put units in types (`seconds`, `ticks`, `pixels`, `cents`). A unit mixup must fail
  to typecheck. Names alone are NOT enough for domain quantities — use nominal/branded
  types or wrapper structs with unit conversions as the only constructors. Distinguish
  quantities that look alike but make different claims (integer grid positions vs.
  continuous positions).
- State that must change together lives behind one object whose methods preserve the
  invariant; no naked setters that can desynchronize sibling fields.
- An operation that can legitimately refuse returns a result the caller must
  explicitly handle — never a boolean the caller can ignore. (Bugs still crash.)
- Detect "did X happen" by reading a direct fact — a monotonic counter, an identity —
  never a proxy (stack depth, array length, a timestamp) that can alias under
  saturation or reuse.
- Resource lifetimes: when a lifetime is lexical, expose only a bracket construct
  (acquire, run, release in finally/defer/RAII) so leaking is unwritable. When a
  lifetime spans events, acquisition goes only through a shared lifecycle primitive
  whose signature demands everything abnormal-end handling needs; release on every
  exit path is that primitive's tested contract, not each call site's memory.
- Cross-cutting policies (write gating, locking, validation, sanitization) are
  enforced at ONE structural chokepoint that all call sites flow through, with
  tooling making bypass a build failure — never by remembering to add a guard at
  each site. Per-site discipline produces endless hole-patching; a chokepoint makes
  the next hole impossible to write.

## Testing

Write tests for all new functionality. Tests must rigorously verify intended
behavior — vague assertions are worse than no test because they give false confidence.

Tests ship **in the same commit** as the code they cover — a feature without tests is
incomplete work, not a follow-up task.

- Assert exact expected values, not loose predicates like "contains 'error'".
- **Cover every legitimate use case.** Enumerate the distinct ways a real caller
  exercises the feature — the happy paths, plural — and test each explicitly. One
  happy-path test plus ten edge cases is under-tested where it matters most.
- Test the actual contract: exact outputs, exact error messages, boundary conditions,
  failure modes — alongside, never instead of, the legitimate-use enumeration. Aim
  for branch coverage.
- **Every claimed invariant is a property test.** Any "never"/"always" in a comment,
  commit message, or issue resolution must exist as a test spanning the full input
  regime — including regime boundaries and crossings, which is exactly where
  hand-picked small-perturbation examples pass while the claim is false. Use
  property-based generation for numeric or structural domains: examples prove
  existence; properties prove claims. Finiteness (no NaN/Inf) is part of every
  numeric claim.
- If a function should fail on bad input, test that it fails with the expected message.
- **A comparison test proves nothing unless its output is SENSITIVE to the behavior
  under test.** Saturated values, all-zero outputs, and round-trips through lossy
  identity all pass for broken code. After building a fixture or golden reference,
  inspect what it actually produces and verify a plausible bug would move the
  result — sensitivity is checked empirically, never assumed.
- **Attribution is measured, never inferred.** After each fix, re-run and record what
  actually changed. "These failures share my hypothesized cause" is an experiment to
  run, not a deduction to make.
- **When refactoring, implement the change first — against the spec or reference
  behavior — and only then run the tests as independent checks on finished work.**
  Never let a refactor emerge from fixing failing tests one by one: with "make this
  test green" as the goal, every edit bends toward whatever the code currently does,
  and drift flows through the sanctioned channel — setup changes — so the suite ends
  up green while certifying bugs. Tests steered by the work they check are not checks.
- Never make a test pass by weakening its assertions. Test failures are information:
  discuss with the user before changing either the test or the code.
- Run tests yourself when possible, but every run must be bounded and exit — no
  orphaned watch modes, dev servers, or background processes. Ask the user to run
  anything that requires infrastructure you shouldn't start.
- Verify UI or visual work by actually looking at output (screenshots, rendered
  results), not by assuming.

## Security

Write code to high-assurance standards. Code involving cryptography, authentication,
parsing untrusted input, crossing process/FFI boundaries, spawning processes,
filesystem access, or concurrency requires extra care and scrutiny.

- Prefer secure-by-default designs over manual discipline at every call site:
  templating that escapes by default, parameterized queries, schema validation on
  arrival at every trust boundary, centralized path resolution and checking.
- Never build shell strings, HTML, or queries from data. Spawn processes with
  argument arrays; render text as text.
- Executable content and data content are different things. If a format is supposed
  to be data, it must never gain an eval path, dynamic import, or plugin hook for
  user-supplied code — that boundary is what makes untrusted content safe, and
  breaking it is never acceptable.
- For cryptography: do not implement primitives or protocols — use established,
  audited libraries. Assume side channels exist: constant-time comparisons for
  anything secret-dependent, and never expose key material in errors, logs, or
  debug output.
- Adding a dependency means trusting its authors with arbitrary code execution —
  supply-chain risk is real. Only use well-known, actively-maintained packages; for
  anything less established, ask the user first.
- Think adversarially about your own designs and code. After each commit, review the
  diff for security issues relevant to the changed code (injection, path traversal,
  XSS, unvalidated input at boundaries, auth gaps, hardcoded secrets) and report
  findings before continuing.

## Formats and Interfaces

**Anti-Postel: be strict in what you accept AND strict in what you emit.** The
robustness principle is how format ambiguity, parser divergence, and security bugs
are born. Accept exactly what the spec defines and reject everything else with
specifics; emit exactly one canonical encoding, never "whatever happens to parse."
Leniency in a parser is not kindness — it silently becomes part of the format,
because whatever you accept, someone will ship.

- Reject, don't repair: malformed input is an error naming what's wrong, never a
  best-effort fix-up. There is no "probably meant" branch.
- No undocumented acceptance: if the parser takes it, the spec says so. If the spec
  doesn't say so, the parser rejects it.
- Canonical output: one valid encoding per document. If the format promises
  canonicality, test that re-encoding is byte-identical.

**Compatibility is a promise you make explicitly, not a default you drift into.**
Decide per project which surfaces carry a compatibility promise (shipped file
formats, wire protocols, public APIs) and which are internal and freely changeable.
For internal surfaces, the delete-don't-deprecate rule applies: change them and
update every consumer in the same commit. For surfaces that DO carry a promise:

- Breaking changes happen only behind an explicit version bump, and are always
  announced, never incidental: named in the commit message and called out when
  reporting the work.
- **Changes to promised surfaces stop for user sign-off.** Present the exact
  proposed change (signature, field, semantics) and wait for approval before it
  lands. No proceed-and-inform-later.
- Keep a fixture corpus: real artifacts from every supported version live in the
  repo, and each must load (and round-trip byte-identically where promised) as a
  permanent test. A fixture is never deleted or regenerated to make a test pass
  while its version is still supported.
- Round-trip property: `decode(encode(x)) ≡ x` over generated valid inputs, not just
  hand-picked examples.
- Every constant the format commits you to lives in one module under a snapshot
  test — changing one without a version bump in the same commit is a test failure,
  never a quiet edit.
- Specs ship test vectors: a clean-room re-implementer must be able to verify their
  implementation without reading your code.
- Determinism is tested, not assumed: same inputs ⇒ bit-identical outputs, proven by
  differential tests; no wall-clock reads or unseeded randomness in deterministic paths.
- Crash consistency: persistence writes are atomic (temp + rename, stated fsync
  policy); every reader has torn/truncated/garbage fixtures proving corruption becomes
  a boundary rejection — never a crash, never a silent repair.

## Editing Code — Never by Pattern

**Mass edits are never done with a regex, and the context of any edited code must be
understood before it is edited.** Edit site by site: read each one, know what it
means, change it deliberately. Pattern *searching* to find candidate sites is fine —
the ban is on pattern-driven *writing*. A regex matches a shape; what matters is the
meaning, and identical text can mean different things in different domains. Only
reading the call site tells them apart.

## Maintainability — Anti-Entropy Rules

A codebase built fast rots in predictable ways. These rules stop each one.

**One way to do each thing.**
- Before writing any function, component, or pattern, search for an existing one that
  does the job. Extend or reuse it; never write a parallel implementation.
- Finding two near-duplicates makes unifying them part of the current task, not a
  someday-cleanup.
- One canonical name per domain concept, everywhere. Never introduce a synonym for an
  existing concept; a new concept gets a named type in the core layer first.
- Constants and magic values have one home. Repeating a literal is a bug waiting to
  desynchronize.
- The same goes for every shared surface, not just literals: option lists, validation
  bounds, schemas, vocabularies. Define once; every consumer imports or composes it.
  A second dialog, boundary, or validator must never restate its own copy — even a
  copy that looks locally complete will silently drift.

**Delete, don't deprecate.**
- When a project has no external consumers of an interface, changing it means
  updating every call site in the same commit — no compatibility shims, re-export
  layers, or deprecation markers.
- Replaced code is removed in the commit that replaces it. No commented-out blocks,
  no unused exports, no `-old`/`-v2` files. Version control history is the archive.

**No premature abstraction.**
- Write the concrete version first. Extract an abstraction only when the second real
  use exists — not when you predict one. Interfaces with one implementation,
  factories, managers, and generic parameters "for flexibility" are slop.
- No configuration options, feature flags, or fallback paths nothing uses. Every
  branch must be reachable by a real requirement.

**Type honesty.**
- Escape hatches that silence the type system (`any`, unchecked casts, non-null
  assertions, `unsafe`) are forbidden or require a comment stating why they're safe.
  Prefer type guards and schema-validated parsing at boundaries. Silencing the
  checker is hiding a bug.

**Comments.**
- Comments state invariants, constraints, and non-obvious *why* — never *what* the
  next line does, never narration, never history (that's the commit message). Most
  code should need no comments because the names carry the meaning.

**Files and structure.**
- When a file grows past a few hundred lines, look for the module boundary trying to
  get out — but don't shatter code into fragments either; a file holds one coherent
  concern.
- Respect the project's dependency direction (e.g. UI depends on core, never the
  reverse; core stays free of platform concerns).
- Import from the defining module; avoid barrel/re-export layers that hide structure
  and breed cycles.
- No ad-hoc documentation litter: durable docs live in the designated docs location,
  working state in the designated progress file. No scratch SUMMARY/NOTES/PLAN files.

**Consistency beats local taste.**
- Before writing in any area, read the neighboring code and match its patterns. If a
  pattern deserves changing, change it everywhere in a dedicated refactor commit —
  never fork a second style alongside the first.

**Gardening is part of every milestone.**
- A milestone isn't done until: no dead code, no known duplicated logic, no lint
  suppressions without justification, sane file sizes, dependency rules passing.
  Entropy is removed on the spot, not logged for later.

## Style

- **Naming**: clear, descriptive names that read as plain English —
  `remainingAttempts` over `rem`, `decodeStemFile()` over `procF()`. Abbreviations
  only when universally understood (`id`, `url`, `config`).
- **Functional style**: prefer map/filter/reduce or iterator chains over manual loops
  with mutable accumulators when they make intent clearer. Don't force it when a loop
  reads better (hot paths often should be plain loops with no per-iteration
  allocation).
- **No incomplete code**: no TODO stubs or placeholder implementations. Every piece
  of code ships complete and functional. If a task is too large, discuss scope
  reduction rather than writing skeleton code.

## Commits

Make clear, atomic commits for every logical unit of work. Don't batch unrelated
changes.

- Start the message with a verb: Add, Fix, Update, Remove, Refactor.
- Be concise but specific: `Add onset envelope to modulation sources`, not
  `Update code`.
- Commit before moving on to the next task.
- Never stage blindly: no `git add -A` / `git add .`. Stage explicit paths for
  exactly the files the commit is about, and read `git status` before committing.
  The user's working files must never enter commits, gitignored or not.

## Issue and Task Management

- Never mark an issue or task completed without explicit user verification. Resolve
  individual points, but closure requires the user's confirmation.
- Always test changes before claiming they work; describe expected behavior and ask
  the user to verify.
