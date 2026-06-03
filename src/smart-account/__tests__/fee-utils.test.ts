import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFeeRequirement, isPaymasterUnavailable } from "../fee-utils";

describe("isPaymasterUnavailable", () => {
  it("returns false for null / non-objects", () => {
    assert.equal(isPaymasterUnavailable(null), false);
    assert.equal(isPaymasterUnavailable(undefined), false);
    assert.equal(isPaymasterUnavailable("string"), false);
    assert.equal(isPaymasterUnavailable(42), false);
  });

  it("returns true when code is PAYMASTER_UNAVAILABLE at top level", () => {
    assert.equal(isPaymasterUnavailable({ code: "PAYMASTER_UNAVAILABLE" }), true);
  });

  it("returns true when code is nested inside cause chain", () => {
    const err = {
      code: "SOME_OTHER_CODE",
      cause: {
        code: "ANOTHER_CODE",
        cause: { code: "PAYMASTER_UNAVAILABLE" },
      },
    };
    assert.equal(isPaymasterUnavailable(err), true);
  });

  it("returns false when no PAYMASTER_UNAVAILABLE in chain", () => {
    const err = {
      code: "NO_PAYMASTER",
      cause: { code: "SOMETHING_ELSE" },
    };
    assert.equal(isPaymasterUnavailable(err), false);
  });

  it("handles missing cause gracefully", () => {
    assert.equal(isPaymasterUnavailable({ code: "OTHER" }), false);
  });
});

describe("extractFeeRequirement", () => {
  it("returns null for null / non-objects", () => {
    assert.equal(extractFeeRequirement(null), null);
    assert.equal(extractFeeRequirement(undefined), null);
    assert.equal(extractFeeRequirement("oops"), null);
  });

  it("returns null when no matching error code is found", () => {
    assert.equal(extractFeeRequirement({ code: -32001, message: "unrelated" }), null);
    assert.equal(extractFeeRequirement({ code: -32602 }), null); // no data
    assert.equal(extractFeeRequirement({ code: -32602, data: {} }), null); // data but no currentMaxFee
  });

  describe("-32602 replacement underpriced", () => {
    it("parses currentMaxFee and currentMaxPriorityFee", () => {
      const err = {
        code: -32602,
        data: { currentMaxFee: "1000000000", currentMaxPriorityFee: "500000000" },
      };
      const req = extractFeeRequirement(err);
      assert.notEqual(req, null);
      assert.equal(req!.minFee, 1000000000n);
      assert.equal(req!.minPriorityFee, 500000000n);
      assert.equal(req!.isReplacement, true);
    });

    it("falls back to minFee for priority when currentMaxPriorityFee is absent", () => {
      const err = {
        code: -32602,
        data: { currentMaxFee: "2000000000" },
      };
      const req = extractFeeRequirement(err);
      assert.notEqual(req, null);
      assert.equal(req!.minFee, 2000000000n);
      assert.equal(req!.minPriorityFee, 2000000000n);
      assert.equal(req!.isReplacement, true);
    });
  });

  describe("-32000 precheck floor", () => {
    it("parses 'must be at least N' from message", () => {
      const err = {
        code: -32000,
        message: "precheck failed: maxFeePerGas is 8252770 but must be at least 34104859",
      };
      const req = extractFeeRequirement(err);
      assert.notEqual(req, null);
      assert.equal(req!.minFee, 34104859n);
      assert.equal(req!.minPriorityFee, 34104859n);
      assert.equal(req!.isReplacement, false);
    });

    it("returns null when message does not match pattern", () => {
      const err = { code: -32000, message: "something unrelated" };
      assert.equal(extractFeeRequirement(err), null);
    });
  });

  describe("cause chain traversal", () => {
    it("finds -32602 nested inside an outer wrapper error", () => {
      const err = {
        code: "OUTER",
        message: "wrapped",
        cause: {
          code: -32602,
          data: { currentMaxFee: "777", currentMaxPriorityFee: "333" },
        },
      };
      const req = extractFeeRequirement(err);
      assert.notEqual(req, null);
      assert.equal(req!.minFee, 777n);
      assert.equal(req!.isReplacement, true);
    });

    it("finds -32000 three levels deep", () => {
      const err = {
        cause: {
          cause: {
            code: -32000,
            message: "precheck must be at least 99999",
          },
        },
      };
      const req = extractFeeRequirement(err);
      assert.notEqual(req, null);
      assert.equal(req!.minFee, 99999n);
      assert.equal(req!.isReplacement, false);
    });
  });
});
