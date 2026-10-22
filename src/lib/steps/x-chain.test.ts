import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeFound, finders } from ".";
import { onlyIn, openBoard } from "./test-helpers";

describe("X-chains", () => {
  it("three links: one of the two ends is 4, so cells seeing both lose 4", () => {
    const { grid, cand } = openBoard();
    onlyIn(cand, 0, 4, [1, 4]);
    onlyIn(cand, 6, 4, [1, 3]);
    const found = finders.xChain(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "x-chain");
    assert.equal(found.unit, null);
    assert.deepEqual(found.digits, [4]);
    assert.deepEqual(found.cells, [{ r: 0, c: 4 }, { r: 0, c: 1 }, { r: 6, c: 1 }, { r: 6, c: 3 }]);
    assert.deepEqual(
      found.links?.map((unit) => `${unit.kind} ${unit.index}`),
      ["row 0", "row 6"],
    );
    assert.deepEqual(found.removals, [
      { r: 1, c: 3, digit: 4 },
      { r: 2, c: 3, digit: 4 },
      { r: 7, c: 4, digit: 4 },
      { r: 8, c: 4, digit: 4 },
    ]);
    assert.equal(found.relies.length, 14, "the other seven cells of rows 1 and 7 must be free of 4");
    assert.equal(
      describeFound(found, false).split(":")[0],
      "If row 1, column 5 isn't 4, row 1, column 2 must be, as the only other place for 4 in row 1. Then row 7, column 2, which sees row 1, column 2, isn't 4, so row 7, column 4 must be, as the only other place for 4 in row 7. So either row 1, column 5 or row 7, column 4 is 4, and no cell that sees both can be 4",
    );
  });

  it("five links when no shorter chain removes anything", () => {
    const { grid, cand } = openBoard();
    onlyIn(cand, 0, 7, [0, 4]);
    onlyIn(cand, 3, 7, [4, 7]);
    onlyIn(cand, 6, 7, [2, 7]);
    const found = finders.xChain(grid, cand);
    assert.ok(found);
    assert.deepEqual(found.cells, [
      { r: 0, c: 0 },
      { r: 0, c: 4 },
      { r: 3, c: 4 },
      { r: 3, c: 7 },
      { r: 6, c: 7 },
      { r: 6, c: 2 },
    ]);
    assert.deepEqual(found.removals, [
      { r: 1, c: 2, digit: 7 },
      { r: 2, c: 2, digit: 7 },
      { r: 7, c: 0, digit: 7 },
      { r: 8, c: 0, digit: 7 },
    ]);
  });

  it("finds nothing when the ends share no cell with the digit", () => {
    const { grid, cand } = openBoard();
    // Rows 1 and 7 hold 4 only in columns 2/6 and 2/8: the ends, row 1
    // column 6 and row 7 column 8, are seen together only by cells in those
    // two rows, which can't be 4.
    onlyIn(cand, 0, 4, [1, 5]);
    onlyIn(cand, 6, 4, [1, 7]);
    assert.equal(finders.xChain(grid, cand), null);
  });
});
