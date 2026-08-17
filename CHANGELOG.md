# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.10] - 2026-08-03


### Added

- Bridge and Call: optional `hooks.postHook` on `buildRoute`/`buildDepositAddress` executes a destination-chain contract call as soon as bridged funds land (e.g. depositing straight into a vault). New `PostHookRequest` type, plus an exported `assertValidPostHook` that fails fast client-side on a malformed hook. Fully backward compatible — omit `hooks` and nothing changes (#91)
- Automatic ERC20 approvals in `sendRouteTransaction`: reads `route.execution.approvals`, checks the current allowance, sends `approve()` only when it's insufficient, and waits for confirmation before sending the route transaction. Sponsored (Account Kit) routes are skipped — they grant allowance internally via Permit2. New `RouteApproval` type
- Exact landed-amount verification: `Transaction.landed_amount_verified` marks when `toAmountWei` is confirmed on-chain rather than a pre-trade quote estimate (#92)
- Ethereum and Polygon chain parameters for wallet network switching, expanding sponsorship chain coverage
- Exported `BuildRouteBody` and `BuildRouteResponse` types, and the `WALLETS` / `POPULAR_ORDER` wallet constants, from the package root


### Internal

- Bump action-gh-release to v3 for node24 runtime


## [1.1.9] - 2026-07-27


### Added

- Report connected EOA in receipt payload (#89)


### Fixed

- Clean up app-store fallback timeout in mobile wallet deep link
- Fix deeplink for swapMode
- Connect injected wallet in deposit mobile dropdown (#86)


### Internal

- Test and cleanup
- Pin npm to v11 for publish — npm 12.0.0 breaks --provenance
- Publish with npm 12 + co-installed sigstore
- Update LICENSE contact to contact@trustware.io
- Restore canonical Apache 2.0 text, add third-party notices


### Other

- Halliday deeplink
- Solana swap send reliability: fresh blockhash before signing, retry on wallet internal errors
- And theme toggle functions to be controled by app
- Remove unused config flag
- Bump version
- Sm
- Delete unused commented file
- Potential fix for pull request finding 'CodeQL / Stored cross-site scripting'
- Code rabbit fix
- Comment clean up
- Delete pakage-lock
- Add pakage-lock
- Add pakage-lock 2
- Add pakage-lock 3
- Fix formatting with Prettier
- Filter out non deeplink wallets
- Filter out non deeplink wallets for default mode
- Prettier format SwapMode + SwapWalletSelectorDesktop
- Adjust the Config rules (#88)
- Add nib chain

## [1.1.8] - 2026-06-24


### Fixed

- Fetch timeouts, input validation, safe BigInt parsing, remove debug log
- Stream balances
- Sync package-lock with viem/reown bumps
- Drop unused ethers, correct @solana/web3.js version
- Resolve set-state-in-effect lint errors and formatting
- Render staging release notes instead of empty body
- Reserve SOL fees on max, nested rejection code, dead wallet-standard listener


### Internal

- Bump to 1.1.8-staging.1
- Require npm version, document lockfile-sync trap
- Add status header, badges, and ASCII logo
- Polish ASCII banner, refine tagline, trim badges
- Shrink ASCII banner to cyberpunk HUD frame
- Remove stale design-system + roadmap docs, refresh CLAUDE.md
- Npm audit fix — safe transitive security bumps


### Other

- Sponsored tx structure
- OOG error handling and retry
- Monotonic fee escalation in retry loop
- Permit2 fees, etc.
- Dynamic base overrides
- Add test, and extra gas first SA tx
- Cap verificationGasLimit at 2x to satisfy bundler efficiency floor
- Swipe-to-confirm Image Fallback fix
- Exported functions and types from sdk for shillswap
- Undid some changes
- Retry logic for wallet connections
- Merge conflicts
- Npm i
- Swap mode
- Bump staging
- Patch
- Patch events
- Permit 2 bug patches
- Bump staging version
- Format
- Token & chain filtering
- Better token filtering
- Bump version
- Use effect clean up
- Search token fix

## [1.1.7] - 2026-05-20

### Fixed

- Solana wallets not listing in the wallet selector (#72).

## [1.1.6] - 2026-05-19

Released to production as `@trustware/sdk@1.1.6` (`v1.1.6`). Earlier staging
iterations: `1.1.6-staging.1`, `1.1.6-staging.2`, `1.1.6-staging.3`.

### Added

- Warn the user when funds would be sent to a wrong/unintended address (#69).

### Changed

- Block sending the same token to self — a no-op transfer is no longer offered (#68).
- Disconnect the previously connected wallet when the user switches wallets.
- `features.tokensPagination` now defaults to `true`. Consumers that
  explicitly set `features.tokensPagination: false` are unaffected.

### Fixed

- Gate the allowance probe on token↔chain consistency so it no longer fires
  with a mismatched token/chain pair (#70).
- `ImageLoader`: clear `srcIsEmpty` when `src` transitions empty → non-empty,
  so the fallback no longer renders alongside the successfully-loaded image (#71).
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

Baseline release. `1.1.2` was a release-pipeline-only publish (npm trusted
publishing, provenance, CI gating) with no SDK changes; `1.1.3` was never
released to production (staging prereleases only). The next production
release after `1.1.1` was `1.1.4`.
