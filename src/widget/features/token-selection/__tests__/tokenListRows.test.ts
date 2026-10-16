import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  INITIAL_TOKEN_LIMIT,
  visibleTokenRows,
} from "src/widget/features/token-selection/tokenListRows";

const rows = (count: number) => Array.from({ length: count }, (_, i) => i);

describe("visibleTokenRows", () => {
  it("shows fifty rows before Show all", () => {
    assert.equal(INITIAL_TOKEN_LIMIT, 50);
  });

  it("shows every row of a list that fits", () => {
    assert.deepEqual(visibleTokenRows(rows(0), false), {
      visible: [],
      hidden: 0,
    });
    assert.deepEqual(visibleTokenRows(rows(49), false), {
      visible: rows(49),
      hidden: 0,
    });
    assert.deepEqual(visibleTokenRows(rows(50), false), {
      visible: rows(50),
      hidden: 0,
    });
  });

  it("holds back the rows past fifty, keeping the list's order", () => {
    assert.deepEqual(visibleTokenRows(rows(51), false), {
      visible: rows(50),
      hidden: 1,
    });
  });

  // The 5tzF wallet lists 354 supported Solana tokens.
  it("shows a large wallet's first fifty, then all of it after Show all", () => {
    assert.deepEqual(visibleTokenRows(rows(354), false), {
      visible: rows(50),
      hidden: 304,
    });
    assert.deepEqual(visibleTokenRows(rows(354), true), {
      visible: rows(354),
      hidden: 0,
    });
  });

  it("always shows a prefix and counts the rest as hidden", () => {
    for (let count = 0; count <= 300; count++) {
      for (const showAll of [false, true]) {
        const list = rows(count);
        const { visible, hidden } = visibleTokenRows(list, showAll);
        const label = `${count} rows, showAll ${showAll}`;
        assert.deepEqual(visible, list.slice(0, visible.length), label);
        assert.equal(visible.length + hidden, count, label);
        assert.equal(
          visible.length,
          showAll ? count : Math.min(count, INITIAL_TOKEN_LIMIT),
          label
        );
      }
    }
  });
});
