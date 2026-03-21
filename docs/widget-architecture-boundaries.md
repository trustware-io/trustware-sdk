# Widget Architecture Boundaries

This note defines how the widget code should be organized during the refactor.

## Current Status

As of 2026-03-21, the widget is mostly aligned to the intended structure:

- `pages/` are now mostly thin composition files.
- `features/amount`, `features/wallet`, `features/token-selection`, and `features/transaction` own most extracted view-model hooks and feature UI.
- `app/` owns router, persistence, overlays, and step metadata.
- `state/deposit` owns the split deposit state modules behind the compatibility context layer.

The remaining shared `components/` imports are now mostly true shell UI or reusable primitives such as `Dialog`, `WidgetPageHeader`, `WidgetSecurityFooter`, `TransactionHashLink`, and progress/display primitives.

Feature-owned components that still physically live under `src/widget/components` are currently consumed through feature-local compatibility exports first. That keeps public behavior stable while preserving clearer internal ownership.

## Ownership Rules

- `pages/` are route-level composition files.
- `features/` own domain logic, view-model hooks, and feature-local helpers.
- `ui/` contains presentational components and layout primitives only.
- `state/` owns providers, reducers, actions, and selectors.
- `styles/` owns design tokens, theme, and shared styling helpers.
- `lib/` is reserved for low-level shared widget utilities.

## Do Not Do

- Do not place network or SDK orchestration directly in page components if it can live in a feature hook.
- Do not expand a provider to hold unrelated UI, navigation, wallet, and transaction concerns unless there is a clear reason.
- Do not use ambiguous folders like `misc` or broad `helpers` folders when the code belongs to a specific feature.
- Do not mix public package API concerns with widget-internal implementation files.

## Import Direction

- `pages/` may import from `features/`, `ui/`, `state/`, `styles/`, and `lib/`.
- `features/` may import from `state/`, `ui/`, `styles/`, and `lib/`.
- `ui/` should not directly import SDK orchestration code.
- `state/` should avoid importing route-level pages or feature UI.
- Prefer feature-local exports over the generic `components/` barrel when a component is clearly owned by a feature domain.
- Avoid `src/...` alias imports from widget internals when a local relative boundary is available.

## Naming Rules

- React hooks use `use*`.
- Providers use `*Provider`.
- Selector modules use `*Selectors`.
- Pure mapping or formatting utilities use descriptive nouns such as `routeErrorMapping` or `amountFormatting`.
