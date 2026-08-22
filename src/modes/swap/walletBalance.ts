import type { YourTokenData } from "src/widget/state/deposit/types";

/**
 * The wallet balance for a token, found by chain + address.
 *
 * The token picker has two sections. "Your tokens" hands back a
 * `YourTokenData` carrying `balance`; the catalog list below it hands back a
 * plain `Token` that does not. Reading `balance` off whichever object was
 * selected therefore showed 0 for a token picked from the catalog — even when
 * the row directly above it displayed the real amount. Matching against the
 * wallet rows makes both sources resolve identically.
 */
export function findWalletBalanceRow(
  rows: YourTokenData[] | undefined,
  token: { address?: string } | null | undefined,
  chainId?: string | number | null
): YourTokenData | undefined {
  const wantAddress = token?.address?.toLowerCase();
  if (!wantAddress || !rows?.length) return undefined;

  // A chain is only a constraint when we know it — an address alone can
  // collide across chains (the same ERC20 address is routinely deployed to
  // several), so prefer a chain-qualified match.
  const wantChain = chainId == null ? "" : String(chainId).trim().toLowerCase();

  return rows.find((row) => {
    if (row?.address?.toLowerCase() !== wantAddress) return false;
    if (!wantChain) return true;
    return (
      String(row.chainId ?? "")
        .trim()
        .toLowerCase() === wantChain
    );
  });
}
