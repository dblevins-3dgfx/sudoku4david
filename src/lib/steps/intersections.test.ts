import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finders } from ".";
import { bits, openBoard } from "./test-helpers";

describe("pointing and claiming", () => {
  it("pointing: a box's 5s on one row clear the rest of that row", () => {
    const { grid, cand } = openBoard();
    for (let r = 1; r < 3; r++) for (let c = 0; c < 3; c++) cand[r][c] &= ~bits(5);
    const found = finders.pointing(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "pointing");
    assert.deepEqual(found.digits, [5]);
    assert.deepEqual(
      found.removals.map(({ r, c }) => [r, c]),
      [3, 4, 5, 6, 7, 8].map((c) => [0, c]),
    );
  });

  it("claiming: a row's 6s inside one box clear the rest of that box", () => {
    const { grid, cand } = openBoard();
    for (let c = 3; c < 9; c++) cand[4][c] &= ~bits(6);
    const found = finders.claiming(grid, cand);
    assert.ok(found);
    assert.equal(found.unit?.kind, "row");
    assert.equal(found.unit?.index, 4);
    assert.ok(found.removals.every(({ r, c, digit }) => digit === 6 && r !== 4 && r >= 3 && r < 6 && c < 3));
    assert.equal(found.removals.length, 6);
  });
});
