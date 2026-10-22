import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneNotes, emptyNotes, notesAfterPlacing, notesAreEmpty } from "./notes";
import type { Grid } from "./sudoku";

const ALL = 0b1111111110; // bits 1..9

function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid;
}

function fullNotes() {
  return emptyNotes().map((row) => row.map(() => ALL));
}

describe("notes after placing a digit", () => {
  it("clears the cell's own marks and that digit from its row, column, and box", () => {
    const grid = emptyGrid();
    grid[4][4] = 7;
    const notes = fullNotes();
    notesAfterPlacing(grid, notes, 4, 4, 7);
    assert.equal(notes[4][4], 0);
    const without7 = ALL & ~(1 << 7);
    assert.equal(notes[4][0], without7, "same row");
    assert.equal(notes[0][4], without7, "same column");
    assert.equal(notes[3][5], without7, "same box");
    assert.equal(notes[0][0], ALL, "unrelated cell keeps 7");
  });

  it("removes the digit from every mark once nine copies are on the board", () => {
    const grid = emptyGrid();
    for (let i = 0; i < 9; i++) grid[i][(i * 3 + ((i / 3) | 0)) % 9] = 2;
    const notes = fullNotes();
    notesAfterPlacing(grid, notes, 0, 0, 2);
    const without2 = ALL & ~(1 << 2);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === 0 && c === 0) continue;
        assert.equal(notes[r][c] & (1 << 2), 0, `cell ${r},${c}`);
      }
    }
    assert.equal(notes[1][1] & without2, without2);
  });

  it("clears only the cell's own marks when the note helpers are off", () => {
    const grid = emptyGrid();
    for (let i = 0; i < 9; i++) grid[i][(i * 3 + ((i / 3) | 0)) % 9] = 2;
    const notes = fullNotes();
    notesAfterPlacing(grid, notes, 0, 0, 2, false);
    assert.equal(notes[0][0], 0);
    assert.equal(notes[0][5], ALL, "same row keeps 2");
    assert.equal(notes[8][8], ALL, "nine placed, still kept");
  });

  it("leaves other cells' marks of the digit while fewer than nine are placed", () => {
    const grid = emptyGrid();
    grid[0][0] = 2;
    const notes = fullNotes();
    notesAfterPlacing(grid, notes, 0, 0, 2);
    assert.notEqual(notes[8][8] & (1 << 2), 0);
  });
});

describe("notes helpers", () => {
  it("reports an empty set of marks", () => {
    assert.equal(notesAreEmpty(emptyNotes()), true);
    const notes = emptyNotes();
    notes[3][3] = 1 << 4;
    assert.equal(notesAreEmpty(notes), false);
  });

  it("copies marks without sharing rows", () => {
    const notes = emptyNotes();
    const copy = cloneNotes(notes);
    copy[0][0] = 1 << 1;
    assert.equal(notes[0][0], 0);
  });
});
