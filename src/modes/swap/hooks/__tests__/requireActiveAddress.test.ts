import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { requireActiveAddress } from "src/modes/swap/hooks/useSwapExecution";

const PLANNED = "0x881f3fd0efbe77b2550210f320bf69a38921e726";
const OTHER = "0x1111111111111111111111111111111111111111";

function walletReporting(address: string) {
  return { getAddress: async () => address };
}

describe("requireActiveAddress", () => {
  // Every transaction the flow sends (approve, and the route's own tx inside
  // sendRouteTransaction) is signed by whatever account the wallet is on right
  // now, while the allowance checks use the address the route was planned for.
  // The live account is therefore the one an allowance must be read against.
  it("returns the wallet's current account", async () => {
    const active = await requireActiveAddress(
      walletReporting(PLANNED),
      PLANNED
    );
    assert.equal(active, PLANNED);
  });

  // Wallets hand back EIP-55 checksummed addresses; the planned address may
  // have been lowercased on its way through config or the route request.
  // Treating that as a different account would abort every swap.
  it("treats a checksum-case difference as the same account", async () => {
    const checksummed = "0x881F3fd0EFbE77b2550210f320bF69a38921E726";
    const active = await requireActiveAddress(
      walletReporting(checksummed),
      PLANNED
    );
    assert.equal(active, checksummed);
  });

  // The switch this guards against: the user changes accounts in their wallet
  // mid-flow. The route, its intent and any allowance already granted all
  // belong to the old account, so continuing would send the route's
  // transaction from an account that never approved it.
  it("throws when the wallet has switched accounts", async () => {
    await assert.rejects(
      () => requireActiveAddress(walletReporting(OTHER), PLANNED),
      /account changed/i
    );
  });

  it("throws when no wallet is attached", async () => {
    await assert.rejects(() => requireActiveAddress(null, PLANNED), /wallet/i);
  });
});
