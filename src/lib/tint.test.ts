import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Grid } from "./sudoku";
import { cellTone, noteHighlighted, type CellMark } from "./tint";

function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid;
}

function noMarks(): (CellMark | null)[][] {
  return Array.from({ length: 9 }, () => Array<CellMark | null>(9).fill(null));
}

describe("cell tint", () => {
  const grid = emptyGrid();
  grid[0][0] = 5;
  grid[8][8] = 5;
  grid[4][4] = 3;
  const base = { grid, selected: { r: 0, c: 0 }, conflict: false, marks: null, highlighting: true };

  it("highlights the selected cell", () => {
    assert.equal(cellTone(base, 0, 0), "selected");
  });

  it("tints other cells holding the selected digit more strongly than peers", () => {
    assert.equal(cellTone(base, 8, 8), "same");
    assert.equal(cellTone(base, 0, 5), "peer");
    assert.equal(cellTone(base, 5, 0), "peer");
    assert.equal(cellTone(base, 2, 2), "peer");
    assert.equal(cellTone(base, 4, 4), "plain");
  });

  it("tints no same-digit cells when the selected cell is empty", () => {
    const fromEmpty = { ...base, selected: { r: 4, c: 0 } };
    assert.equal(cellTone(fromEmpty, 8, 8), "plain");
    assert.equal(cellTone(fromEmpty, 4, 4), "peer");
  });

  it("lets a shown conflict take precedence over every other tint", () => {
    const conflicted = { ...base, conflict: true };
    assert.equal(cellTone(conflicted, 0, 0), "conflict");
    assert.equal(cellTone(conflicted, 8, 8), "conflict");
    const marks = noMarks();
    marks[3][3] = "target";
    assert.equal(cellTone({ ...conflicted, marks }, 3, 3), "conflict");
  });

  it("replaces peer and same-digit tints with an explanation's marks", () => {
    const marks = noMarks();
    marks[3][3] = "target";
    marks[0][1] = "removal";
    marks[0][0] = "pattern";
    const explained = { ...base, marks };
    assert.equal(cellTone(explained, 3, 3), "target");
    assert.equal(cellTone(explained, 0, 1), "removal");
    assert.equal(cellTone(explained, 0, 0), "pattern");
    assert.equal(cellTone(explained, 8, 8), "plain");
    assert.equal(cellTone(explained, 0, 5), "plain");
  });

  it("drops peer and same-digit tints with Board highlighting off, and keeps the rest", () => {
    const plain = { ...base, highlighting: false };
    assert.equal(cellTone(plain, 0, 0), "selected");
    assert.equal(cellTone(plain, 8, 8), "plain");
    assert.equal(cellTone(plain, 0, 5), "plain");
    assert.equal(cellTone({ ...plain, conflict: true }, 8, 8), "conflict");
    const marks = noMarks();
    marks[3][3] = "target";
    assert.equal(cellTone({ ...plain, marks }, 3, 3), "target");
  });

  it("keeps the selected tint on an unmarked selected cell during an explanation", () => {
    assert.equal(cellTone({ ...base, marks: noMarks() }, 0, 0), "selected");
  });
});

describe("highlighted notes", () => {
  const grid = emptyGrid();
  grid[0][0] = 5;
  const notes = Array.from({ length: 9 }, () => Array(9).fill(0));
  notes[1][1] = (1 << 5) | (1 << 7);

  it("highlights a mark of the selected cell's digit", () => {
    assert.equal(noteHighlighted(grid, notes, { r: 0, c: 0 }, 1, 1, 5), true);
    assert.equal(noteHighlighted(grid, notes, { r: 0, c: 0 }, 1, 1, 7), false);
  });

  it("does not highlight a digit the cell has no mark for", () => {
    assert.equal(noteHighlighted(grid, notes, { r: 0, c: 0 }, 2, 2, 5), false);
  });

  it("highlights no marks with Board highlighting off", () => {
    assert.equal(noteHighlighted(grid, notes, { r: 0, c: 0 }, 1, 1, 5, false), false);
  });

  it("highlights no marks when the selected cell is empty", () => {
    assert.equal(noteHighlighted(grid, notes, { r: 4, c: 4 }, 1, 1, 5), false);
  });
});
