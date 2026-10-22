import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeFound, finders } from ".";
import { bits, openBoard } from "./test-helpers";

describe("X-Wing and Swordfish", () => {
  it("X-Wing: 4 only in columns 3 and 8 of rows 1 and 6 clears those columns", () => {
    const { grid, cand } = openBoard();
    for (const r of [0, 5]) for (let c = 0; c < 9; c++) if (c !== 2 && c !== 7) cand[r][c] &= ~bits(4);
    const found = finders.fish(grid, cand, 2);
    assert.ok(found);
    assert.equal(found.technique, "x-wing");
    assert.equal(found.unit, null);
    assert.deepEqual(found.digits, [4]);
    assert.deepEqual(found.cells, [{ r: 0, c: 2 }, { r: 0, c: 7 }, { r: 5, c: 2 }, { r: 5, c: 7 }]);
    assert.equal(found.removals.length, 14);
    assert.ok(found.removals.every(({ r, c, digit }) => digit === 4 && (c === 2 || c === 7) && r !== 0 && r !== 5));
    assert.equal(found.relies.length, 14, "the other seven cells of each row must be free of 4");
    assert.equal(
      describeFound(found, false).split(":")[0],
      "In rows 1 and 6, 4 can only go in columns 3 and 8. Those two rows need their 4s in those two columns, so columns 3 and 8 get their 4s in rows 1 and 6. No other cell in columns 3 and 8 can be 4",
    );
  });

  it("X-Wing works with rows and columns swapped", () => {
    const { grid, cand } = openBoard();
    for (const c of [0, 8]) for (let r = 0; r < 9; r++) if (r !== 1 && r !== 7) cand[r][c] &= ~bits(9);
    const found = finders.fish(grid, cand, 2);
    assert.ok(found);
    assert.ok(found.removals.every(({ r, c, digit }) => digit === 9 && (r === 1 || r === 7) && c !== 0 && c !== 8));
    assert.equal(found.removals.length, 14);
    assert.match(describeFound(found, false), /^In columns 1 and 9, 9 can only go in rows 2 and 8\. /);
  });

  it("Swordfish: three rows whose 5s share three columns clear those columns", () => {
    const { grid, cand } = openBoard();
    const keep: Record<number, number[]> = { 0: [0, 4], 4: [4, 8], 8: [0, 8] };
    for (const [r, cols] of Object.entries(keep)) {
      for (let c = 0; c < 9; c++) if (!cols.includes(c)) cand[Number(r)][c] &= ~bits(5);
    }
    assert.equal(finders.fish(grid, cand, 2), null, "no two of those rows make an X-Wing");
    const found = finders.fish(grid, cand, 3);
    assert.ok(found);
    assert.equal(found.technique, "swordfish");
    assert.equal(found.cells.length, 6);
    assert.equal(found.removals.length, 18);
    assert.ok(found.removals.every(({ r, c }) => [0, 4, 8].includes(c) && ![0, 4, 8].includes(r)));
    assert.match(describeFound(found, false), /^In rows 1, 5, and 9, 5 can only go in columns 1, 5, and 9\. Those three rows/);
  });
});
