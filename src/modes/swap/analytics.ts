/**
 * GA4 payment-event payloads for swap mode.
 *
 * Deposit mode reads its destination from `config.routes`, which swap mode does
 * not have: for `mode: "swap"` the `routes` block is optional and the
 * destination is picked by the user at runtime. So these params are built from
 * swap's own `toChain` / `toToken` state and never from configuration.
 *
 * Kept as plain functions rather than a hook so the payload shape and the
 * once-per-attempt guard are directly unit-testable.
 */

/** Minimal shape of the chain objects SwapMode holds (`ChainDef`). */
export interface ChainLabelSource {
  networkName?: string;
  axelarChainName?: string;
  chainId?: string | number;
}

/** Minimal shape of the token objects SwapMode holds (`Token | YourTokenData`). */
export interface TokenLabelSource {
  symbol?: string;
}

/**
 * Param keys are fixed by the BI queries in `iluvatar/db/g4a_repo.go`.
 *
 * A type alias, not an interface: `trackEvent` takes `Record<string, unknown>`,
 * and only aliases carry the implicit index signature that satisfies it.
 */
export type SwapPaymentParams = {
  from_chain: string | number;
  from_token: string;
  to_chain: string | number;
  to_token: string;
  domain: string;
};

export interface SwapPaymentContext {
  fromChain: ChainLabelSource | null | undefined;
  fromToken: TokenLabelSource | null | undefined;
  toChain: ChainLabelSource | null | undefined;
  toToken: TokenLabelSource | null | undefined;
  /** `window.origin` at the call site — passed in so this module stays DOM-free. */
  domain: string;
}

const UNKNOWN = "unknown";

/**
 * Same precedence deposit mode uses for `from_chain`: the human-readable
 * network name first, the Axelar name next, the raw chain ID last. Applied to
 * both ends of a swap so the two sides of one event are comparable.
 */
function chainLabel(
  chain: ChainLabelSource | null | undefined
): string | number {
  return (
    chain?.networkName ?? chain?.axelarChainName ?? chain?.chainId ?? UNKNOWN
  );
}

function tokenLabel(token: TokenLabelSource | null | undefined): string {
  return token?.symbol ?? UNKNOWN;
}

/**
 * Build the `payment_initiated` / `payment_completed` params for a swap.
 *
 * Both events carry the identical payload, matching deposit mode's key set:
 * `from_chain`, `from_token`, `to_chain`, `to_token`, `domain`.
 */
export function buildSwapPaymentParams(
  ctx: SwapPaymentContext
): SwapPaymentParams {
  return {
    from_chain: chainLabel(ctx.fromChain),
    from_token: tokenLabel(ctx.fromToken),
    to_chain: chainLabel(ctx.toChain),
    to_token: tokenLabel(ctx.toToken),
    domain: ctx.domain,
  };
}

/**
 * Claim one swap attempt for one event slot, returning true only the first time.
 *
 * `slot` is a React ref (or anything with a mutable `current`) holding the
 * attempt already reported for that event. `attempt` is the route object the
 * swap is running against, compared by identity.
 *
 * The route object is the key rather than its `intentId` because
 * `buildRoute` falls back to `intentId: ""` when the backend omits one
 * (`src/core/routes.ts`). Keying on the id would then read every attempt as
 * unclaimable and drop `payment_initiated` — silently, and precisely on the
 * broken swaps whose absence from the funnel would inflate the
 * payment-completed conversion rate that `g4a_repo.go` computes.
 *
 * Identity is the right key on its own terms too: `useSwapRoute` hands back a
 * fresh object per build and the error screen's only exit clears the route, so
 * a genuine retry is always a new object and reports again, while a double-tap
 * on Swap re-presents the same one and is dropped.
 */
export function claimAttemptOnce(
  slot: { current: object | null },
  attempt: object | null | undefined
): boolean {
  if (!attempt) return false;
  if (slot.current === attempt) return false;
  slot.current = attempt;
  return true;
}
