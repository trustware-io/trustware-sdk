# Trustware SDK

Cross-chain bridging and token swap SDK for React applications. Provides a drop-in widget and headless core API for integrating bridge transactions.

## Project Overview

- **Package**: `@trustware/sdk` (v1.0.6)
- **Language**: TypeScript 5.6 with strict typing
- **Framework**: React 18+ (optional peer dependency)
- **Build**: tsup generating ESM/CJS bundles
- **License**: MIT

## Architecture

```
src/
├── config/      # Configuration store, defaults, and merge logic
├── core/        # API layer - routes, transactions, balances, HTTP client
├── hooks/       # React hooks for SDK integration
├── types/       # TypeScript type definitions
├── utils/       # Utility functions (hex conversion, etc.)
├── wallets/     # Wallet detection, connection, and adapters
├── widget/      # Pre-built React UI components
├── provider.tsx # TrustwareProvider React context
├── registry.ts  # Chain and token metadata registry
├── constants.ts # SDK constants and versioning
└── index.ts     # Main entry point
```

## Key Patterns

- **Singleton**: `Trustware` core and `TrustwareConfigStore` for global state
- **State Machine**: Widget uses 8 states (Welcome → WalletSelection → TokenChainSelection → AmountInput → ConfirmPayment → PaymentProcessing → PaymentSuccess/Failure)
- **Adapter Pattern**: `WalletInterFaceAPI` unifies EIP-1193 and Wagmi wallet clients
- **Observer Pattern**: Config and wallet status changes via subscriptions

## Entry Points

| Export | Description |
|--------|-------------|
| `@trustware/sdk` | Main entry - all exports |
| `@trustware/sdk/core` | Headless API only |
| `@trustware/sdk/wallet` | Wallet utilities and adapters |
| `@trustware/sdk/react` | Widget component |
| `@trustware/sdk/constants` | SDK constants |

## Core API (`Trustware` singleton)

```typescript
// Initialize with config
await Trustware.init(config)

// Wallet management
Trustware.useWallet(wallet)      // Attach wallet interface
Trustware.getWallet()            // Get current wallet
Trustware.getAddress()           // Get connected address
Trustware.autoDetect()           // Auto-detect wallets

// Configuration
Trustware.getConfig()            // Get resolved config
Trustware.setDestinationAddress(addr)  // Update destination

// Route operations
Trustware.buildRoute(params)     // Build a route quote
Trustware.sendRouteTransaction() // Execute transaction
Trustware.runTopUp(params)       // Full flow: quote → send → poll

// Status
Trustware.getStatus(intentId)    // Get route status
Trustware.pollStatus(intentId)   // Poll until complete
Trustware.getBalances(address)   // Get token balances
```

## React Integration

```tsx
import { TrustwareProvider, TrustwareWidget, useTrustware } from "@trustware/sdk";

// Provider wraps app
<TrustwareProvider config={config} wallet={wallet} autoDetect={true}>
  <TrustwareWidget />
</TrustwareProvider>

// Hook for accessing context
const { status, errors, core } = useTrustware();
```

## Wallet Adapters

```typescript
import { useWagmi, useEIP1193 } from "@trustware/sdk/wallet";

// Wagmi/Viem client adapter
const wallet = useWagmi(wagmiClient);

// Raw EIP-1193 provider adapter
const wallet = useEIP1193(window.ethereum);

// Attach to Trustware
Trustware.useWallet(wallet);
```

## Configuration Shape

```typescript
const config: TrustwareConfigOptions = {
  apiKey: "...",
  routes: {
    toChain: "8453",        // Chain ID
    toToken: "0x...",       // Token address
    toAddress: "0x...",     // Destination (optional)
    defaultSlippage: 1,     // Percentage
    options: {
      fixedFromAmount: "0.05",
      minAmountOut: "0",
      maxAmountOut: "0.5",
    },
  },
  autoDetectProvider: true,
  theme: {
    primaryColor: "#FCB514",
    secondaryColor: "#FFFFFF",
    backgroundColor: "#000000",
    borderColor: "#FCB514",
    textColor: "#FFFFFF",
    radius: 16,
  },
  messages: {
    title: "Top up",
    description: "Bridge funds to your wallet.",
  },
};
```

## Development Commands

```bash
npm run dev          # Watch mode with tsup
npm run build        # Production build to dist/
npm run typecheck    # TypeScript type checking
npm run lint:strict  # Zero-warning ESLint
npm run format       # Prettier auto-fix
npm run validate     # Full validation (typecheck + lint + format)
```

## Key Files

- `src/core/index.ts` - Main Trustware singleton facade
- `src/core/routes.ts` - REST API clients for routes/quotes
- `src/core/tx.ts` - Transaction execution logic
- `src/wallets/detect.ts` - Multi-strategy wallet detection
- `src/wallets/manager.ts` - Wallet lifecycle management
- `src/widget/index.tsx` - Main widget component
- `src/config/store.ts` - Configuration singleton store
- `src/provider.tsx` - React context provider

## Supported Wallets

MetaMask, Coinbase, Rainbow, Phantom, Safe, OKX, Rabby, Brave, Trust, Bitget, KuCoin, Zerion, Taho, and more via EIP-6963/EIP-1193 detection.

## API Endpoints

The SDK communicates with the Trustware API:
- `POST /squid/route` - Build route quote
- `POST /route-intent/{id}/receipt` - Submit transaction receipt
- `GET /route-intent/{id}/status` - Get route status
- `GET /squid/chains` - Fetch supported chains
- `GET /squid/tokens` - Fetch supported tokens

## Error Handling

- User rejection detected via error code 4001
- Chain switching with automatic `wallet_addEthereumChain` fallback
- Idempotent receipt submission using txHash as key
- Configurable poll timeout (default 5 minutes)

## Notes

- Always wrap SDK components with `TrustwareProvider` at app root
- For SSR/Next.js, mark SDK components as `"use client"`
- Widget handles full flow: quoting, approvals, submission, settlement
- Core API allows building custom UIs with same underlying logic
