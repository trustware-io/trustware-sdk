# PRD: New SDK Design Integration

## Introduction

Replace the current Trustware SDK widget with the modern UI design from `ui-ideas/newsdk-main`. This integration brings shadcn-ui components, Tailwind CSS styling, and enhanced UX interactions (swipe-to-confirm, token carousel, animated progress) to the production SDK while maintaining the existing backend API integration, wallet management, and embeddable widget architecture.

The new design will be an embedded widget (not standalone), replacing the current widget entirely.

## Goals

- Replace the existing widget with the modern UI design
- Maintain full backend API integration (route building, transaction submission, status polling)
- Keep the widget embeddable in host applications
- Port all UI features: SwipeToConfirm, TokenSwipePill, AmountSlider, animated progress, confetti effects
- Stub fiat payment UI for future backend implementation
- Support dark/light mode toggle with minimal theming customization

## User Stories

### Phase 1: Build Infrastructure

#### US-001: Set up Tailwind CSS and shadcn-ui in SDK
**Description:** As a developer, I need the build system configured for Tailwind CSS and shadcn-ui so that I can use modern styling in the widget.

**Acceptance Criteria:**
- [ ] Add Tailwind CSS 3.x to SDK dependencies
- [ ] Configure Tailwind with SDK-specific prefix to avoid host app conflicts
- [ ] Add shadcn-ui component dependencies (Radix UI primitives, class-variance-authority, clsx, tailwind-merge)
- [ ] Configure build to output CSS bundle alongside JS
- [ ] Existing SDK exports continue to work (no breaking changes during migration)
- [ ] Typecheck/lint passes

#### US-002: Create new widget container component
**Description:** As a developer, I need a responsive container component that wraps the new widget and handles embedding concerns.

**Acceptance Criteria:**
- [ ] Create `WidgetContainer` component with fixed max-width suitable for embedding
- [ ] Support dark/light mode via prop or system preference detection
- [ ] Container is scrollable when content exceeds viewport
- [ ] Container has proper z-index management for modals/overlays
- [ ] Works in iframe and direct DOM embedding scenarios
- [ ] Typecheck/lint passes

---

### Phase 2: State Management Integration

#### US-003: Create unified DepositContext connected to Trustware core
**Description:** As a developer, I need the DepositContext to use real API data instead of mocks so that transactions actually work.

**Acceptance Criteria:**
- [ ] Create `DepositContext` provider that wraps Trustware core
- [ ] Expose wallet state from `walletManager` (selected wallet, address, connection status)
- [ ] Expose token/chain data fetched from API (not hardcoded)
- [ ] Expose transaction lifecycle state (idle, confirming, processing, bridging, success, error)
- [ ] Expose `buildRoute()` result (fees, estimated receive amount, route details)
- [ ] Provide `resetState()` function to restart flow
- [ ] Typecheck/lint passes

#### US-004: Implement real fee calculation via route building
**Description:** As a user, I want to see accurate fees and estimated receive amounts based on actual route quotes.

**Acceptance Criteria:**
- [ ] Call `Trustware.buildRoute()` when user confirms amount and token selection
- [ ] Display network fees from route response (not mock 1% calculation)
- [ ] Display estimated receive amount from route response
- [ ] Handle route building errors gracefully with user-friendly messages
- [ ] Show loading state while route is being calculated
- [ ] Typecheck/lint passes

---

### Phase 3: Wallet Integration

#### US-005: Integrate wallet detection and connection
**Description:** As a user, I want to connect my wallet so I can make deposits.

**Acceptance Criteria:**
- [ ] Use `Trustware.autoDetect()` to find available wallets
- [ ] Display detected wallets in wallet selection UI
- [ ] Handle wallet connection via `walletManager.connect()`
- [ ] Subscribe to wallet changes via `walletManager.onChange()`
- [ ] Display connected wallet address in UI
- [ ] Handle wallet disconnection gracefully
- [ ] Support both EIP-1193 and Wagmi wallet providers
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### Phase 4: Core UI Components

#### US-006: Port Home page with amount input and payment method selection
**Description:** As a user, I want to enter my deposit amount and choose a payment method on the home screen.

**Acceptance Criteria:**
- [ ] Port `Home` component with amount input field
- [ ] Amount input supports numeric entry with decimal handling
- [ ] Display payment method options (crypto highlighted, fiat methods shown but marked as "coming soon")
- [ ] "Continue" button navigates to appropriate next step based on selection
- [ ] Responsive layout works in widget container
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-007: Port token/chain selector with two-column layout
**Description:** As a user, I want to select which token and chain to deposit from using an intuitive selector.

**Acceptance Criteria:**
- [ ] Port `SelectToken` component with two-column layout (chains left, tokens right)
- [ ] Fetch available chains and tokens from API (replace mock data)
- [ ] Support search/filter for chains and tokens
- [ ] Show token balances if wallet is connected
- [ ] Popular chains section at top for quick access
- [ ] Selection updates DepositContext state
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-008: Port SwipeToConfirmTokens component
**Description:** As a user, I want to swipe to confirm my transaction for a secure, intentional confirmation experience.

**Acceptance Criteria:**
- [ ] Port `SwipeToConfirmTokens` component with drag interaction
- [ ] Show progress feedback during swipe
- [ ] Trigger confirmation callback when swipe completes (threshold reached)
- [ ] Reset position if swipe is cancelled
- [ ] Haptic feedback on mobile devices (if supported)
- [ ] Accessible alternative for users who cannot swipe (long-press or button fallback)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-009: Port TokenSwipePill carousel component
**Description:** As a user, I want to quickly switch between tokens using a horizontal carousel.

**Acceptance Criteria:**
- [ ] Port `TokenSwipePill` component with horizontal scroll
- [ ] Display token icons and symbols
- [ ] Highlight currently selected token
- [ ] Tapping a token updates selection in context
- [ ] Smooth scroll animation between tokens
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-010: Port AmountSlider component
**Description:** As a user, I want to quickly adjust my deposit amount using a slider.

**Acceptance Criteria:**
- [ ] Port `AmountSlider` component with range input
- [ ] Slider range based on min/max deposit limits (from config or API)
- [ ] Display current value above slider
- [ ] Sync with amount input field (bidirectional)
- [ ] Smooth drag interaction
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-011: Port CryptoPay confirmation page
**Description:** As a user, I want to review my transaction details and confirm the deposit.

**Acceptance Criteria:**
- [ ] Port `CryptoPay` component showing transaction summary
- [ ] Display: amount, token, chain, fees, estimated receive amount
- [ ] Include SwipeToConfirmTokens for final confirmation
- [ ] Include TokenSwipePill for last-minute token changes
- [ ] "Back" button returns to previous step
- [ ] On confirm, initiate transaction via Trustware core
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### Phase 5: Transaction Flow

#### US-012: Implement transaction submission and monitoring
**Description:** As a user, I want my transaction to be submitted and monitored after I confirm.

**Acceptance Criteria:**
- [ ] Call `Trustware.runTopUp()` or equivalent after swipe confirmation
- [ ] Submit transaction to connected wallet for signing
- [ ] Call `submitReceipt()` with transaction hash after wallet confirms
- [ ] Poll transaction status via `pollStatus()` until terminal state
- [ ] Update context state throughout lifecycle (processing → bridging → success/error)
- [ ] Handle user rejection (wallet declined) gracefully
- [ ] Typecheck/lint passes

#### US-013: Port Processing page with animated progress
**Description:** As a user, I want to see real-time progress of my transaction with clear status updates.

**Acceptance Criteria:**
- [ ] Port `Processing` component with CircularProgress animation
- [ ] Display current transaction step (confirming, processing, bridging)
- [ ] Show transaction hash with link to block explorer
- [ ] Progress animation reflects actual status (not just time-based)
- [ ] TransactionSteps component shows completed/pending steps
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-014: Port success state with confetti effect
**Description:** As a user, I want to see a celebratory success screen when my deposit completes.

**Acceptance Criteria:**
- [ ] Port `ConfettiEffect` component for success celebration
- [ ] Display success message with final amounts
- [ ] Show transaction hash with block explorer link
- [ ] "Done" button closes widget or returns to home
- [ ] Option to start a new deposit
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-015: Implement error handling and failure states
**Description:** As a user, I want clear error messages and recovery options when something goes wrong.

**Acceptance Criteria:**
- [ ] Display user-friendly error messages (not raw API errors)
- [ ] Show "Try Again" button that resets to appropriate step
- [ ] Handle specific error cases: wallet rejected, insufficient balance, route failed, network error
- [ ] Log errors for debugging (via SDK error callback)
- [ ] Timeout handling for stuck transactions (5 min default)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### Phase 6: Fiat Payment Stub

#### US-016: Create fiat payment UI stub
**Description:** As a user, I want to see fiat payment options so I know they're coming, even if not yet functional.

**Acceptance Criteria:**
- [ ] Port `FiatPayment` component structure
- [ ] Display payment method icons (Apple Pay, M-Pesa, Venmo, etc.)
- [ ] Show "Coming Soon" badge on fiat methods
- [ ] Selecting a fiat method shows informational message about future availability
- [ ] No backend calls for fiat - purely UI placeholder
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### Phase 7: Navigation and Flow

#### US-017: Implement internal navigation without React Router
**Description:** As a developer, I need the widget to handle navigation internally without requiring React Router in the host app.

**Acceptance Criteria:**
- [ ] Create internal navigation state (no URL routing)
- [ ] Support navigating between: home → select-token → crypto-pay → processing → success/error
- [ ] Support back navigation at each step
- [ ] Animated transitions between steps (optional, can be disabled)
- [ ] Navigation state resets when widget is closed/reopened
- [ ] Typecheck/lint passes

#### US-018: Implement widget open/close API
**Description:** As a host app developer, I want to programmatically open and close the widget.

**Acceptance Criteria:**
- [ ] Export `open()` and `close()` methods on widget ref
- [ ] Support `onClose` callback prop
- [ ] Closing mid-transaction shows confirmation dialog
- [ ] Widget state persists if closed and reopened during same session
- [ ] Typecheck/lint passes

---

### Phase 8: Final Integration

#### US-019: Replace old widget exports with new implementation
**Description:** As an SDK consumer, I want to use the new widget via the same import path.

**Acceptance Criteria:**
- [ ] New widget exported as `TrustwareWidget` (same name as old)
- [ ] Props API compatible where possible (breaking changes documented)
- [ ] Remove old widget code from codebase
- [ ] Update SDK documentation with new usage examples
- [ ] Typecheck/lint passes

#### US-020: Add dark/light mode support
**Description:** As a user, I want the widget to support dark and light modes.

**Acceptance Criteria:**
- [ ] Widget accepts `theme` prop: 'light' | 'dark' | 'system'
- [ ] 'system' respects user's OS preference
- [ ] Theme toggle button visible in widget header (optional, configurable)
- [ ] All components properly styled for both themes
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

#### US-021: Bundle size optimization
**Description:** As a host app developer, I want the widget bundle to be reasonably sized.

**Acceptance Criteria:**
- [ ] Audit bundle size after integration
- [ ] Tree-shake unused shadcn-ui components
- [ ] Lazy load confetti effect (only loaded on success)
- [ ] Target bundle size under 150KB gzipped (excluding React peer dep)
- [ ] Document bundle size in README
- [ ] Typecheck/lint passes

---

## Functional Requirements

- FR-1: Widget must be embeddable in host applications without React Router dependency
- FR-2: Widget must connect to Trustware backend API for route building and transaction submission
- FR-3: Widget must support EIP-1193 and Wagmi wallet providers
- FR-4: Widget must display real fees and estimates from API (not mocked)
- FR-5: Widget must handle full transaction lifecycle with status polling
- FR-6: Widget must support dark and light color modes
- FR-7: Widget must use Tailwind CSS with prefixed classes to avoid host app conflicts
- FR-8: Fiat payment UI must be present but non-functional (stubbed)
- FR-9: Widget must handle errors gracefully with user-friendly messages
- FR-10: Widget must provide swipe-to-confirm interaction for transaction confirmation

## Non-Goals

- No fiat payment backend integration (UI only, stubbed)
- No custom theme colors beyond dark/light mode
- No standalone application mode (embedded widget only)
- No backward compatibility with old widget API (full replacement)
- No multi-language/i18n support in this phase
- No analytics or tracking integration

## Technical Considerations

- **Rendering Mode:** Inline only - widget embeds directly in host app DOM (no modal mode)
- **CSS Isolation:** Use Tailwind prefix (e.g., `tw-`) to prevent style conflicts with host apps
- **Typography:** System fonts only - no custom fonts bundled
- **Block Explorers:** Transaction links use URLs provided by backend API (per-chain configuration handled server-side)
- **Bundle Strategy:** CSS must be bundled with JS or exported separately for host app inclusion
- **Wallet Compatibility:** Must work with existing `walletManager` from core SDK
- **State Persistence:** Consider using sessionStorage for state persistence across widget open/close
- **Animation Performance:** Use CSS transforms for animations to ensure 60fps on mobile

## Success Metrics

- Widget renders correctly in dark and light modes
- Full transaction flow completes successfully (wallet → confirmation → success)
- Swipe-to-confirm interaction works on both desktop and mobile
- Bundle size under 150KB gzipped
- All existing SDK functionality (route building, status polling) works with new UI

## Open Questions

None - all questions resolved.
