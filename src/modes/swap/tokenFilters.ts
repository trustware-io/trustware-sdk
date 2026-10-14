import type { ChainType } from "src/types";
import { tokenIdentityKey } from "src/utils/chains";

type TokenRef = { chainId: string | number; address: string };

// `chainType` in both filters is the picker's chain. Every token it lists is
// on that chain, and a token from any other chain can't match one of them
// because the chain is part of the identity key.

/**
 * Drops the token the other side of the swap already holds, so a token can't
 * be swapped into itself. Matching by identity hides native SOL whichever
 * spelling either side carries.
 */
export function withoutToken<T extends TokenRef>(
  tokens: T[],
  excluded: TokenRef | null,
  chainType: ChainType | undefined
): T[] {
  if (!excluded) return tokens;
  const excludedKey = tokenIdentityKey(
    excluded.chainId,
    excluded.address,
    chainType
  );
  return tokens.filter(
    (token) =>
      tokenIdentityKey(token.chainId, token.address, chainType) !== excludedKey
  );
}

/** Keeps the tokens a host's allowlist names, or all of them without one. */
export function onlyAllowedTokens<T extends TokenRef>(
  tokens: T[],
  allowed: readonly TokenRef[] | null | undefined,
  chainType: ChainType | undefined
): T[] {
  return tokens.filter((token) => isAllowedToken(token, allowed, chainType));
}

/** Whether a host's allowlist names this token; every token is allowed
 *  without one. */
export function isAllowedToken(
  token: TokenRef,
  allowed: readonly TokenRef[] | null | undefined,
  chainType: ChainType | undefined
): boolean {
  if (!allowed || allowed.length === 0) return true;
  const key = tokenIdentityKey(token.chainId, token.address, chainType);
  return allowed.some(
    (entry) => tokenIdentityKey(entry.chainId, entry.address, chainType) === key
  );
}
