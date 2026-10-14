import { normalizeChainKey } from "../../../utils/chains";
import { rawToDecimal } from "../../helpers/tokenAmount";
import type { YourTokenData } from "./types";

/** A wallet token's value in USD, or null when it has no price. */
export function walletTokenUsdValue(token: YourTokenData): number | null {
  const price = token.usdPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  const value = Number(rawToDecimal(token.balance, token.decimals)) * price;
  return Number.isFinite(value) ? value : null;
}

/**
 * Wallet tokens in display order: priced holdings by USD value, largest
 * first, then unpriced ones by amount. Raw balances aren't comparable across
 * tokens with different decimals, so ordering by them put a spam token with a
 * huge base-unit count above real holdings in a large wallet, and made it the
 * widget's automatic sell pick.
 */
export function sortWalletTokensByValue(
  tokens: readonly YourTokenData[]
): YourTokenData[] {
  return tokens
    .map((token) => ({
      token,
      value: walletTokenUsdValue(token),
      amount: Number(rawToDecimal(token.balance, token.decimals)),
    }))
    .sort((a, b) => {
      if (a.value !== null && b.value !== null && a.value !== b.value) {
        return b.value - a.value;
      }
      if (a.value !== null && b.value === null) return -1;
      if (a.value === null && b.value !== null) return 1;
      if (a.amount !== b.amount) return b.amount - a.amount;
      return identityOrder(a.token, b.token);
    })
    .map(({ token }) => token);
}

function identityOrder(a: YourTokenData, b: YourTokenData): number {
  const left = `${normalizeChainKey(a.chainId)}:${a.address}`;
  const right = `${normalizeChainKey(b.chainId)}:${b.address}`;
  return left < right ? -1 : left > right ? 1 : 0;
}
