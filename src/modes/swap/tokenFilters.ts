import type { ChainType } from "src/types";
import { tokenIdentityKey, type TokenRef } from "src/utils/chains";

// `chainType` in both filters is the picker's chain. Every token it lists is
// on that chain, and a token from any other chain can't match one of them
// because the chain is part of the identity key.

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
