import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyClaims,
  candidateNotes,
  cloneNotes,
  emptyNotes,
  fillPenaltySeconds,
  notesAfterPlacing,
  notesAreEmpty,
  notesEqual,
  noteClaims,
  pointingNotes,
} from "./notes";
import type { Digit, Grid } from "./sudoku";

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

describe("Fill all notes: the time penalty", () => {
  const grid = emptyGrid();
  grid[8][8] = 4;

  it("charges one second per mark added or removed, and none for a mark kept", () => {
    const before = emptyNotes();
    const after = emptyNotes();
    before[0][0] = (1 << 1) | (1 << 2); // 1 kept, 2 removed
    after[0][0] = (1 << 1) | (1 << 3) | (1 << 4); // 3 and 4 added
    after[4][4] = 1 << 9; // added
    assert.equal(fillPenaltySeconds(grid, before, after), 4);
  });

  it("charges nothing when no mark changes", () => {
    const notes = emptyNotes();
    notes[2][2] = 1 << 5;
    assert.equal(fillPenaltySeconds(grid, notes, cloneNotes(notes)), 0);
  });

  it("charges only for empty cells", () => {
    const before = emptyNotes();
    before[8][8] = 1 << 4;
    assert.equal(fillPenaltySeconds(grid, before, emptyNotes()), 0);
  });
});

describe("Fill style With pointing: reading the player's marks", () => {
  it("confines a marked digit to its marked cells in that box", () => {
    const grid = emptyGrid();
    const notes = emptyNotes();
    notes[0][0] = 1 << 5;
    notes[1][1] = 1 << 5;
    const claims = noteClaims(grid, notes);
    assert.deepEqual(claims, [{ box: 0, digit: 5, cells: [{ r: 0, c: 0 }, { r: 1, c: 1 }] }]);
    const cand = applyClaims(candidateNotes(grid), claims);
    assert.equal(cand[0][0] & (1 << 5), 1 << 5);
    assert.equal(cand[2][2] & (1 << 5), 0, "another cell of the box");
    assert.equal(cand[0][3] & (1 << 5), 1 << 5, "outside the box");
  });

  it("drops a mark where the digit can't go", () => {
    const grid = emptyGrid();
    grid[0][5] = 5;
    const notes = emptyNotes();
    notes[0][0] = 1 << 5;
    notes[1][1] = 1 << 5;
    assert.deepEqual(noteClaims(grid, notes), [{ box: 0, digit: 5, cells: [{ r: 1, c: 1 }] }]);
  });

  it("makes no claim for a digit not marked in a box", () => {
    const notes = emptyNotes();
    notes[4][4] = 1 << 2;
    assert.deepEqual(noteClaims(emptyGrid(), notes), [{ box: 4, digit: 2, cells: [{ r: 4, c: 4 }] }]);
  });
});

describe("Fill style With pointing: pointing and claiming", () => {
  const bit5 = 1 << 5;

  it("clears a row from a marked pair", () => {
    const notes = emptyNotes();
    notes[0][0] = bit5;
    notes[0][1] = bit5;
    const result = pointingNotes(emptyGrid(), notes);
    for (let c = 3; c < 9; c++) assert.equal(result.notes[0][c] & bit5, 0, `column ${c}`);
    assert.equal(result.notes[1][3] & bit5, bit5);
    assert.equal(result.eliminated, 6);
  });

  it("clears a row from an implicit triple the board makes", () => {
    const grid = emptyGrid();
    // Rows 1 and 2 of the top-left box are full, so its 1, 8, and 9 can only go in row 0.
    [[2, 3, 4], [5, 6, 7]].forEach((digits, i) => digits.forEach((d, c) => (grid[i + 1][c] = d as Digit)));
    const result = pointingNotes(grid, emptyNotes());
    for (const d of [1, 8, 9]) assert.equal(result.notes[0][4] & (1 << d), 0, `digit ${d}`);
    assert.equal(result.notes[1][4] & (1 << 1), 1 << 1);
    assert.equal(result.eliminated, 18);
  });

  it("clears a box from a line confined to it", () => {
    const grid = emptyGrid();
    // Row 0 outside the top-left box is full, so row 0's 1, 8, and 9 sit in that box.
    [2, 3, 4, 5, 6, 7].forEach((d, i) => (grid[0][i + 3] = d as Digit));
    const result = pointingNotes(grid, emptyNotes());
    for (const d of [1, 8, 9]) assert.equal(result.notes[2][2] & (1 << d), 0, `digit ${d}`);
    assert.equal(result.notes[0][0] & (1 << 1), 1 << 1);
    assert.equal(result.eliminated, 18);
  });

  it("repeats until a removal exposes no more", () => {
    const notes = emptyNotes();
    // A 5 pair in row 0 of the top-left box, and 5s in three cells of the top-right box.
    for (const [r, c] of [[0, 0], [0, 1], [0, 6], [1, 6], [1, 7]]) notes[r][c] = bit5;
    const result = pointingNotes(emptyGrid(), notes);
    // The pair clears (0,6), which leaves the top-right box's 5s in row 1, which then clears row 1 of the top-middle box.
    assert.equal(result.notes[0][6] & bit5, 0);
    assert.equal(result.notes[1][4] & bit5, 0);
    assert.equal(result.notes[2][4] & bit5, bit5);
    assert.equal(result.eliminated, 7);
  });

  it("removes nothing when nothing points or claims", () => {
    const result = pointingNotes(emptyGrid(), emptyNotes());
    assert.equal(result.eliminated, 0);
    assert.deepEqual(result.notes, candidateNotes(emptyGrid()));
  });
});
