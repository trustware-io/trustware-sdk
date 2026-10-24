import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { describeRouteChange } from "src/widget/lib/routeChange";

describe("describeRouteChange", () => {
  it("names the slippage the rebuilt output fell outside", () => {
    assert.equal(
      describeRouteChange({
        kind: "output_below_accepted_slippage",
        reviewedToAmount: 990000n,
        floorToAmount: 985050n,
        rebuiltToAmount: 985049n,
        slippageBps: 50,
      }),
      "The quote changed after you confirmed: you'd now receive less than your 0.5% slippage allows. Nothing was sent. Check the new amounts and confirm again."
    );
  });

  it("says the rebuilt route spends more", () => {
    assert.equal(
      describeRouteChange({
        kind: "input_increased",
        reviewedFromAmount: 100n,
        rebuiltFromAmount: 101n,
      }),
      "The quote changed after you confirmed: it now spends more than the amount you reviewed. Nothing was sent. Check the new amounts and confirm again."
    );
  });
});
