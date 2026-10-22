// The input rules that used to live only in the React hook (see play.ts),
// named after the SPEC.md sections they come from.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseEntry, DOUBLE_TAP_MS } from "./entry";
import { createGameFromPuzzle, hint, inputDigit, restart, undo, type Coord, type GameState } from "./game";
import {
  checkResult,
  clearEntriesAction,
  digitAllowed,
  explanationCounts,
  isNewWin,
  keyCommand,
  pressDigit,
  type KeyContext,
  type KeyInput,
} from "./play";
import type { Advice } from "./steps";
import { emptyGrid, createPuzzle, mulberry32, type Digit } from "./sudoku";

const { puzzle, solution } = createPuzzle("easy", mulberry32(8));
const fresh = () => createGameFromPuzzle("easy", puzzle, solution, "generated");
const empties = (game: GameState): Coord[] =>
  game.grid.flatMap((row, r) => row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])));
const at = (game: GameState, cell: Coord): GameState => ({ ...game, selected: cell });

/** Fills cells with `digit` (in its solution places) until nine are on the board. */
function placeAllNine(game: GameState, digit: Digit): GameState {
  for (const cell of empties(game)) {
    if (solution[cell.r][cell.c] === digit) game = inputDigit(at(game, cell), digit);
  }
  return game;
}

describe("Entering digits: a digit with nine copies is ignored", () => {
  it("in numbers mode, in notes mode, and on a cell that holds it", () => {
    const game = placeAllNine(fresh(), 5);
    assert.equal(digitAllowed(game.grid, 5), false);
    assert.equal(digitAllowed(game.grid, 6), true);
    const open = at(game, empties(game)[0]);
    assert.equal(pressDigit(open, 5, false), open);
    assert.equal(pressDigit(open, 5, true), open, "it cannot be added to a mark");

    // Pressing 5 on a cell holding a 5 would normally clear it; not with nine placed.
    const five = empties(fresh()).find((cell) => solution[cell.r][cell.c] === 5)!;
    const onFive = at(game, five);
    assert.equal(pressDigit(onFive, 5, false), onFive);
  });

  it("counts again once a copy is removed", () => {
    const game = placeAllNine(fresh(), 5);
    const five = empties(fresh()).find((cell) => solution[cell.r][cell.c] === 5)!;
    assert.equal(digitAllowed(undo(game).grid, 5), true);
    assert.equal(pressDigit(at(game, five), 6, false).grid[five.r][five.c], 6);
  });
});

describe("Entering digits: one tap, two taps", () => {
  it("marks on the first press, writes on the second, one undo step each", () => {
    const cell = empties(fresh())[0];
    const key = `${cell.r}-${cell.c}`;
    let game = at(fresh(), cell);

    const first = chooseEntry("tap", false, null, 4, key, 1000);
    assert.equal(first.asNote, true);
    game = pressDigit(game, 4, first.asNote);
    assert.equal(game.notes[cell.r][cell.c] & (1 << 4), 1 << 4);

    const second = chooseEntry("tap", false, first.tap, 4, key, 1000 + DOUBLE_TAP_MS - 1);
    assert.equal(second.asNote, false);
    game = pressDigit(game, 4, second.asNote);
    assert.equal(game.grid[cell.r][cell.c], 4);
    assert.equal(game.history.length, 2);

    const back = undo(game);
    assert.equal(back.grid[cell.r][cell.c], 0);
    assert.equal(back.notes[cell.r][cell.c] & (1 << 4), 1 << 4, "one undo after a fill returns the mark");
  });

  it("on a filled cell, the first press does nothing and the second writes or clears", () => {
    const cell = empties(fresh())[0];
    const key = `${cell.r}-${cell.c}`;
    const filled = inputDigit(at(fresh(), cell), 4);
    const first = chooseEntry("tap", false, null, 4, key, 0);
    assert.equal(pressDigit(filled, 4, first.asNote), filled);
    const second = chooseEntry("tap", false, first.tap, 4, key, 10);
    assert.equal(pressDigit(filled, 4, second.asNote).grid[cell.r][cell.c], 0);
  });

  it("with the notes button, the pencil decides and no tap is remembered", () => {
    assert.deepEqual(chooseEntry("button", true, null, 4, "0-0", 0), { asNote: true, tap: null });
    assert.deepEqual(chooseEntry("button", false, null, 4, "0-0", 0), { asNote: false, tap: null });
  });
});

describe("Conflicts: what Check reports", () => {
  it("already solved", () => {
    assert.deepEqual(checkResult(solution, true), { text: "This grid is already solved.", revealConflicts: false });
  });

  it("repeats, and turns conflicts on", () => {
    const one = emptyGrid();
    one[0][0] = 3;
    one[0][1] = 3;
    assert.deepEqual(checkResult(one, false), { text: "2 cells repeat a digit.", revealConflicts: true });
    // A third 3 in the same box clashes with both: three cells.
    one[1][2] = 3;
    assert.deepEqual(checkResult(one, false), { text: "3 cells repeat a digit.", revealConflicts: true });
  });

  it("full but not the solution", () => {
    const swapped = solution.map((row) => row.map((v) => (v === 1 ? 2 : v === 2 ? 1 : v)));
    assert.equal(checkResult(swapped as typeof solution, false).text, "The grid is full, but it isn't the solution.");
  });

  it("open cells, singular and plural", () => {
    const nearly = solution.map((row) => row.slice()) as typeof solution;
    nearly[8][8] = 0;
    assert.equal(checkResult(nearly, false).text, "No repeats yet. One cell is still open.");
    nearly[8][7] = 0;
    assert.equal(checkResult(nearly, false).text, "No repeats yet. 2 cells are still open.");
  });
});

describe("Undo, redo, and clearing: Clear entries", () => {
  it("does nothing before play starts, clears a solved grid at once, and asks otherwise", () => {
    assert.equal(clearEntriesAction(fresh()), "none");
    const started = hint(fresh());
    assert.equal(clearEntriesAction(started), "ask");
    assert.equal(clearEntriesAction({ ...started, won: true }), "now");
    assert.equal(clearEntriesAction(restart(started)), "none");
  });
});

describe("Explaining the next step: when it counts", () => {
  const steps: Advice = { kind: "steps", steps: [] };
  it("counts a step or a wrong digit, once per board", () => {
    assert.equal(explanationCounts(steps, false), true);
    assert.equal(explanationCounts({ kind: "mistake", cell: { r: 0, c: 0 }, digit: 1, text: "" }, false), true);
    assert.equal(explanationCounts(steps, true), false);
  });

  it("does not count when it finds nothing to explain", () => {
    assert.equal(explanationCounts({ kind: "stuck", text: "" }, false), false);
    assert.equal(explanationCounts({ kind: "solved" }, false), false);
  });
});

describe("High scores: only a win made in play is recorded", () => {
  it("records the not-won to won step, not a game that arrives won", () => {
    assert.equal(isNewWin(false, true), true);
    assert.equal(isNewWin(null, true), false, "loaded, synced, or restored already won");
    assert.equal(isNewWin(true, true), false, "still the same win");
    assert.equal(isNewWin(false, false), false);
  });
});

describe("Keyboard", () => {
  const play: KeyContext = { dialogOpen: false, paused: false, won: false, entry: "button", solvingHelp: true };
  const press = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...extra,
  });

  it("ignores H while Solving help is off", () => {
    assert.deepEqual(keyCommand(press("h"), play), { kind: "hint" });
    assert.equal(keyCommand(press("h"), { ...play, solvingHelp: false }), null);
  });

  it("maps the key table during play", () => {
    assert.deepEqual(keyCommand(press("ArrowUp"), play), { kind: "move", dr: -1, dc: 0 });
    assert.deepEqual(keyCommand(press("ArrowRight"), play), { kind: "move", dr: 0, dc: 1 });
    assert.deepEqual(keyCommand(press("7"), play), { kind: "digit", digit: 7 });
    for (const key of ["0", "Backspace", "Delete"]) assert.deepEqual(keyCommand(press(key), play), { kind: "erase" });
    assert.deepEqual(keyCommand(press("N"), play), { kind: "notes" });
    assert.deepEqual(keyCommand(press("p"), play), { kind: "pause" });
    assert.deepEqual(keyCommand(press("h"), play), { kind: "hint" });
    assert.deepEqual(keyCommand(press("u"), play), { kind: "undo" });
    assert.deepEqual(keyCommand(press("y"), play), { kind: "redo" });
    assert.deepEqual(keyCommand(press("z", { metaKey: true }), play), { kind: "undo" });
    assert.deepEqual(keyCommand(press("Z", { ctrlKey: true, shiftKey: true }), play), { kind: "redo" });
    assert.equal(keyCommand(press("Escape"), play), null, "Escape does not pause");
    assert.equal(keyCommand(press("x"), play), null);
  });

  it("ignores N in one tap, two taps, and other Command, Ctrl, or Alt keys", () => {
    assert.equal(keyCommand(press("n"), { ...play, entry: "tap" }), null);
    assert.equal(keyCommand(press("5", { metaKey: true }), play), null);
    assert.equal(keyCommand(press("h", { ctrlKey: true }), play), null);
    assert.equal(keyCommand(press("p", { altKey: true }), play), null);
  });

  it("with a dialog open, only Escape and the undo chord apply", () => {
    const dialog = { ...play, dialogOpen: true };
    assert.deepEqual(keyCommand(press("Escape"), dialog), { kind: "dismiss" });
    assert.deepEqual(keyCommand(press("z", { metaKey: true }), dialog), { kind: "undo" });
    for (const key of ["5", "p", "u", "ArrowUp", "Backspace"]) assert.equal(keyCommand(press(key), dialog), null);
  });

  it("while paused, only P, Escape, and the undo chord", () => {
    const paused = { ...play, paused: true };
    assert.deepEqual(keyCommand(press("p"), paused), { kind: "pause" });
    assert.deepEqual(keyCommand(press("Escape"), paused), { kind: "pause" }, "Escape resumes");
    assert.deepEqual(keyCommand(press("z", { ctrlKey: true }), paused), { kind: "undo" });
    for (const key of ["5", "u", "h", "ArrowUp"]) assert.equal(keyCommand(press(key), paused), null);
  });

  it("after a win, only P among single keys, and the undo chord", () => {
    const won = { ...play, won: true };
    assert.deepEqual(keyCommand(press("p"), won), { kind: "pause" }, "togglePause then refuses a solved grid");
    assert.deepEqual(keyCommand(press("z", { metaKey: true }), won), { kind: "undo" });
    for (const key of ["5", "u", "y", "h", "ArrowUp", "Delete"]) assert.equal(keyCommand(press(key), won), null);
  });
});
