import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { RequestGeneration } from "src/widget/lib/requestGeneration";

// Swap mode's useSwapRoute stamps every quote fetch with this, and
// confirming (discardPendingFetch), clearing or adopting a rebuilt route
// invalidates. These are the orders a countdown refresh and a confirm can
// interleave in.
describe("RequestGeneration", () => {
  it("lets the latest request land", () => {
    const generation = new RequestGeneration();
    const refresh = generation.begin();
    assert.equal(generation.isCurrent(refresh), true);
  });

  it("drops a countdown refresh that was in flight when the user confirmed", () => {
    const generation = new RequestGeneration();
    const refresh = generation.begin();
    generation.invalidate(); // the user confirms
    assert.equal(generation.isCurrent(refresh), false);
  });

  it("drops it when the confirm came back with a rebuilt Solana route to review", () => {
    const generation = new RequestGeneration();
    const refresh = generation.begin();
    generation.invalidate(); // confirm
    generation.invalidate(); // adoptRebuiltRoute
    assert.equal(
      generation.isCurrent(refresh),
      false,
      "the late refresh must not replace the rebuilt route on review"
    );
  });

  it("lets a refresh begun after the confirm land", () => {
    const generation = new RequestGeneration();
    generation.invalidate();
    const refresh = generation.begin();
    assert.equal(generation.isCurrent(refresh), true);
  });

  it("drops an older fetch that finishes after a newer one began", () => {
    const generation = new RequestGeneration();
    const older = generation.begin();
    const newer = generation.begin();
    assert.equal(generation.isCurrent(older), false);
    assert.equal(generation.isCurrent(newer), true);
  });
});
