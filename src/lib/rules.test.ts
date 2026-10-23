// Rules from SPEC.md that the other test files did not cover. Each describe()
// block is named after the spec section it checks, so a failure points at the
// sentence that no longer holds.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGameFromPuzzle,
  erase,
  fillNotes,
  restoreCheckpoint,
  saveCheckpoint,
  hint,
  inputDigit,
  moveSelection,
  redo,
  restart,
  selectCell,
  togglePause,
  undo,
  type Coord,
  type GameState,
} from "./game";
import { fillPenaltySeconds, pointingNotes } from "./notes";
import { deserializeGame } from "./storage";
import { cloneGrid, createPuzzle, emptyGrid, mulberry32, type Digit, type Grid } from "./sudoku";

// One fixed easy puzzle keeps these tests fast and repeatable.
const { puzzle, solution } = createPuzzle("easy", mulberry32(8));

function fresh(): GameState {
  return createGameFromPuzzle("easy", puzzle, solution, "generated");
}

function empties(game: GameState): Coord[] {
  return game.grid.flatMap((row, r) => row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])));
}

function at(game: GameState, cell: Coord): GameState {
  return { ...game, selected: cell };
}

function sameGroup(a: Coord, b: Coord): boolean {
  return a.r === b.r || a.c === b.c || (Math.floor(a.r / 3) === Math.floor(b.r / 3) && Math.floor(a.c / 3) === Math.floor(b.c / 3));
}

const bit = (digit: number) => 1 << digit;

function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/** Whether `digit` is a candidate for `cell` in the fresh puzzle. */
function candidateMask(cell: Coord, digit: number): boolean {
  return !puzzle.some((row, r) => row.some((v, c) => v === digit && sameGroup(cell, { r, c })));
}

function boxIndex({ r, c }: Coord): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

/** The first candidate for `cell` in the fresh puzzle. */
function candidate(cell: Coord): Digit {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => candidateMask(cell, d)) as Digit;
}

describe("Board: a win is the generated solution, not just a legal grid", () => {
  it("does not count a different full, legal grid as solved", () => {
    // Swapping two digits everywhere in a solved grid gives another legal
    // grid. Start from an empty puzzle so every cell can be written.
    const swapped = solution.map((row) => row.map((v) => (v === 1 ? 2 : v === 2 ? 1 : v))) as Grid;
    let game = createGameFromPuzzle("easy", emptyGrid(), solution, "generated");
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) game = inputDigit(at(game, { r, c }), swapped[r][c] as Digit);
    }
    assert.equal(game.won, false);
    assert.equal(game.grid.flat().includes(0), false);
  });
});

describe("Generating a puzzle: the first selected cell", () => {
  it("starts on the first empty cell in reading order", () => {
    assert.deepEqual(fresh().selected, empties(fresh())[0]);
  });
});

describe("Entering digits", () => {
  it("arrow moves wrap around the board", () => {
    const game = at(fresh(), { r: 0, c: 0 });
    assert.deepEqual(moveSelection(game, -1, 0).selected, { r: 8, c: 0 });
    assert.deepEqual(moveSelection(game, 0, -1).selected, { r: 0, c: 8 });
    assert.deepEqual(moveSelection(at(game, { r: 8, c: 8 }), 1, 1).selected, { r: 0, c: 0 });
  });

  it("ignores a note on a filled cell", () => {
    const cell = empties(fresh())[0];
    const filled = inputDigit(at(fresh(), cell), 5);
    assert.equal(inputDigit(filled, 3, true), filled);
  });

  it("writing a digit clears it from notes in its row, column, and box only", () => {
    const open = empties(fresh());
    const place = open[0];
    const peer = open.find((cell) => cell !== place && sameGroup(cell, place))!;
    const far = open.find((cell) => !sameGroup(cell, place))!;
    const digit = solution[place.r][place.c] as Digit;
    let game = inputDigit(at(fresh(), peer), digit, true);
    game = inputDigit(at(game, far), digit, true);
    game = inputDigit(at(game, place), digit);
    assert.equal(game.notes[peer.r][peer.c] & bit(digit), 0);
    assert.equal(game.notes[far.r][far.c] & bit(digit), bit(digit));
  });

  it("with Note helpers off, writing a digit clears only that cell's own notes, and undo returns them", () => {
    const open = empties(fresh());
    const place = open[0];
    const peer = open.find((cell) => cell !== place && sameGroup(cell, place))!;
    const digit = solution[place.r][place.c] as Digit;
    let game = inputDigit(at(fresh(), peer), digit, true);
    game = inputDigit(at(game, place), 4, true);
    const before = game;
    game = inputDigit(game, digit, false, false);
    assert.equal(game.notes[place.r][place.c], 0);
    assert.equal(game.notes[peer.r][peer.c] & bit(digit), bit(digit));
    assert.deepEqual(undo(game).notes, before.notes);
  });

  it("erase clears the digit and notes, and does nothing on a locked or blank cell", () => {
    const game = fresh();
    const given = { r: puzzle.findIndex((row) => row.some((v) => v !== 0)), c: 0 };
    given.c = puzzle[given.r].findIndex((v) => v !== 0);
    const onGiven = at(game, given);
    assert.equal(erase(onGiven), onGiven);

    const cell = empties(game)[0];
    const onBlank = at(game, cell);
    assert.equal(erase(onBlank), onBlank, "an empty, unmarked cell records no step");

    const noted = inputDigit(inputDigit(at(game, cell), 2, true), 6, true);
    const wiped = erase(noted);
    assert.equal(wiped.notes[cell.r][cell.c], 0);
    assert.equal(wiped.history.length, noted.history.length + 1);
  });
});

describe("Entering digits: Fill all notes", () => {
  it("replaces every empty cell's marks with its candidates as one undo step", () => {
    const open = empties(fresh());
    const marked = inputDigit(at(fresh(), open[0]), 9, true);
    const before = inputDigit(at(marked, open[1]), 8, true);
    const filled = fillNotes(before);
    assert.equal(filled.history.length, before.history.length + 1);
    for (const { r, c } of open) {
      const allowed = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (d) => !puzzle.some((row, rr) => row.some((v, cc) => v === d && sameGroup({ r, c }, { r: rr, c: cc }))),
      );
      assert.equal(filled.notes[r][c], allowed.reduce((mask, d) => mask | bit(d), 0), `cell ${r},${c}`);
    }
    assert.deepEqual(undo(filled).notes, before.notes);
  });

  it("starts the clock but charges no hint and no error", () => {
    const game = fillNotes(fresh());
    assert.equal(game.started, true);
    assert.equal(game.timerOn, true);
    assert.equal(game.hintsUsed, 0);
    assert.equal(game.errors, 0);
  });

  it("leaves filled cells unmarked and their digits alone", () => {
    const cell = empties(fresh())[0];
    const game = fillNotes(inputDigit(at(fresh(), cell), solution[cell.r][cell.c] as Digit));
    assert.equal(game.notes[cell.r][cell.c], 0);
    assert.equal(game.grid[cell.r][cell.c], solution[cell.r][cell.c]);
  });

  it("does nothing while paused, after a win, or when the marks already match", () => {
    const paused = togglePause(fresh());
    assert.equal(fillNotes(paused), paused);
    const once = fillNotes(fresh());
    assert.equal(fillNotes(once), once);
    let won = fresh();
    for (const cell of empties(fresh())) won = inputDigit(at(won, cell), solution[cell.r][cell.c] as Digit);
    assert.equal(fillNotes(won), won);
  });
});

describe("Fill all notes: the time penalty", () => {
  it("adds one second per mark added or removed, and none for a correct mark kept", () => {
    const open = empties(fresh());
    const cell = open[0];
    const right = candidate(cell);
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !candidateMask(cell, d))!;
    const marked = inputDigit(inputDigit(at(fresh(), cell), right, true), wrong as Digit, true);
    const filled = fillNotes(marked);
    // Every candidate mark is new except `right`, and `wrong` is removed.
    const added = open.reduce((n, { r, c }) => n + popcount(filled.notes[r][c]), 0) - 1;
    assert.equal(filled.elapsedMs - marked.elapsedMs, (added + 1) * 1000);
  });

  it("is not refunded by undo, redo, or Restore checkpoint", () => {
    const cell = empties(fresh())[0];
    const started = inputDigit(at(fresh(), cell), candidate(cell), true);
    const saved = saveCheckpoint(started);
    const filled = fillNotes(saved);
    assert.ok(filled.elapsedMs > 0);
    assert.equal(undo(filled).elapsedMs, filled.elapsedMs);
    assert.equal(redo(undo(filled)).elapsedMs, filled.elapsedMs);
    assert.equal(restoreCheckpoint(filled).elapsedMs, filled.elapsedMs);
  });
});

describe("Fill style With pointing", () => {
  it("charges a second per mark changed plus one per candidate pointing or claiming took off", () => {
    const before = fresh();
    const plain = fillNotes(before, "plain");
    const pointed = fillNotes(before, "pointing");
    const { eliminated } = pointingNotes(before.grid, before.notes);
    assert.ok(eliminated > 0, "this puzzle has pointing to do");
    const changed = fillPenaltySeconds(before.grid, before.notes, pointed.notes);
    assert.equal(pointed.elapsedMs - before.elapsedMs, (changed + eliminated) * 1000);
    assert.equal(pointed.history.length, before.history.length + 1);
    assert.deepEqual(fillNotes(before).notes, plain.notes, "Plain is the default");
  });

  it("trusts a wrong mark, so the fill leaves out where the digit really goes", () => {
    const game = fresh();
    // Find an empty cell and a decoy in its box where the cell's answer is also a candidate.
    const open = empties(game);
    const pair = open
      .map((truth) => {
        const digit = solution[truth.r][truth.c] as Digit;
        const decoy = open.find(
          (cell) => cell !== truth && boxIndex(cell) === boxIndex(truth) && candidateMask(cell, digit),
        );
        return decoy ? { truth, digit, decoy } : null;
      })
      .find((found) => found !== null);
    assert.ok(pair, "some box has a decoy cell for its digit");
    const { truth, digit, decoy } = pair;
    const marked = inputDigit(at(game, decoy), digit, true);
    const filled = fillNotes(marked, "pointing");
    assert.equal(filled.notes[truth.r][truth.c] & bit(digit), 0);
    assert.equal(filled.notes[decoy.r][decoy.c] & bit(digit), bit(digit));
  });
});

describe("Hints", () => {
  it("fills the selected cell when it is empty or wrong", () => {
    const cell = empties(fresh())[5];
    const wrongDigit = ((solution[cell.r][cell.c] % 9) + 1) as Digit;
    for (const start of [at(fresh(), cell), inputDigit(at(fresh(), cell), wrongDigit)]) {
      const game = hint(start);
      assert.deepEqual(game.selected, cell);
      assert.equal(game.grid[cell.r][cell.c], solution[cell.r][cell.c]);
      assert.equal(game.locked[cell.r][cell.c], true);
    }
  });

  it("otherwise fills the first qualifying cell in reading order", () => {
    const open = empties(fresh());
    // A correct entry in the selected cell does not qualify.
    const right = inputDigit(at(fresh(), open[3]), solution[open[3].r][open[3].c] as Digit);
    assert.deepEqual(hint(right).selected, open[0]);
  });

  it("clears its digit from notes in the same row, column, and box", () => {
    const open = empties(fresh());
    const place = open[0];
    const peer = open.find((cell) => cell !== place && sameGroup(cell, place))!;
    const digit = solution[place.r][place.c] as Digit;
    const game = hint(at(inputDigit(at(fresh(), peer), digit, true), place));
    assert.equal(game.notes[peer.r][peer.c] & bit(digit), 0);
  });

  it("with Note helpers off, leaves its digit in other cells' notes", () => {
    const open = empties(fresh());
    const place = open[0];
    const peer = open.find((cell) => cell !== place && sameGroup(cell, place))!;
    const digit = solution[place.r][place.c] as Digit;
    const game = hint(at(inputDigit(at(fresh(), peer), digit, true), place), true, false);
    assert.equal(game.grid[place.r][place.c], digit);
    assert.equal(game.notes[peer.r][peer.c] & bit(digit), bit(digit));
  });

  it("does nothing while paused, after a win, or when every unlocked cell is right", () => {
    const paused = togglePause(fresh());
    assert.equal(hint(paused), paused);

    let game = fresh();
    for (const cell of empties(fresh())) game = inputDigit(at(game, cell), solution[cell.r][cell.c] as Digit);
    assert.equal(game.won, true);
    assert.equal(hint(game), game);

    // All right but one cell open: hint fills that one; then nothing is left.
    const last = empties(fresh()).at(-1)!;
    let nearly = fresh();
    for (const cell of empties(fresh())) {
      if (cell !== last) nearly = inputDigit(at(nearly, cell), solution[cell.r][cell.c] as Digit);
    }
    assert.deepEqual(hint(nearly).selected, last);
  });
});

describe("Undo, redo, and clearing", () => {
  it("a new step drops the redo stack", () => {
    const cell = empties(fresh())[0];
    const undone = undo(inputDigit(at(fresh(), cell), 4, true));
    assert.equal(undone.future.length, 1);
    assert.equal(inputDigit(undone, 5, true).future.length, 0);
  });

  it("undo and redo do nothing while paused", () => {
    const cell = empties(fresh())[0];
    const played = togglePause(inputDigit(at(fresh(), cell), 4, true));
    assert.equal(undo(played), played);
    const undone = togglePause(undo(togglePause(played)));
    assert.equal(redo(undone), undone);
  });

  it("undo back to the original puzzle reads 0:00 and does not run", () => {
    const cell = empties(fresh())[0];
    const played = { ...inputDigit(at(fresh(), cell), 4, true), elapsedMs: 42_000 };
    assert.equal(played.started, true);
    const back = undo(played);
    assert.equal(back.started, false);
    assert.equal(back.elapsedMs, 0);
    assert.equal(back.timerOn, false);
  });

  it("Clear entries keeps the givens and resets the selection", () => {
    const cell = empties(fresh())[4];
    const game = restart(inputDigit(at(fresh(), cell), 4, true));
    assert.deepEqual(game.grid, puzzle);
    assert.deepEqual(game.selected, empties(fresh())[0]);
    assert.equal(game.elapsedMs, 0);
  });
});

describe("Timer and pause", () => {
  it("pause stops the clock; resume restarts it only if play had started", () => {
    const unstarted = togglePause(togglePause(fresh()));
    assert.equal(unstarted.paused, false);
    assert.equal(unstarted.timerOn, false);

    const cell = empties(fresh())[0];
    const started = inputDigit(at(fresh(), cell), 4, true);
    const paused = togglePause(started);
    assert.equal(paused.timerOn, false);
    assert.equal(togglePause(paused).timerOn, true);
  });

  it("the grid ignores selection and entry while paused", () => {
    const paused = togglePause(fresh());
    assert.equal(selectCell(paused, 8, 8), paused);
    assert.equal(moveSelection(paused, 1, 0), paused);
    assert.equal(inputDigit(paused, 4), paused);
    assert.equal(erase(paused), paused);
  });

  it("pause is unavailable after a win", () => {
    let game = fresh();
    for (const cell of empties(fresh())) game = inputDigit(at(game, cell), solution[cell.r][cell.c] as Digit);
    assert.equal(game.won, true);
    assert.equal(game.timerOn, false);
    assert.equal(togglePause(game), game);
  });
});

describe("What is remembered: a saved game is checked before it is used", () => {
  const saved = () => JSON.parse(JSON.stringify(fresh())) as Record<string, unknown> & GameState;

  it("reads a record with no source as generated", () => {
    const raw = saved();
    delete (raw as Partial<GameState>).source;
    assert.equal(deserializeGame(raw)?.source, "generated");
  });

  it("rejects a solution that is not complete and conflict-free", () => {
    const raw = saved();
    raw.solution = cloneGrid(raw.solution);
    raw.solution[0][0] = raw.solution[0][1];
    assert.equal(deserializeGame(raw), null);
  });

  it("rejects a given that disagrees with the solution or is not locked", () => {
    const given = { r: 0, c: puzzle[0].findIndex((v) => v !== 0) };
    assert.ok(given.c >= 0, "the fixture has a given in row 1");

    const wrong = saved();
    wrong.puzzle[given.r][given.c] = ((solution[given.r][given.c] % 9) + 1) as Digit;
    assert.equal(deserializeGame(wrong), null);

    const unlocked = saved();
    unlocked.locked[given.r][given.c] = false;
    assert.equal(deserializeGame(unlocked), null);
  });

  it("rejects a locked cell that does not match the solution", () => {
    const cell = empties(fresh())[0];
    const raw = saved();
    raw.locked[cell.r][cell.c] = true;
    assert.equal(deserializeGame(raw), null);
  });

  it("rejects an unknown difficulty or a malformed record", () => {
    assert.equal(deserializeGame({ ...saved(), difficulty: "impossible" }), null);
    assert.equal(deserializeGame({ ...saved(), grid: [[1, 2, 3]] }), null);
    assert.equal(deserializeGame("not a game"), null);
  });
});
