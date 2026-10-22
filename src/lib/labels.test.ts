// The screen's wording from SPEC.md.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGameFromPuzzle, hint, inputDigit, togglePause } from "./game";
import { errorsText, hintNotice, hintsText, keypadBadge, pendingCopy, phaseText, statusText, winDetail } from "./labels";
import { conflictCount, createPuzzle, emptyGrid, mulberry32, type Digit } from "./sudoku";

const { puzzle, solution } = createPuzzle("easy", mulberry32(8));
const fresh = () => createGameFromPuzzle("easy", puzzle, solution, "generated");

describe("Screen: the status line", () => {
  it("names the phase, then conflicts, then open cells", () => {
    assert.equal(statusText(null, 0, 81), "Preparing a grid");
    assert.equal(statusText({ ...fresh(), won: true }, 0, 0), "Solved");
    assert.equal(statusText(togglePause(fresh()), 2, 40), "Paused");
    // The count comes from a real board: one repeated pair is two cells.
    const pair = emptyGrid();
    pair[0][0] = 5;
    pair[0][1] = 5;
    assert.equal(conflictCount(pair), 2);
    assert.equal(statusText(fresh(), conflictCount(pair), 40), "2 conflicting cells");
    assert.equal(statusText(fresh(), 3, 40), "3 conflicting cells");
    assert.equal(statusText({ ...fresh(), showMistakes: false }, 3, 40), "40 cells open", "hidden conflicts are not reported");
    assert.equal(statusText(fresh(), 0, 1), "1 cell open");
  });

  it("the phase line names the phase and difficulty, and the error count", () => {
    assert.equal(phaseText(fresh()), "Ready · easy");
    assert.equal(phaseText(hint(fresh())), "Playing · easy");
    assert.equal(phaseText({ ...fresh(), won: true }), "Solved · easy");
    assert.deepEqual([0, 1, 2].map(errorsText), ["0 errors", "1 error", "2 errors"]);
  });
});

describe("Winning: the solved panel", () => {
  it("shows the time, difficulty, and hint count", () => {
    assert.deepEqual([0, 1, 3].map(hintsText), ["no hints", "1 hint", "3 hints"]);
    assert.equal(winDetail(1, 245_000, "hard"), "4:05 on hard, 1 hint.");
  });
});

describe("A new puzzle and Clear entries: what the dialog asks", () => {
  it("depends on whether play has started", () => {
    assert.equal(pendingCopy({ kind: "new" }, true), "Deal a new puzzle? This grid will be replaced.");
    assert.equal(pendingCopy({ kind: "new" }, false), "Choose a difficulty.");
    assert.equal(pendingCopy({ kind: "restart" }, true), "Clear every number you wrote? The given digits stay.");
  });
});

describe("Entering digits: keypad badges", () => {
  it("count what is missing, stop at 0, gray at nine, and flag more than nine", () => {
    assert.deepEqual(keypadBadge(3), { remaining: 6, exhausted: false, over: false });
    assert.deepEqual(keypadBadge(9), { remaining: 0, exhausted: true, over: false });
    assert.deepEqual(keypadBadge(10), { remaining: 0, exhausted: true, over: true });
  });
});

describe("Hints: the notice after Hint", () => {
  it("names the digit and the cell Hint filled", () => {
    const before = fresh();
    const { r, c } = before.selected;
    const after = hint(before);
    assert.deepEqual(after.selected, { r, c }, "createGame selects an empty cell, so Hint fills it");
    assert.equal(hintNotice(before, after), `Hint: ${solution[r][c]} in row ${r + 1}, column ${c + 1}.`);
  });

  it("says what Hint fixed when it replaced a wrong digit", () => {
    const start = fresh();
    const { r, c } = start.selected;
    const wrong = (solution[r][c] % 9) + 1;
    const before = inputDigit(start, wrong as Digit, false);
    const after = hint(before);
    assert.equal(
      hintNotice(before, after),
      `Hint: fixed row ${r + 1}, column ${c + 1} from ${wrong} to ${solution[r][c]}.`,
    );
  });

  it("says nothing when Hint did nothing", () => {
    const paused = togglePause(fresh());
    assert.equal(hintNotice(paused, hint(paused)), null);
  });
});
