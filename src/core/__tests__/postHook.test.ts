import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertValidPostHook } from "../routes";

describe("assertValidPostHook", () => {
  it("is a no-op when hooks is undefined", () => {
    assert.doesNotThrow(() => assertValidPostHook(undefined));
  });

  it("is a no-op when hooks.postHook is undefined", () => {
    assert.doesNotThrow(() => assertValidPostHook({}));
  });

  it("throws when target is missing", () => {
    assert.throws(
      () =>
        assertValidPostHook({
          postHook: { target: "", callData: "0x01", fundAmount: "100" },
        }),
      /target is required/
    );
  });

  it("throws when callData is missing", () => {
    assert.throws(
      () =>
        assertValidPostHook({
          postHook: { target: "0xabc", callData: "", fundAmount: "100" },
        }),
      /callData is required/
    );
  });

  it("throws when neither fundAmount nor fullAmount is set", () => {
    assert.throws(
      () =>
        assertValidPostHook({
          postHook: { target: "0xabc", callData: "0x01" },
        }),
      /fundAmount is required unless fullAmount is set/
    );
  });

  it("throws when fullAmount is true but amountInputPos is missing", () => {
    assert.throws(
      () =>
        assertValidPostHook({
          postHook: {
            target: "0xabc",
            callData: "0x01",
            fullAmount: true,
          },
        }),
      /amountInputPos is required/
    );
  });

  it("passes with a fixed fundAmount (the recommended, provider-agnostic mode)", () => {
    assert.doesNotThrow(() =>
      assertValidPostHook({
        postHook: {
          target: "0xabc",
          callData: "0x01",
          fundAmount: "1000000",
        },
      })
    );
  });

  it("passes with fullAmount + amountInputPos, including position 0", () => {
    assert.doesNotThrow(() =>
      assertValidPostHook({
        postHook: {
          target: "0xabc",
          callData: "0x01",
          fullAmount: true,
          amountInputPos: 0,
        },
      })
    );
  });
});
