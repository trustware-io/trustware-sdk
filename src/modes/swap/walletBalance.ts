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
/** Hex addresses are case-insensitive; everything else (Base58 SPL mints, BTC)
 *  is not. */
const HEX_ADDRESS = /^0x[0-9a-f]+$/i;

/**
 * `normalizeAddress` decides by chain type, which is the right call when the
 * caller knows it — it also folds the Solana native aliases together. But it
 * lowercases whenever the type is absent, which would silently reintroduce the
 * Base58 bug for a caller that couldn't supply one. The address format is
 * self-describing, so fall back to that rather than to case-folding.
 */
function compareKey(address: string, chainType?: ChainDef["type"]): string {
  if (chainType) return normalizeAddress(address, chainType);
  return HEX_ADDRESS.test(address.trim())
    ? address.toLowerCase()
    : address.trim();
}

export function findWalletBalanceRow(
  rows: YourTokenData[] | undefined,
  token: { address?: string; chainId?: string | number } | null | undefined,
  chainId?: string | number | null,
  chainType?: ChainDef["type"]
): YourTokenData | undefined {
  const rawAddress = token?.address;
  if (!rawAddress || !rows?.length) return undefined;
  const wantAddress = compareKey(rawAddress, chainType);
  if (!wantAddress) return undefined;

  // The chain is a required constraint, never an optional one. An address
  // alone collides across chains — the same ERC20 address is routinely
  // deployed to several, and a wallet full of airdropped spam multiplies the
  // chances — so matching without one attributes some other chain's row, and
  // its balance, to the selected token. On the Sell panel that is visible as a
  // nonsense quantity under the right symbol.
  //
  // The selected chain is not always known: the panel can hold a token before
  // a chain is picked. The token itself carries `chainId` in that case, and it
  // is the token's own chain that decides which row is its balance. Fall back
  // to it, and if neither is available, report no balance rather than the
  // wrong one.
  const wantChain = normalizeChain(chainId ?? token?.chainId);
  if (!wantChain) return undefined;

  return rows.find((row) => {
    if (!row?.address) return false;
    if (compareKey(row.address, chainType) !== wantAddress) return false;
    return normalizeChain(row.chainId) === wantChain;
  });
}

function normalizeChain(chainId: string | number | null | undefined): string {
  return chainId == null ? "" : String(chainId).trim().toLowerCase();
}
