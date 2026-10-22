import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finders } from ".";
import { bits, openBoard } from "./test-helpers";

describe("singles", () => {
  it("hidden single: a digit with one place in a box", () => {
    const { grid, cand } = openBoard();
    for (const [r, c] of [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0], [2, 1], [2, 2]]) cand[r][c] &= ~bits(4);
    const found = finders.hiddenSingle(grid, cand);
    assert.ok(found);
    assert.deepEqual(found.place, { r: 1, c: 2, digit: 4 });
    assert.equal(found.unit?.kind, "box");
  });

  it("naked single: a cell with one candidate", () => {
    const { grid, cand } = openBoard();
    cand[5][6] = bits(8);
    const found = finders.nakedSingle(grid, cand);
    assert.deepEqual(found?.place, { r: 5, c: 6, digit: 8 });
  });
});
