import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { leaveBoxRemark, markRemark, moveRemark, placementRemark, progressText } from "./commentary";
import { createGameFromPuzzle, inputDigit, selectCell } from "./game";
import { emptyNotes } from "./notes";
import { PUZZLE, SOLUTION } from "./steps/test-helpers";
import { cloneGrid, type Cell, type Digit, type Grid } from "./sudoku";

function place(grid: Grid, r: number, c: number, digit: Cell): Grid {
  const next = cloneGrid(grid);
  next[r][c] = digit;
  return next;
}

function remark(r: number, c: number, digit: Digit, checking = true, before = PUZZLE) {
  return placementRemark(before, place(before, r, c, digit), { r, c }, digit, checking);
}

describe("commentary on a placement", () => {
  it("names a hidden single and where", () => {
    assert.equal(remark(0, 5, 8), "Hidden single: 8 had only one place left in the top-middle box.");
  });

  it("names a naked single", () => {
    assert.equal(remark(4, 4, 5), "Naked single: 5 was the only digit left for row 5, column 5.");
  });

  it("names the eliminations a single needed", () => {
    assert.equal(remark(1, 8, 8), "Hidden single, after claiming: 8 had only one place left in column 9.");
    assert.equal(remark(8, 0, 3), "Naked single, after pointing and claiming: 3 was the only digit left for row 9, column 1.");
  });

  it("says the player is ahead when other singles lead there", () => {
    assert.equal(remark(0, 2, 4), "You're ahead of the board: that becomes a single once other singles are filled in.");
  });

  it("does not name a chain longer than two eliminations", () => {
    // whyPlaced finds a six-technique chain for this 9; the remark doesn't use it.
    assert.match(remark(0, 6, 9)!, /^You're ahead of the board/);
  });

  it("never calls a digit that clashes with nothing wrong", () => {
    const text = "Nothing on the board forces that yet. It may follow from other moves first, or it's a guess.";
    assert.equal(remark(0, 2, 1, true), text);
    assert.equal(remark(0, 2, 1, false), text);
  });

  it("names a clash only while Error checking is on", () => {
    assert.equal(remark(0, 2, 5, true), "That 5 clashes with the 5 in row 1, column 1.");
    assert.equal(remark(0, 2, 5, false), null);
  });

  it("judges a replaced digit as if the cell had been empty", () => {
    assert.equal(remark(0, 5, 8, true, place(PUZZLE, 0, 5, 2)), "Hidden single: 8 had only one place left in the top-middle box.");
  });

  it("adds the progress the placement made", () => {
    const before = place(place(SOLUTION, 0, 0, 0), 8, 8, 0);
    assert.equal(
      remark(0, 0, 5, true, before),
      "Hidden single: 5 had only one place left in the top-left box. Row 1, column 1, and the top-left box are done. That's all nine 5s.",
    );
  });
});

describe("progressText", () => {
  it("is empty when nothing was finished", () => {
    assert.equal(progressText(PUZZLE, place(PUZZLE, 0, 5, 8), { r: 0, c: 5 }), "");
  });

  it("names the units it finished, and a ninth copy", () => {
    const one = place(place(SOLUTION, 0, 0, 0), 1, 0, 0);
    assert.equal(progressText(one, place(one, 0, 0, 5), { r: 0, c: 0 }), "Row 1 is done. That's all nine 5s.");
    const two = place(place(place(SOLUTION, 0, 0, 0), 1, 1, 0), 0, 3, 0);
    assert.equal(progressText(two, place(two, 1, 1, 7), { r: 1, c: 1 }), "Row 2 and column 2 are done. That's all nine 7s.");
  });

  it("marks the halfway point once, at 41 of 81", () => {
    // Fill PUZZLE (30 givens) up to 40 from the solution, then add one more.
    const before = cloneGrid(PUZZLE);
    let filled = 30;
    for (let r = 8; r >= 0 && filled < 40; r--) {
      for (let c = 8; c >= 0 && filled < 40; c--) {
        if (before[r][c] === 0) {
          before[r][c] = SOLUTION[r][c];
          filled++;
        }
      }
    }
    assert.match(progressText(before, place(before, 0, 5, 8), { r: 0, c: 5 }), /Halfway: 41 of 81 filled\./);
    const past = place(before, 0, 5, 8);
    assert.doesNotMatch(progressText(past, place(past, 0, 7, 1), { r: 0, c: 7 }), /Halfway/);
  });
});

describe("commentary on a pencil mark", () => {
  const cell = { r: 0, c: 2 };

  it("says why a mark can't go where it was added", () => {
    assert.equal(markRemark(PUZZLE, cell, 0, 1 << 5), "Row 1 already has a 5, so 5 can't go in row 1, column 3.");
    assert.equal(markRemark(PUZZLE, cell, 0, 1 << 6), "The top-left box already has a 6, so 6 can't go in row 1, column 3.");
    assert.equal(markRemark(PUZZLE, { r: 4, c: 1 }, 0, 1 << 6), "Column 2 already has a 6, so 6 can't go in row 5, column 2.");
  });

  it("says nothing about a mark that can go there", () => {
    assert.equal(markRemark(PUZZLE, cell, 0, 1 << 4), null);
  });

  it("names the technique behind a removed mark", () => {
    assert.equal(markRemark(PUZZLE, { r: 0, c: 7 }, 1 << 2, 0), "Pointing in the middle-right box rules out 2 here.");
    assert.equal(markRemark(PUZZLE, { r: 0, c: 8 }, 1 << 4, 0), "Naked single: 4 must go in row 7, column 9, so not here.");
    assert.equal(markRemark(PUZZLE, { r: 1, c: 1 }, 1 << 2, 0), "Pointing in the middle-left box, after a naked triple, rules out 2 here.");
    assert.equal(markRemark(PUZZLE, { r: 3, c: 2 }, 1 << 1, 0), "Claiming in column 2, after claiming elsewhere, rules out 1 here.");
  });

  it("says nothing when no technique backs the removal, or it removed the answer", () => {
    assert.equal(markRemark(PUZZLE, { r: 0, c: 7 }, 1 << 1, 0), null, "1 goes here");
    assert.equal(markRemark(PUZZLE, cell, 1 << 5, 0), null, "the board already rules 5 out");
  });

  it("says nothing unless exactly one mark changed", () => {
    assert.equal(markRemark(PUZZLE, cell, 0, (1 << 5) | (1 << 6)), null);
    assert.equal(markRemark(PUZZLE, cell, 1 << 5, 1 << 5), null);
  });
});

describe("moveRemark", () => {
  const game = createGameFromPuzzle("easy", PUZZLE, SOLUTION, "generated");

  it("comments on a placement", () => {
    const before = selectCell(game, 0, 5);
    assert.equal(moveRemark(before, inputDigit(before, 8, false), true), "Hidden single: 8 had only one place left in the top-middle box.");
  });

  it("comments on a note", () => {
    const before = selectCell(game, 0, 2);
    assert.equal(moveRemark(before, inputDigit(before, 5, true), true), "Row 1 already has a 5, so 5 can't go in row 1, column 3.");
  });

  it("says nothing when nothing changed, a digit was taken out, or the puzzle is won", () => {
    const before = selectCell(game, 0, 5);
    assert.equal(moveRemark(before, before, true), null);
    const placed = inputDigit(before, 8, false);
    assert.equal(moveRemark(placed, inputDigit(placed, 8, false), true), null, "pressing the same digit again erases it");
    const last = { ...selectCell(createGameFromPuzzle("easy", place(SOLUTION, 0, 5, 0), SOLUTION, "generated"), 0, 5) };
    last.locked = last.locked.map((row) => row.map(() => false));
    assert.equal(moveRemark(last, inputDigit(last, 8, false), true), null);
  });
});

describe("commentary on leaving a box", () => {
  function marks(...cells: [number, number, number][]) {
    const notes = emptyNotes();
    for (const [r, c, d] of cells) notes[r][c] |= 1 << d;
    return notes;
  }

  it("points out marks that sit on one line and clear it", () => {
    const notes = marks([0, 2, 4], [1, 2, 4]);
    assert.equal(
      leaveBoxRemark(PUZZLE, SOLUTION, emptyNotes(), notes, 0, true),
      "Pointing: your 4s in the top-left box all sit in column 3, so no other cell in column 3 can be a 4.",
    );
    assert.equal(
      leaveBoxRemark(PUZZLE, SOLUTION, emptyNotes(), marks([1, 1, 2], [1, 2, 2]), 0, true),
      "Pointing: your 2s in the top-left box all sit in row 2, so no other cell in row 2 can be a 2.",
    );
  });

  it("says when the marks leave a digit one place", () => {
    assert.equal(
      leaveBoxRemark(PUZZLE, SOLUTION, emptyNotes(), marks([1, 2, 2]), 0, true),
      "Your notes leave 2 only one place in the top-left box: row 2, column 3.",
    );
  });

  it("names wrong marks by box and digit, only while Error checking is on", () => {
    const wrong = marks([1, 1, 2]); // the 2 goes in row 2, column 3
    assert.equal(
      leaveBoxRemark(PUZZLE, SOLUTION, emptyNotes(), wrong, 0, true),
      "Your 2s in the top-left box leave out the cell where 2 goes.",
    );
    assert.equal(
      leaveBoxRemark(PUZZLE, SOLUTION, emptyNotes(), wrong, 0, false),
      "Your notes leave 2 only one place in the top-left box: row 2, column 2.",
    );
  });

  it("looks only at digits whose marks changed in that box", () => {
    const notes = marks([0, 2, 4], [1, 2, 4]);
    assert.equal(leaveBoxRemark(PUZZLE, SOLUTION, notes, notes, 0, true), null);
    assert.equal(leaveBoxRemark(PUZZLE, SOLUTION, emptyNotes(), notes, 1, true), null);
  });

  it("says nothing when the marks rule out nothing", () => {
    // Every 4 in the top-left box's open cells: no single line holds them all.
    const all = marks([0, 2, 4], [1, 1, 4], [1, 2, 4], [2, 0, 4]);
    assert.equal(leaveBoxRemark(PUZZLE, SOLUTION, emptyNotes(), all, 0, true), null);
  });
});
