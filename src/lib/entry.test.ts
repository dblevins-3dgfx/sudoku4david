import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOUBLE_TAP_MS, nextTap, type Tap } from "./entry";
import type { Digit } from "./sudoku";

const digit = 4 as Digit;

describe("nextTap", () => {
  it("marks on the first press and writes on the second", () => {
    const first = nextTap(null, digit, "1-2", 1_000);
    assert.equal(first.action, "note");
    assert.deepEqual(first.tap, { digit, cell: "1-2", at: 1_000 });

    const second = nextTap(first.tap, digit, "1-2", 1_000 + DOUBLE_TAP_MS);
    assert.equal(second.action, "fill");
    assert.equal(second.tap, null);
  });

  it("starts a new mark after the window, on another digit, or on another cell", () => {
    const previous: Tap = { digit, cell: "1-2", at: 1_000 };
    const late = nextTap(previous, digit, "1-2", 1_000 + DOUBLE_TAP_MS + 1);
    assert.equal(late.action, "note");
    assert.equal(late.tap?.at, 1_000 + DOUBLE_TAP_MS + 1);

    const otherDigit = nextTap(previous, 5, "1-2", 1_100);
    assert.equal(otherDigit.action, "note");
    assert.equal(otherDigit.tap?.digit, 5);

    const otherCell = nextTap(previous, digit, "3-3", 1_100);
    assert.equal(otherCell.action, "note");
    assert.equal(otherCell.tap?.cell, "3-3");
  });

  it("ignores a clock that moved backward", () => {
    const previous: Tap = { digit, cell: "0-0", at: 500 };
    const result = nextTap(previous, digit, "0-0", 499);
    assert.equal(result.action, "note");
    assert.equal(result.tap?.at, 499);
  });
});
