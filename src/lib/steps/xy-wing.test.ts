import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeFound, finders } from ".";
import { bits, openBoard } from "./test-helpers";

describe("XY-Wing", () => {
  it("XY-Wing: a 1/2 pivot with 1/3 and 2/3 pincers clears 3 where both pincers see", () => {
    const { grid, cand } = openBoard();
    cand[0][0] = bits(1, 2); // pivot
    cand[0][5] = bits(1, 3); // pincer in the pivot's row
    cand[5][0] = bits(2, 3); // pincer in the pivot's column
    const found = finders.xyWing(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "xy-wing");
    assert.deepEqual(found.cells, [{ r: 0, c: 0 }, { r: 0, c: 5 }, { r: 5, c: 0 }]);
    assert.deepEqual(found.digits, [1, 2, 3]);
    assert.deepEqual(found.removals, [{ r: 5, c: 5, digit: 3 }], "only row 6, column 6 sees both pincers");
    assert.equal(found.relies.length, 21, "each of the three cells must be down to its two digits");
    assert.equal(
      describeFound(found, false),
      "Row 1, column 1 can only be 1 or 2. It sees row 1, column 6, which can only be 1 or 3, and row 6, column 1, which can only be 2 or 3. If row 1, column 1 is 1, row 1, column 6 must be 3; if it is 2, row 6, column 1 must be 3. Either way one of those two is 3, so no cell that sees both of them can be 3: remove 3 from row 6, column 6.",
    );
  });

  it("XY-Wing needs the pincers to share the third digit", () => {
    const { grid, cand } = openBoard();
    cand[0][0] = bits(1, 2);
    cand[0][5] = bits(1, 3);
    cand[5][0] = bits(2, 4);
    assert.equal(finders.xyWing(grid, cand), null);
  });
});
