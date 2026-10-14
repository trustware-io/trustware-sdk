import type { ChainDef } from "src/types";
import type { SwapTokenRef } from "src/types/config";
import { normalizeChainType, tokenIdentityKey } from "src/utils/chains";
import { isAllowedToken } from "./tokenFilters";

type TokenLike = { address: string; chainId: string | number };

/** One side of the swap: a token and the chain it was picked on. */
export type SwapSide<T extends TokenLike> = {
  token: T | null;
  chain: ChainDef | null;
};

export type SwapSides<T extends TokenLike> = {
  from: SwapSide<T>;
  to: SwapSide<T>;
};

/** A picked token always arrives with the chain it was picked on. */
export type PickedToken<T extends TokenLike> = { token: T; chain: ChainDef };

/** What the host lets onto the buy side. */
export type DestRules = {
  lockDestToken: boolean;
  allowedDestTokens: readonly SwapTokenRef[] | null;
};

export type PickResult<T extends TokenLike> = {
  sides: SwapSides<T>;
  flipped: boolean;
};

function identityOf<T extends TokenLike>(side: PickedToken<T>): string {
  return tokenIdentityKey(
    side.chain.chainId,
    side.token.address,
    normalizeChainType(side.chain)
  );
}

function holds<T extends TokenLike>(
  side: SwapSide<T>,
  picked: PickedToken<T>
): boolean {
  if (!side.token || !side.chain) return false;
  return (
    identityOf({ token: side.token, chain: side.chain }) === identityOf(picked)
  );
}

/**
 * Whether this side's token may move onto the buy side: the buy token isn't
 * locked, and an allowlist, if the host set one, names the token. Moving an
 * empty side is always allowed.
 */
export function canBecomeDest<T extends TokenLike>(
  side: SwapSide<T>,
  rules: DestRules
): boolean {
  if (rules.lockDestToken) return false;
  if (!side.token) return true;
  return isAllowedToken(
    side.token,
    rules.allowedDestTokens,
    normalizeChainType(side.chain)
  );
}

/** Whether the sides may trade places, which moves the sell token to buy. */
export function canFlip<T extends TokenLike>(
  sides: SwapSides<T>,
  rules: DestRules
): boolean {
  return canBecomeDest(sides.from, rules);
}

/**
 * The sides traded: the buy token becomes the sell token and the reverse.
 * With nothing on the buy side the sell side keeps its chain, so its picker
 * still opens there.
 */
export function flipSides<T extends TokenLike>(
  sides: SwapSides<T>
): SwapSides<T> {
  return {
    from: { token: sides.to.token, chain: sides.to.chain ?? sides.from.chain },
    to: sides.from,
  };
}

/**
 * The sides after the user picks a token for one of them. Picking the token
 * the other side holds trades the sides, as the flip button does, instead of
 * swapping a token into itself.
 *
 * The sell picker only offers the buy token when the flip is allowed, and the
 * buy picker only offers tokens allowed on the buy side, so a flip that
 * breaks the rules here is a bug in the picker.
 */
export function pickToken<T extends TokenLike>(
  sides: SwapSides<T>,
  side: "from" | "to",
  picked: PickedToken<T>,
  rules: DestRules
): PickResult<T> {
  if (side === "from") {
    if (!holds(sides.to, picked)) {
      return { sides: { ...sides, from: picked }, flipped: false };
    }
    if (!canFlip(sides, rules)) {
      throw new Error(
        `Picked the buy token ${picked.token.address} on chain ` +
          `${picked.chain.chainId} as the sell token, but the sides can't ` +
          `flip; the sell picker should have hidden it`
      );
    }
    return { sides: { from: picked, to: sides.from }, flipped: true };
  }

  if (!holds(sides.from, picked)) {
    return { sides: { ...sides, to: picked }, flipped: false };
  }
  if (!canBecomeDest(picked, rules)) {
    throw new Error(
      `Picked ${picked.token.address} on chain ${picked.chain.chainId} as ` +
        `the buy token, but it isn't allowed there; the buy picker should ` +
        `not have offered it`
    );
  }
  return {
    sides: { from: flipSides(sides).from, to: picked },
    flipped: true,
  };
}
