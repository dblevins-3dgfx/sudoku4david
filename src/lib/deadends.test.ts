import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deadEndCells, deadEndText, findDeadEnds, hasDeadEnd } from "./deadends";
import { emptyGrid, type Digit } from "./sudoku";

describe("dead-end warning", () => {
  it("finds nothing on an empty or healthy board", () => {
    const found = findDeadEnds(emptyGrid());
    assert.equal(hasDeadEnd(found), false);
    assert.equal(deadEndText(found), null);
  });

  it("flags an empty cell with no candidates", () => {
    const grid = emptyGrid();
    for (let c = 1; c < 9; c++) grid[0][c] = c as Digit; // row 1 holds 1–8
    grid[5][0] = 9; // and column 1 holds 9
    const found = findDeadEnds(grid);
    assert.deepEqual(found.cells, [{ r: 0, c: 0 }]);
    assert.equal(deadEndText(found), "Dead end: row 1, column 1 has no candidates.");
    assert.equal(deadEndCells(grid, found)[0][0], true);
  });

  it("flags a digit with no place left in a row, column, or box", () => {
    const grid = emptyGrid();
    // Row 1 has 1–7 in columns 1–7 and two empty cells, columns 8 and 9.
    // An 8 in columns 8 and 9 elsewhere leaves 8 no place in row 1.
    for (let c = 0; c < 7; c++) grid[0][c] = (c + 1) as Digit;
    grid[4][7] = 8;
    grid[8][8] = 8;
    const found = findDeadEnds(grid);
    assert.deepEqual(found.cells, []);
    const row = found.units.find((u) => u.unit.kind === "row");
    assert.equal(row?.unit.index, 0);
    assert.equal(row?.digit, 8);
    assert.equal(deadEndText(found)?.startsWith("Dead end: 8 has no place in"), true);
    const marked = deadEndCells(grid, found);
    assert.equal(marked[0][7], true);
    assert.equal(marked[0][8], true);
    assert.equal(marked[0][0], false, "filled cells are not marked");
  });

  it("names a cell before a unit", () => {
    const grid = emptyGrid();
    for (let c = 1; c < 9; c++) grid[0][c] = c as Digit;
    grid[5][0] = 9;
    const found = findDeadEnds(grid);
    assert.ok(found.units.length > 0, "the dead cell also leaves its row short of a digit");
    assert.match(deadEndText(found) ?? "", /has no candidates/);
    const marked = deadEndCells(grid, found);
    assert.equal(marked.flat().filter(Boolean).length, 1, "only the dead cell is tinted, not its row");
  });

  it("ignores a full unit, whose repeat Error checking reports", () => {
    const grid = emptyGrid();
    for (let c = 0; c < 9; c++) grid[0][c] = (c === 8 ? 1 : c + 1) as Digit; // 1 twice, no 9
    const found = findDeadEnds(grid);
    assert.equal(found.units.some((u) => u.unit.kind === "row" && u.unit.index === 0), false);
  });
});
