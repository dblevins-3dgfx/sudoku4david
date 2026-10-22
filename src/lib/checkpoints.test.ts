// Checkpoints (SPEC.md: Checkpoints and the dead-end warning), on one fixed
// easy puzzle so the tests are fast and repeatable.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKPOINT_LIMIT, checkpointsEqual, withoutLast, type Checkpoint } from "./checkpoints";
import {
  createGameFromPuzzle,
  hint,
  inputDigit,
  redo,
  restart,
  restoreCheckpoint,
  saveCheckpoint,
  togglePause,
  undo,
  type Coord,
  type GameState,
} from "./game";
import { deserializeGame } from "./storage";
import { createPuzzle, mulberry32, type Digit } from "./sudoku";

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

const open = empties(fresh());
const wrong = (cell: Coord) => ((solution[cell.r][cell.c] % 9) + 1) as Digit;

/** A game in play: one note, then a checkpoint, then a guess and another move. */
function guessed() {
  const before = inputDigit(at(fresh(), open[0]), 3, true);
  const saved = saveCheckpoint(before);
  const guess = inputDigit(at(saved, open[1]), wrong(open[1]));
  const after = inputDigit(at(guess, open[2]), wrong(open[2]));
  return { before, saved, after };
}

describe("Save checkpoint", () => {
  it("pushes the board without changing it, recording no undo step", () => {
    const { before, saved } = guessed();
    assert.equal(saved.checkpoints.length, 1);
    assert.deepEqual(saved.checkpoints[0].grid, before.grid);
    assert.deepEqual(saved.checkpoints[0].notes, before.notes);
    assert.equal(saved.grid, before.grid);
    assert.equal(saved.history, before.history);
  });

  it("does not start the clock", () => {
    const saved = saveCheckpoint(fresh());
    assert.equal(saved.checkpoints.length, 1);
    assert.equal(saved.started, false);
    assert.equal(saved.timerOn, false);
  });

  it("does nothing when the board matches the top checkpoint, while paused, or after a win", () => {
    const once = saveCheckpoint(fresh());
    assert.equal(saveCheckpoint(once), once);
    const paused = togglePause(fresh());
    assert.equal(saveCheckpoint(paused), paused);
    let won = fresh();
    for (const cell of open) won = inputDigit(at(won, cell), solution[cell.r][cell.c] as Digit);
    assert.equal(saveCheckpoint(won), won);
  });

  it(`keeps at most ${CHECKPOINT_LIMIT}`, () => {
    let game = fresh();
    for (let i = 0; i < CHECKPOINT_LIMIT + 3; i++) {
      game = saveCheckpoint(inputDigit(at(game, open[i]), (1 + (i % 9)) as Digit, true));
    }
    assert.equal(game.checkpoints.length, CHECKPOINT_LIMIT);
  });
});

describe("Restore checkpoint", () => {
  it("puts the top checkpoint's board back and takes it off the stack", () => {
    const { before, after } = guessed();
    const restored = restoreCheckpoint(after);
    assert.deepEqual(restored.grid, before.grid);
    assert.deepEqual(restored.notes, before.notes);
    assert.deepEqual(restored.locked, before.locked);
    assert.equal(restored.checkpoints.length, 0);
  });

  it("is one undo step, and undo brings back both the board and the checkpoint", () => {
    const { after } = guessed();
    const restored = restoreCheckpoint(after);
    assert.equal(restored.history.length, after.history.length + 1);
    const undone = undo(restored);
    assert.deepEqual(undone.grid, after.grid);
    assert.equal(undone.checkpoints.length, 1);
    assert.ok(checkpointsEqual(undone.checkpoints[0], after.checkpoints[0]));
    const redone = redo(undone);
    assert.deepEqual(redone.grid, restored.grid);
    assert.equal(redone.checkpoints.length, 0);
  });

  it("redo takes back off the restored checkpoint even with a newer one saved on top", () => {
    const { after } = guessed();
    const undone = undo(restoreCheckpoint(after)); // the first checkpoint is back on the stack
    const newer = saveCheckpoint(undone); // saving is not a step, so redo is still there
    assert.equal(newer.checkpoints.length, 2);
    assert.equal(newer.future.length, 1);
    const redone = redo(newer);
    assert.equal(redone.checkpoints.length, 1);
    assert.ok(checkpointsEqual(redone.checkpoints[0], newer.checkpoints[1]), "the newer one stays");
  });

  it("withoutLast leaves the stack alone when the checkpoint is not on it", () => {
    const [first] = guessed().after.checkpoints;
    const other: Checkpoint = { ...first, notes: first.notes.map((row) => row.map(() => 2)) };
    assert.deepEqual(withoutLast([first, other], first), [other]);
    assert.deepEqual(withoutLast([other], first), [other]);
  });

  it("keeps the clock running, the error count, and the hint total", () => {
    const { after } = guessed();
    const hinted = hint(after);
    const played = { ...hinted, elapsedMs: 90_000, errors: 2 };
    const restored = restoreCheckpoint(played);
    assert.equal(restored.elapsedMs, 90_000);
    assert.equal(restored.timerOn, true);
    assert.equal(restored.errors, 2);
    assert.equal(restored.hintsUsed, hinted.hintsUsed);
  });

  it("unlocks a cell that a hint locked after the checkpoint", () => {
    const { after } = guessed();
    const hinted = hint(at(after, open[5]));
    assert.equal(hinted.locked[open[5].r][open[5].c], true);
    const restored = restoreCheckpoint(hinted);
    assert.equal(restored.locked[open[5].r][open[5].c], false);
    assert.equal(restored.grid[open[5].r][open[5].c], 0);
  });

  it("does nothing with an empty stack, while paused, or after a win", () => {
    const game = fresh();
    assert.equal(restoreCheckpoint(game), game);
    const paused = togglePause(guessed().after);
    assert.equal(restoreCheckpoint(paused), paused);
    let won = saveCheckpoint(fresh());
    for (const cell of open) won = inputDigit(at(won, cell), solution[cell.r][cell.c] as Digit);
    assert.equal(won.won, true);
    assert.equal(restoreCheckpoint(won), won);
  });

  it("restores nested checkpoints one level at a time", () => {
    const { after } = guessed();
    const deeper = inputDigit(at(saveCheckpoint(after), open[3]), wrong(open[3]));
    const one = restoreCheckpoint(deeper);
    assert.deepEqual(one.grid, after.grid);
    const two = restoreCheckpoint(one);
    assert.deepEqual(two.grid, guessed().before.grid);
  });
});

describe("Checkpoints are dropped by Clear entries, kept in saves", () => {
  it("Clear entries (and Same puzzle) empties the stack", () => {
    assert.equal(restart(guessed().after).checkpoints.length, 0);
  });

  it("a saved game keeps its checkpoints and the checkpoint on a restore step", () => {
    const restored = restoreCheckpoint(saveCheckpoint(guessed().after));
    const loaded = deserializeGame(JSON.parse(JSON.stringify(restored)));
    assert.ok(loaded);
    assert.equal(loaded.checkpoints.length, 1);
    assert.ok(loaded.history.at(-1)?.popped);
    assert.equal(undo(loaded).checkpoints.length, 2);
  });

  it("drops a damaged checkpoint, keeping the rest of the game", () => {
    const game = saveCheckpoint(guessed().after);
    const raw = JSON.parse(JSON.stringify(game)) as GameState & { checkpoints: unknown[] };
    raw.checkpoints.push({ grid: "nope" });
    const bad = JSON.parse(JSON.stringify(raw.checkpoints[0])) as Checkpoint;
    bad.locked[open[0].r][open[0].c] = true; // locked, but empty, so not the solution
    raw.checkpoints.push(bad);
    const loaded = deserializeGame(raw);
    assert.ok(loaded);
    assert.equal(loaded.checkpoints.length, 2);
    assert.deepEqual(loaded.grid, game.grid);
  });

  it("reads a game saved before checkpoints existed with an empty stack", () => {
    const raw = JSON.parse(JSON.stringify(fresh())) as Partial<GameState>;
    delete raw.checkpoints;
    assert.deepEqual(deserializeGame(raw)?.checkpoints, []);
  });
});
