import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { fmtAmount } from "src/modes/swap/amountFormat";

// fmtAmount formats in the runtime's default locale; the expected strings
// below are en-US.
assert.equal(Intl.NumberFormat().resolvedOptions().locale, "en-US");

function parseDisplayed(text: string): number {
  return Number(text.replace(/,/g, ""));
}

describe("fmtAmount", () => {
  it("shows a bridged dust amount instead of rounding it to 0", () => {
    // 0.1 USDC on Base -> ETH on Doma via Relay, request 0x179246…1436.
    assert.equal(fmtAmount(0.000033065251551468, 4), "0.000033");
  });

  it("formats ordinary amounts at the requested fraction digits", () => {
    assert.equal(fmtAmount(0.1, 4), "0.1");
    assert.equal(fmtAmount(1234.56789, 4), "1,234.5679");
    assert.equal(fmtAmount(2.5, 0), "3");
    assert.equal(fmtAmount(0.1234567), "0.123457");
  });

  it("keeps the fraction-digit format at the smallest step it can show", () => {
    assert.equal(fmtAmount(0.0001, 4), "0.0001");
    assert.equal(fmtAmount(0.000001), "0.000001");
  });

  it("switches to significant digits just below that step", () => {
    assert.equal(fmtAmount(0.00005, 4), "0.00005");
    assert.equal(fmtAmount(0.00000012345), "0.00000012");
    assert.equal(fmtAmount(0.5, 0), "0.5");
  });

  it("keeps the sign of a small negative amount", () => {
    assert.equal(fmtAmount(-0.000033, 4), "-0.000033");
  });

  it("formats zero and non-finite input as 0", () => {
    assert.equal(fmtAmount(0, 4), "0");
    assert.equal(fmtAmount(NaN, 4), "0");
    assert.equal(fmtAmount(Infinity, 4), "0");
  });

  it("never shows a nonzero amount as 0, across every magnitude and digit limit", () => {
    const mantissas = [
      1, 1.0000001, 1.4999, 1.5, 2.5, 3.3065, 5, 9.999, 9.9999999,
    ];
    let checked = 0;
    for (
      let maxFractionDigits = 0;
      maxFractionDigits <= 8;
      maxFractionDigits++
    ) {
      const step = 10 ** -maxFractionDigits;
      // The two regimes meet at `step`; probe both sides of it explicitly.
      const boundary = [step, step * (1 - 1e-9), step * (1 + 1e-9)];
      const sweep: number[] = [];
      for (let exponent = -18; exponent <= 15; exponent++) {
        for (const mantissa of mantissas) sweep.push(mantissa * 10 ** exponent);
      }
      for (const magnitude of [...boundary, ...sweep]) {
        for (const n of [magnitude, -magnitude]) {
          const text = fmtAmount(n, maxFractionDigits);
          const shown = parseDisplayed(text);
          assert.ok(
            Number.isFinite(shown) && shown !== 0,
            `fmtAmount(${n}, ${maxFractionDigits}) = "${text}"`
          );
          const ratio = shown / n;
          assert.ok(
            ratio >= 0.5 && ratio <= 2,
            `fmtAmount(${n}, ${maxFractionDigits}) = "${text}" is off by ${ratio}x`
          );
          checked++;
        }
      }
    }
    assert.equal(checked, 9 * (3 + 34 * mantissas.length) * 2);
  });
});
