import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeFound, finders, nextStep, type Step } from ".";
import { cloneGrid, createPuzzle, mulberry32 } from "../sudoku";
import { bits, lockedFrom, onlyIn, openBoard } from "./test-helpers";

describe("AIC", () => {
  it("XY-chain: four two-candidate cells end in 1 at both ends", () => {
    const { grid, cand } = openBoard();
    cand[0][0] = bits(1, 2);
    cand[0][6] = bits(2, 3);
    cand[6][6] = bits(3, 4);
    cand[6][1] = bits(4, 1);
    const found = finders.aic(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "xy-chain");
    assert.deepEqual(found.cells, [{ r: 0, c: 0 }, { r: 0, c: 6 }, { r: 6, c: 6 }, { r: 6, c: 1 }]);
    assert.deepEqual(found.digits, [1, 2, 3, 4]);
    assert.equal(found.nodes?.length, 8);
    assert.ok(found.links?.every((unit) => unit === null), "every strong link is inside a cell");
    assert.deepEqual(
      found.removals.map(({ r, c, digit }) => `${r}${c}:${digit}`),
      ["01:1", "11:1", "21:1", "60:1", "70:1", "80:1"],
    );
    assert.equal(found.relies.length, 28, "each of the four cells must be down to its two digits");
    assert.match(
      describeFound(found, false),
      /^If row 1, column 1 isn't 1, it must be 2, its only other candidate\. Then row 1, column 7, which sees row 1, column 1, isn't 2, so it must be 3, /,
    );
  });

  it("W-Wing: two 4/7 cells joined through a row where 7 has two places", () => {
    const { grid, cand } = openBoard();
    cand[0][0] = bits(4, 7);
    cand[6][8] = bits(4, 7);
    onlyIn(cand, 3, 7, [0, 8]);
    const found = finders.aic(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "w-wing");
    assert.deepEqual(found.removals, [
      { r: 0, c: 8, digit: 4 },
      { r: 6, c: 0, digit: 4 },
    ]);
    assert.deepEqual(
      found.links?.map((unit) => (unit ? `${unit.kind} ${unit.index}` : "cell")),
      ["cell", "row 3", "cell"],
    );
    assert.equal(
      describeFound(found, false),
      "If row 1, column 1 isn't 4, it must be 7, its only other candidate. Then row 4, column 1, which sees row 1, column 1, isn't 7, so row 4, column 9 must be 7, as the only other place for 7 in row 4. Then row 7, column 9, which sees row 4, column 9, isn't 7, so it must be 4, its only other candidate. So either row 1, column 1 or row 7, column 9 is 4, and no cell that sees both can be 4: remove 4 from row 1, column 9; row 7, column 1.",
    );
  });

  it("mixed digits: a chain that ends on 3 in one cell and 8 in another", () => {
    const { grid, cand } = openBoard();
    // Column 1 holds 3 only in rows 1 and 3; row 3, column 1 is 3 or 8; row 3
    // holds 8 only in columns 1 and 3. So row 1, column 1 is 3, or row 3,
    // column 3 is 8. Those two cells share a box, so row 1, column 1 can't
    // be 8 and row 3, column 3 can't be 3.
    for (let r = 0; r < 9; r++) if (r !== 0 && r !== 2) cand[r][0] &= ~bits(3);
    cand[2][0] = bits(3, 8);
    onlyIn(cand, 2, 8, [0, 2]);
    const found = finders.aic(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "aic");
    assert.deepEqual(found.removals, [
      { r: 0, c: 0, digit: 8 },
      { r: 2, c: 2, digit: 3 },
    ]);
    assert.equal(
      describeFound(found, false),
      "If row 1, column 1 isn't 3, row 3, column 1 must be 3, as the only other place for 3 in column 1. Then row 3, column 1 can't also be 8, so row 3, column 3 must be 8, as the only other place for 8 in row 3. So either row 1, column 1 is 3 or row 3, column 3 is 8, and nothing that clashes with both can be true: remove 3 from row 3, column 3; and 8 from row 1, column 1.",
    );
  });

  it("finds nothing on a board with no strong links", () => {
    const { grid, cand } = openBoard();
    assert.equal(finders.aic(grid, cand), null);
  });
});

describe("AIC in a real game", () => {
  it("the second expert test puzzle needs one, and it leads to a correct placement", () => {
    const { puzzle, solution } = createPuzzle("expert", mulberry32(2 * 101 + "expert".length));
    const locked = lockedFrom(puzzle);
    const grid = cloneGrid(puzzle);
    let chain: Step[] | null = null;
    for (let move = 0; move < 81 && !chain; move++) {
      const advice = nextStep(grid, solution, locked);
      assert.equal(advice.kind, "steps");
      if (advice.kind !== "steps") return;
      if (advice.steps.some((step) => step.nodes)) chain = advice.steps;
      const { r, c, digit } = advice.steps[advice.steps.length - 1].place!;
      assert.equal(digit, solution[r][c]);
      grid[r][c] = digit;
    }
    assert.ok(chain, "an AIC step appears before the puzzle is solved");
    for (const step of chain) {
      for (const { r, c, digit } of step.removals) assert.notEqual(digit, solution[r][c], step.text);
    }
  });
});
