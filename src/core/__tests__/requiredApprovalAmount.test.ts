import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { approvalSatisfied, requiredApprovalAmount } from "src/core/tx";

const MAX_UINT256 = (1n << 256n) - 1n;
const TRADE = 500305n;

describe("requiredApprovalAmount", () => {
  // Khalani plans an unlimited approve even though the route only pulls the
  // trade amount. Requesting it verbatim asks the user for an unlimited
  // allowance they never opted into.
  it("sizes an unlimited plan amount down to the route amount", () => {
    assert.equal(requiredApprovalAmount(MAX_UINT256, TRADE), TRADE);
  });

  it("treats any absurd sentinel above 2^255 as unlimited", () => {
    assert.equal(requiredApprovalAmount(1n << 255n, TRADE), TRADE);
  });

  // A provider that names a real amount is authoritative — it may need more
  // than the trade amount (fees pulled in the same transfer).
  it("honours a plan amount that names a real value", () => {
    assert.equal(requiredApprovalAmount(600000n, TRADE), 600000n);
  });

  it("honours a real plan amount smaller than the route amount", () => {
    assert.equal(requiredApprovalAmount(1000n, TRADE), 1000n);
  });

  // Without a route amount there is nothing to size down to; the plan is all
  // the information available.
  it("falls back to the plan amount when the route amount is unknown", () => {
    assert.equal(requiredApprovalAmount(MAX_UINT256, undefined), MAX_UINT256);
    assert.equal(requiredApprovalAmount(MAX_UINT256, 0n), MAX_UINT256);
  });
});

describe("approvalSatisfied", () => {
  // A required amount of 0 is a reset instruction, not "nothing needed".
  // USDT-style tokens refuse to move a non-zero allowance straight to
  // another non-zero value, so the reset must actually be sent.
  it("treats a zero requirement as satisfied only at zero allowance", () => {
    assert.equal(approvalSatisfied(0n, 0n), true);
    assert.equal(approvalSatisfied(500305n, 0n), false);
  });

  it("uses a normal sufficiency test for real amounts", () => {
    assert.equal(approvalSatisfied(600337n, 600337n), true);
    assert.equal(approvalSatisfied(600338n, 600337n), true);
    assert.equal(approvalSatisfied(500305n, 600337n), false);
    assert.equal(approvalSatisfied(0n, 600337n), false);
  });
});
