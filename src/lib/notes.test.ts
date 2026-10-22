import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { candidateNotes, cloneNotes, emptyNotes, notesAfterPlacing, notesAreEmpty, notesEqual } from "./notes";
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

describe("candidate notes for Fill all notes", () => {
  it("marks each empty cell with the digits not in its row, column, or box", () => {
    const grid = emptyGrid();
    grid[0][1] = 1; // same row as (0,0)
    grid[5][0] = 2; // same column
    grid[2][2] = 3; // same box
    grid[8][8] = 4; // unrelated
    const notes = candidateNotes(grid);
    const expected = ALL & ~(1 << 1) & ~(1 << 2) & ~(1 << 3);
    assert.equal(notes[0][0], expected);
    assert.equal(notes[4][4], ALL, "sees none of them");
  });

  it("gives filled cells no marks", () => {
    const grid = emptyGrid();
    grid[3][3] = 7;
    assert.equal(candidateNotes(grid)[3][3], 0);
  });

  it("leaves out a digit that has nine copies, even next to a repeat", () => {
    const grid = emptyGrid();
    // Nine 5s, two of them repeating in row 0, none in row 8, column 8, or the last box.
    for (const [r, c] of [[0, 0], [1, 3], [2, 6], [3, 1], [4, 4], [5, 7], [6, 2], [7, 5], [0, 4]]) grid[r][c] = 5;
    const notes = candidateNotes(grid);
    assert.equal(notes[8][8] & (1 << 5), 0);
    assert.equal(notes[8][8], ALL & ~(1 << 5));
  });

  it("gives a cell with no candidates no marks", () => {
    const grid = emptyGrid();
    for (let c = 1; c < 9; c++) grid[0][c] = c as 1;
    grid[1][0] = 9;
    assert.equal(candidateNotes(grid)[0][0], 0);
  });

  it("compares marks cell by cell", () => {
    const a = emptyNotes();
    const b = emptyNotes();
    assert.equal(notesEqual(a, b), true);
    b[4][4] = 1 << 3;
    assert.equal(notesEqual(a, b), false);
  });
});
