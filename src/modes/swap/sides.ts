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

/** What the host and the current selection allow on each side. */
export type SwapRules = {
  lockDestToken: boolean;
  allowedDestTokens: readonly SwapTokenRef[] | null;
  /**
   * The buy side is a vault deposit of its token. Selling that same token
   * into the vault is a real route, so here, and only here, both sides may
   * hold one token.
   */
  depositsIntoVault: boolean;
};

export type PickResult<T extends TokenLike> = {
  sides: SwapSides<T>;
  flipped: boolean;
};

/** Whether two sides hold the same token on the same chain. */
export function isSameToken<T extends TokenLike>(
  a: SwapSide<T>,
  b: SwapSide<T>
): boolean {
  if (!a.token || !a.chain || !b.token || !b.chain) return false;
  return (
    tokenIdentityKey(
      a.chain.chainId,
      a.token.address,
      normalizeChainType(a.chain)
    ) ===
    tokenIdentityKey(
      b.chain.chainId,
      b.token.address,
      normalizeChainType(b.chain)
    )
  );
}

/**
 * Whether this side's token may move onto the buy side: the buy token isn't
 * locked, and an allowlist, if the host set one, names the token. Moving an
 * empty side is always allowed.
 */
export function canBecomeDest<T extends TokenLike>(
  side: SwapSide<T>,
  rules: SwapRules
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
  rules: SwapRules
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
 * The buy token, when the sell picker has to hide it: picking it there would
 * neither flip the sides nor be a valid sell token. Null when it can stay.
 */
export function hiddenFromSellPicker<T extends TokenLike>(
  sides: SwapSides<T>,
  rules: SwapRules
): T | null {
  if (rules.depositsIntoVault || canFlip(sides, rules)) return null;
  return sides.to.token;
}

/**
 * A sell token the widget chose on its own, such as the wallet's largest
 * balance, or null when it would repeat the buy token outside a vault
 * deposit. Unlike a user's pick it never flips the sides: the buy token was
 * chosen deliberately and an automatic pick must not displace it.
 */
export function automaticSellToken<T extends TokenLike>(
  candidate: SwapSide<T>,
  to: SwapSide<T>,
  rules: SwapRules
): T | null {
  if (!rules.depositsIntoVault && isSameToken(candidate, to)) return null;
  return candidate.token;
}

/**
 * The sides after the user picks a token for one of them. Picking the token
 * the other side holds trades the sides, as the flip button does, instead of
 * swapping a token into itself. Selling a vault's own asset into it is the
 * exception: that just sets the sell token.
 *
 * The sell picker hides the buy token whenever neither applies, and the buy
 * picker only offers tokens allowed on the buy side, so a pick that breaks
 * the rules here is a bug in the picker.
 */
export function pickToken<T extends TokenLike>(
  sides: SwapSides<T>,
  side: "from" | "to",
  picked: PickedToken<T>,
  rules: SwapRules
): PickResult<T> {
  if (side === "from") {
    if (!isSameToken(sides.to, picked) || rules.depositsIntoVault) {
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

  if (!isSameToken(sides.from, picked)) {
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
