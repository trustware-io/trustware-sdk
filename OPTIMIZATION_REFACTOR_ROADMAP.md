# Trustware SDK Optimization and DX Refactor Roadmap

This document turns the architecture review into a concrete implementation roadmap with the exact target folder tree and a file-by-file migration checklist.

The goal is to improve performance and developer experience, reduce monolithic files, keep folders clearly named and structured, and preserve all current functionality. The backend balance call is intentionally out of scope.

## Progress Snapshot

Last reviewed: 2026-03-21

Current status against the roadmap:

- Phase 1 is complete: baseline docs, architecture boundary docs, and public-surface checks are in place.
- Phase 2 is materially complete: `DepositContext` has been split into narrower state slices and targeted hooks, while preserving the compatibility layer.
- Phase 3 is materially complete: `CryptoPay` business logic has been extracted into feature hooks and most render-heavy sections are now feature components.
- Phase 4 is materially complete: `Home` and `SelectToken` have been reduced to composition pages with extracted wallet/token-selection logic and UI sections.
- Phase 5 is materially complete: `TrustwareWidgetV2` has been broken into router, persistence, overlay, and step metadata modules.
- Phase 6 is partially complete: feature-level exports and several local boundaries are cleaner, but import standardization and bundle-hygiene review still need a focused pass.

Course correction:

- The original sequence planned widget-shell cleanup after `Home` and `SelectToken`, but in practice Phase 5 was pulled forward while working through Phase 3.
- That change was acceptable because it reduced one of the largest widget shell bottlenecks without changing public behavior.
- The highest-value remaining work is no longer the page split itself. It is now import/boundary cleanup, final module relocation against the target tree, and validation against the baseline behavior expectations.

## Objectives

- Keep current SDK and widget behavior intact while refactoring internals.
- Reduce render churn in the widget.
- Move business logic out of page components and oversized context files.
- Standardize module boundaries so `ui`, `features`, `state`, and `core` each have a clear role.
- Make the widget easier to extend without growing more monolithic files.
- Preserve public exports and package entrypoints unless a change is explicitly planned and versioned.

## Current Pressure Points

- `src/widget/pages/CryptoPay.tsx` is overloaded with UI, amount parsing, route preparation, gas logic, and transaction flow concerns.
- `src/widget/context/DepositContext.tsx` owns too many unrelated responsibilities, causing broad re-renders and weak separation of concerns.
- `src/widget/TrustwareWidgetV2.tsx` carries navigation, persistence, animation, and page orchestration in one place.
- `src/widget/pages/Home.tsx` and `src/widget/pages/SelectToken.tsx` contain too much non-presentational logic.
- Internal imports mix relative paths and `src/...` aliases, which makes moves and ownership boundaries harder to reason about.
- The repository has minimal protection against regressions during refactor because there is no real widget-flow test harness today.

## Target Folder Structure

This is the recommended target shape for `src/widget` after the refactor:

```text
src/
  widget/
    index.tsx
    TrustwareWidgetV2.tsx
    app/
      WidgetShell.tsx
      WidgetRouter.tsx
      WidgetPersistence.ts
      widgetSteps.ts
    state/
      deposit/
        DepositProvider.tsx
        depositReducer.ts
        depositSelectors.ts
        types.ts
      wallet/
        WalletProvider.tsx
        walletSelectors.ts
      ui/
        UiPreferencesProvider.tsx
    features/
      amount/
        components/
          AmountInputDisplay.tsx
          AmountSlider.tsx
        hooks/
          useAmountConstraints.ts
          useDepositAmountModel.ts
        lib/
          amountValidation.ts
          amountFormatting.ts
          amountConversion.ts
      wallet/
        components/
          WalletSelector.tsx
          WalletConnectModal.tsx
        hooks/
          useWalletConnection.ts
          useWalletTokens.ts
        lib/
          walletDisplay.ts
      token-selection/
        components/
          TokenList.tsx
          TokenRow.tsx
          ChainFilter.tsx
        hooks/
          useTokenSelection.ts
          useFilteredTokens.ts
      route-preview/
        hooks/
          useRoutePreview.ts
          useGasEstimate.ts
        lib/
          routeErrorMapping.ts
          routeFormatting.ts
      transaction/
        components/
          SwipeToConfirmTokens.tsx
          TransactionSteps.tsx
        hooks/
          useTransactionSubmit.ts
          useTransactionPolling.ts
          useConfirmTransaction.ts
        lib/
          transactionErrorMapping.ts
          receiptSubmission.ts
    pages/
      Home.tsx
      SelectToken.tsx
      CryptoPay.tsx
      Processing.tsx
      Success.tsx
      Error.tsx
    ui/
      primitives/
        Dialog.tsx
        Toast.tsx
        CircularProgress.tsx
      layout/
        WidgetContainer.tsx
      feedback/
        ConfettiEffect.tsx
        ThemeToggle.tsx
      skeletons/
        LoadingSkeleton.tsx
    lib/
      chainHelpers.ts
      tokenAmount.ts
      mergeStyles.ts
    styles/
      index.ts
      theme.ts
      tokens.ts
      animations.ts
      utils.ts
    data/
      chainPopularity.json
```

## Boundary Rules

- `pages/` compose data and UI, but do not own business rules.
- `ui/` contains presentational components only and does not call SDK APIs directly.
- `features/` owns domain-specific hooks, view models, and feature-local helpers.
- `state/` owns provider state, reducers, actions, and selectors.
- `lib/` is for low-level shared widget utilities that are not tied to one feature.
- `core/` and `widget/` should not cross-import arbitrarily. Prefer narrow imports through stable internal boundaries.

## Phased Implementation Plan

### Phase 1: Baseline and Safety Rails

Purpose: protect current behavior before splitting files.

Tasks:

- Add a lightweight widget flow test harness.
- Record current page transition behavior and expected state persistence behavior.
- Capture current public exports and package entrypoints as invariants.
- Add lint guidance or docs for internal import conventions.

Deliverables:

- Widget flow checklist covering `home -> connect -> select token -> crypto pay -> processing -> success/error`.
- A small test scaffold or validation harness that can be run before and after each phase.
- Short architecture note describing the new folder ownership rules.

### Phase 2: State Decomposition

Purpose: reduce re-renders and remove the context bottleneck.

Tasks:

- Split `DepositContext` responsibilities into smaller state domains.
- Introduce reducer/selectors or multiple contexts so consumers subscribe only to the state they actually need.
- Move theme persistence and UI-only preferences out of the main deposit flow state.
- Move wallet token loading logic into a wallet-focused feature hook or wallet state provider.

Deliverables:

- Smaller state modules under `src/widget/state`.
- Thin compatibility layer so existing pages continue working during migration.

### Phase 3: Extract CryptoPay Domain Logic

Purpose: remove the biggest monolith first.

Tasks:

- Move amount parsing, USD/token conversion, and validation into `features/amount`.
- Move route building and fee formatting into `features/route-preview`.
- Move transaction confirmation and submit flow into `features/transaction`.
- Leave `CryptoPay.tsx` as a page-level composition component.

Deliverables:

- A much smaller `CryptoPay.tsx`.
- Dedicated hooks for route preview and transaction confirmation.

### Phase 4: Refactor Home and SelectToken

Purpose: make the entry flow and asset selection flow composable and maintainable.

Tasks:

- Extract wallet connection logic and dropdown behavior from `Home.tsx`.
- Extract token filtering, chain filtering, and sorting behavior from `SelectToken.tsx`.
- Promote reusable token list UI into feature or `ui` components.

Deliverables:

- Thin route pages with feature hooks.
- Reusable wallet and token selection modules.

### Phase 5: Widget Shell Cleanup

Purpose: simplify top-level widget orchestration.

Tasks:

- Split `TrustwareWidgetV2.tsx` into app shell, router, transition handling, and persistence modules.
- Keep the public widget export stable.
- Isolate page transition metadata and session persistence logic.

Deliverables:

- `WidgetShell.tsx`
- `WidgetRouter.tsx`
- `WidgetPersistence.ts`
- Smaller `TrustwareWidgetV2.tsx`

### Phase 6: Import and Bundle Hygiene

Purpose: improve maintainability and avoid accidental coupling.

Tasks:

- Standardize internal imports on one convention.
- Remove `src/...` imports where they create weak boundaries.
- Review which widget-only dependencies can be lazy-loaded or isolated.
- Re-run size checks once the split is complete.

Deliverables:

- Cleaner import graph.
- Better separation between public API, widget internals, and core modules.

## File-by-File Migration Checklist

### Highest Priority

#### `src/widget/context/DepositContext.tsx`

- Extract navigation state into `state/deposit`.
- Extract wallet state and wallet token loading into `state/wallet` or `features/wallet/hooks/useWalletTokens.ts`.
- Extract theme persistence into `state/ui`.
- Replace one large context value with smaller selectors or focused providers.
- Keep a compatibility export temporarily if needed to avoid a giant one-shot migration.

#### `src/widget/pages/CryptoPay.tsx`

- Move amount computation into `features/amount/hooks/useDepositAmountModel.ts`.
- Move route preview logic into `features/route-preview/hooks/useRoutePreview.ts`.
- Move gas-price caching logic into `features/route-preview/hooks/useGasEstimate.ts`.
- Move transaction-submit orchestration into `features/transaction/hooks/useConfirmTransaction.ts`.
- Move error mapping into `features/route-preview/lib/routeErrorMapping.ts` and `features/transaction/lib/transactionErrorMapping.ts`.
- Keep page code focused on layout, conditional rendering, and CTA wiring.

#### `src/widget/TrustwareWidgetV2.tsx`

- Extract page registry and step order to `app/widgetSteps.ts`.
- Extract persisted session state read/write to `app/WidgetPersistence.ts`.
- Extract transition behavior and animation direction handling to `app/WidgetRouter.tsx`.
- Keep the public component small and stable.

#### `src/widget/pages/Home.tsx`

- Move amount validation logic into `features/amount/lib`.
- Move wallet connection behavior into `features/wallet/hooks/useWalletConnection.ts`.
- Break dropdown UI into smaller components where appropriate.
- Keep fiat placeholder behavior unchanged unless explicitly redesigned.

### Medium Priority

#### `src/widget/pages/SelectToken.tsx`

- Extract filtering, sorting, and selected-token derivation to `features/token-selection/hooks`.
- Split row rendering and list rendering into smaller components.
- Keep current token/chain semantics intact.

#### `src/widget/hooks/useRouteBuilder.ts`

- Remove hidden dependency on widget context where possible.
- Change the hook to operate on explicit inputs only.
- Keep route refresh and abort behavior intact.
- Move error mapping out to a dedicated utility.

#### `src/widget/hooks/useTransactionSubmit.ts`

- Keep existing behavior, but relocate it under `features/transaction/hooks`.
- Separate pure error-mapping logic from React state updates.
- Consider a service helper for receipt submission.

#### `src/widget/hooks/useTransactionPolling.ts`

- Move under `features/transaction/hooks`.
- Keep polling semantics stable.
- Isolate status mapping from UI concerns.

### Lower Priority but Worth Cleaning

#### `src/widget/components/TokenSwipePill.tsx`

- Review whether it should be split into smaller visual and logic pieces.
- Remove any page-specific assumptions that belong in a feature hook.

#### `src/widget/components/WalletSelector.tsx`

- Move to `features/wallet/components`.
- Keep it UI-focused and lift connection logic upward.

#### `src/widget/components/AmountSlider.tsx`

- Move to `features/amount/components`.
- Ensure it only accepts derived props and emits changes.

#### `src/widget/components/AmountInputDisplay.tsx`

- Move to `features/amount/components`.
- Keep formatting and parsing rules outside the component.

## Performance Work Items

- Reduce provider churn by splitting state subscriptions.
- Avoid recalculating large token lists or route inputs on every render.
- Memoize derived token views where they are expensive and stable.
- Keep transient open/close UI state local instead of global.
- Remove duplicated amount parsing and validation work across pages.
- Audit route refresh timing so it only runs when the page has valid inputs.
- Re-check build size after moving wallet-specific logic behind clearer boundaries.

## Developer Experience Work Items

- Add a short architecture section to the root docs explaining `pages`, `features`, `ui`, and `state`.
- Enforce one internal import strategy.
- Prefer local `index.ts` files only where they improve discoverability and not where they hide ownership.
- Keep file names aligned with their role: `use*` for hooks, `*Provider` for providers, `*Selectors` for selectors, `*Model` for view-model hooks.
- Avoid adding new generic folders like `misc` or `helpers` when a feature-specific folder would be clearer.

## Functional Safety Rules

- Do not change public exports from `src/index.ts`, `src/widget/index.tsx`, or package exports during the internal split unless explicitly planned.
- Keep current route-building, submission, and page transition behavior stable during the refactor.
- Preserve current wallet connection behavior and fallback address rules.
- Treat style or UX cleanup as secondary to behavioral safety during the first pass.
- Ignore backend balance-call optimization for this roadmap.

## Suggested Milestone Sequence

1. Add safety rails and document the behavior baseline.
2. Split state responsibilities from `DepositContext`.
3. Refactor `CryptoPay` first.
4. Refactor `Home` and `SelectToken`.
5. Break up `TrustwareWidgetV2`.
6. Normalize imports and complete bundle hygiene.
7. Run validation and compare behavior against the baseline.

## Definition of Done

- No user-facing flow has been dropped.
- The largest page and context files are materially smaller and more focused.
- Widget consumers no longer re-render on unrelated state changes.
- Folder names clearly reflect ownership and purpose.
- The widget code is organized as `pages`, `features`, `ui`, and `state` instead of growing through shared monolith files.

If you want, I can turn this into a concrete
implementation roadmap with the exact target
folder tree and a file-by-file migration
checklist.
