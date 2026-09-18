import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCrazyTime } from "../utils/crazyTime";

describe("isCrazyTime", () => {
  it("accepts positive integer powers", () => {
    for (const v of [1, 2, 4, 8, 16, 1024, 2 ** 40]) {
      assert.equal(isCrazyTime(v), true, String(v));
    }
  });

  it("accepts fractional powers", () => {
    for (const v of [0.5, 0.25, 0.125, Number("0.0625")]) {
      assert.equal(isCrazyTime(v), true, String(v));
    }
  });

  it("rejects everything else", () => {
    for (const v of [0, -2, 3, 6, 10, 0.1, 0.3, 100, NaN, Infinity]) {
      assert.equal(isCrazyTime(v), false, String(v));
    }
  });
});
