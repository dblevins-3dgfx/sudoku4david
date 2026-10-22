import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finders } from ".";
import { bits, openBoard } from "./test-helpers";

describe("pairs and triples", () => {
  it("naked pair: two cells holding only 2 and 7 clear them from their row", () => {
    const { grid, cand } = openBoard();
    cand[8][0] = bits(2, 7);
    cand[8][4] = bits(2, 7);
    const found = finders.nakedSubset(grid, cand, 2);
    assert.ok(found);
    assert.equal(found.technique, "naked-pair");
    assert.equal(found.unit?.kind, "row");
    assert.deepEqual(found.digits, [2, 7]);
    assert.equal(found.removals.length, 14);
  });

  it("naked triple: three cells sharing 1, 3, and 9", () => {
    const { grid, cand } = openBoard();
    cand[0][8] = bits(1, 3);
    cand[4][8] = bits(3, 9);
    cand[7][8] = bits(1, 9);
    const found = finders.nakedSubset(grid, cand, 3);
    assert.ok(found);
    assert.equal(found.technique, "naked-triple");
    assert.equal(found.unit?.kind, "column");
    assert.deepEqual(found.digits, [1, 3, 9]);
  });

  it("hidden pair: 4 and 8 fit only in two cells of a column", () => {
    const { grid, cand } = openBoard();
    for (let r = 0; r < 9; r++) if (r !== 2 && r !== 6) cand[r][3] &= ~bits(4, 8);
    const found = finders.hiddenSubset(grid, cand, 2);
    assert.ok(found);
    assert.equal(found.technique, "hidden-pair");
    assert.deepEqual(found.cells, [{ r: 2, c: 3 }, { r: 6, c: 3 }]);
    assert.equal(found.removals.length, 14);
  });

  it("hidden triple: 1, 2, and 3 fit only in three cells of a box", () => {
    const { grid, cand } = openBoard();
    for (let r = 7; r < 9; r++) for (let c = 6; c < 9; c++) cand[r][c] &= ~bits(1, 2, 3);
    const found = finders.hiddenSubset(grid, cand, 3);
    assert.ok(found);
    assert.equal(found.technique, "hidden-triple");
    assert.deepEqual(found.digits, [1, 2, 3]);
  });
});
