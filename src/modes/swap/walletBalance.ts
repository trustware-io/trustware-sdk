import type { ChainDef } from "src/types";
import { normalizeAddress } from "src/widget/helpers/chainHelpers";
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
 *
 * Addresses are compared through `normalizeAddress`, not lowercased: case is
 * meaningless in a hex EVM address but *significant* in a Base58 SPL mint, so
 * folding case there compares two addresses that are not the same string. It
 * also maps the Solana native aliases onto one another, which a plain
 * comparison would miss.
 */
export function findWalletBalanceRow(
  rows: YourTokenData[] | undefined,
  token: { address?: string } | null | undefined,
  chainId?: string | number | null,
  chainType?: ChainDef["type"]
): YourTokenData | undefined {
  const rawAddress = token?.address;
  if (!rawAddress || !rows?.length) return undefined;
  const wantAddress = normalizeAddress(rawAddress, chainType);
  if (!wantAddress) return undefined;

  // A chain is only a constraint when we know it — an address alone can
  // collide across chains (the same ERC20 address is routinely deployed to
  // several), so prefer a chain-qualified match.
  const wantChain = chainId == null ? "" : String(chainId).trim().toLowerCase();

  return rows.find((row) => {
    if (!row?.address) return false;
    if (normalizeAddress(row.address, chainType) !== wantAddress) return false;
    if (!wantChain) return true;
    return (
      String(row.chainId ?? "")
        .trim()
        .toLowerCase() === wantChain
    );
  });
}
