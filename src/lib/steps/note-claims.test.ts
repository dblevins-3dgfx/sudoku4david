import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextStep, type Advice } from ".";
import { emptyNotes } from "../notes";
import { cloneGrid, createPuzzle, mulberry32, type Digit, type Grid } from "../sudoku";
import { boardCandidates, boxOf } from "./board";
import { readNotes } from "./note-claims";
import { lockedFrom, PUZZLE, SOLUTION } from "./test-helpers";

const bit = (d: number) => 1 << d;

function openCells(grid: Grid) {
  return grid.flatMap((row, r) => row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])));
}

/** An empty cell whose answer is also a candidate in another empty cell of its box. */
function decoyIn(grid: Grid, solution: Grid) {
  const cand = boardCandidates(grid);
  const open = openCells(grid);
  for (const truth of open) {
    const digit = solution[truth.r][truth.c] as Digit;
    const decoy = open.find(
      (cell) =>
        cell !== truth && boxOf(cell.r, cell.c) === boxOf(truth.r, truth.c) && cand[cell.r][cell.c] & bit(digit),
    );
    if (decoy) return { truth, decoy, digit };
  }
  throw new Error("no decoy");
}

/** Right pair-style notes: each open cell's answer, plus every candidate in half the cells. */
function rightNotes(grid: Grid, solution: Grid) {
  const cand = boardCandidates(grid);
  const notes = emptyNotes();
  for (const { r, c } of openCells(grid)) notes[r][c] = bit(solution[r][c]) | ((r + c) % 2 === 0 ? cand[r][c] : 0);
  return notes;
}

describe("Explain uses my notes: reading the notes", () => {
  it("gives today's result when the notes say nothing", () => {
    const without = nextStep(PUZZLE, SOLUTION, lockedFrom(PUZZLE));
    const withEmpty = nextStep(PUZZLE, SOLUTION, lockedFrom(PUZZLE), emptyNotes());
    assert.equal(without.kind, "steps");
    assert.equal(withEmpty.kind, "steps");
    if (without.kind !== "steps" || withEmpty.kind !== "steps") return;
    assert.deepEqual(withEmpty.steps, without.steps);
    assert.equal(without.fromNotes, false);
    assert.equal(withEmpty.fromNotes, true);
  });

  it("reports wrong notes by box and digit, never the cell", () => {
    const { decoy, digit } = decoyIn(PUZZLE, SOLUTION);
    const notes = emptyNotes();
    notes[decoy.r][decoy.c] = bit(digit);
    const advice = nextStep(PUZZLE, SOLUTION, lockedFrom(PUZZLE), notes);
    assert.equal(advice.kind, "wrong-notes");
    if (advice.kind !== "wrong-notes") return;
    assert.equal(advice.box, boxOf(decoy.r, decoy.c));
    assert.equal(advice.digit, digit);
    assert.match(advice.text, new RegExp(`^Your ${digit}s in the [a-z-]+ box leave out the cell where ${digit} goes`));
    assert.doesNotMatch(advice.text, /row|column/);
  });

  it("still names a wrong digit on the board first", () => {
    const { decoy, digit } = decoyIn(PUZZLE, SOLUTION);
    const notes = emptyNotes();
    notes[decoy.r][decoy.c] = bit(digit);
    const grid = cloneGrid(PUZZLE);
    grid[0][2] = 1; // the solution has 4 here
    assert.equal(nextStep(grid, SOLUTION, lockedFrom(PUZZLE), notes).kind, "mistake");
  });

  it("ignores a mark where the digit can't go", () => {
    // Row 1 already holds a 5, so a 5 marked at (0,2) is impossible and claims nothing.
    const notes = emptyNotes();
    notes[0][2] = bit(5);
    assert.deepEqual(readNotes(PUZZLE, SOLUTION, notes), { claims: [], wrong: null });
  });

  it("keeps a right claim, and ignores a stale mark of a digit already in its box", () => {
    const { truth, decoy, digit } = decoyIn(PUZZLE, SOLUTION);
    const notes = emptyNotes();
    notes[truth.r][truth.c] = bit(digit);
    const reading = readNotes(PUZZLE, SOLUTION, notes);
    assert.equal(reading.wrong, null);
    assert.deepEqual(reading.claims, [{ box: boxOf(truth.r, truth.c), digit, cells: [truth] }]);
    const placed = cloneGrid(PUZZLE);
    placed[truth.r][truth.c] = digit;
    const stale = emptyNotes();
    stale[decoy.r][decoy.c] = bit(digit);
    assert.deepEqual(readNotes(placed, SOLUTION, stale), { claims: [], wrong: null });
  });
});

describe("Explain uses my notes: steps", () => {
  it("solves a position it is otherwise stuck on, and names the notes it used", () => {
    const empty = SOLUTION.map((row) => row.map(() => 0)) as Grid;
    const locked = empty.map((row) => row.map(() => false));
    assert.equal(nextStep(empty, SOLUTION, locked).kind, "stuck");
    const notes = emptyNotes();
    notes[0][0] = bit(5); // the top-left box's 5 is at (0,0)
    const advice = nextStep(empty, SOLUTION, locked, notes);
    assert.equal(advice.kind, "steps");
    if (advice.kind !== "steps") return;
    const last = advice.steps[advice.steps.length - 1];
    assert.deepEqual(last.place, { r: 0, c: 0, digit: 5 });
    assert.match(last.text, /This relies on your 5s in the top-left box\./);
  });

  it("does not repeat a claiming step the notes already record", { timeout: 60_000 }, () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked === 0; seed++) {
      const { puzzle, solution } = createPuzzle("hard", mulberry32(seed));
      const locked = lockedFrom(puzzle);
      const grid = cloneGrid(puzzle);
      for (let move = 0; move < 81 && checked === 0; move++) {
        const advice: Advice = nextStep(grid, solution, locked);
        if (advice.kind !== "steps") break;
        const step = advice.steps.find((s) => s.technique === "claiming");
        if (step) {
          // Record the claim in the notes: the digit marked only where the line leaves it in the box.
          const digit = step.digits[0];
          const notes = emptyNotes();
          for (const { r, c } of step.cells) notes[r][c] = bit(digit);
          const again = nextStep(grid, solution, locked, notes);
          assert.equal(again.kind, "steps");
          if (again.kind !== "steps") return;
          const box = boxOf(step.cells[0].r, step.cells[0].c);
          const repeats = again.steps.some(
            (s) => s.technique === "claiming" && s.digits[0] === digit && boxOf(s.cells[0].r, s.cells[0].c) === box,
          );
          assert.equal(repeats, false);
          checked++;
        }
        const last = advice.steps[advice.steps.length - 1];
        grid[last.place!.r][last.place!.c] = last.place!.digit;
      }
    }
    assert.ok(checked > 0, "found a chain with a claiming step");
  });

  it("never contradicts the solution when the notes are right", { timeout: 60_000 }, () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { puzzle, solution } = createPuzzle("expert", mulberry32(seed * 7));
      const locked = lockedFrom(puzzle);
      const grid = cloneGrid(puzzle);
      for (let move = 0; move < 81; move++) {
        const notes = rightNotes(grid, solution);
        const advice = nextStep(grid, solution, locked, notes);
        if (advice.kind !== "steps") {
          assert.notEqual(advice.kind, "wrong-notes");
          break;
        }
        for (const step of advice.steps) {
          for (const { r, c, digit } of step.removals) assert.notEqual(digit, solution[r][c], step.text);
        }
        const { r, c, digit } = advice.steps[advice.steps.length - 1].place!;
        assert.equal(digit, solution[r][c]);
        grid[r][c] = digit;
      }
    }
  });
});
