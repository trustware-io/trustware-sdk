# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.6] - 2026-05-19 (staging only — not yet released to production)

Published to the `staging` dist-tag as `@trustware/sdk-staging@1.1.6-staging.1`.
No production `@trustware/sdk@1.1.6` / `v1.1.6` tag has been cut yet.

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

Baseline release. `1.1.2` was a release-pipeline-only publish (npm trusted
publishing, provenance, CI gating) with no SDK changes; `1.1.3` was never
released to production (staging prereleases only). The next production
release after `1.1.1` was `1.1.4`.
