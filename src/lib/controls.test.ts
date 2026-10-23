import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKPOINT_LIMIT } from "./checkpoints";
import {
  canHint,
  controlStatus,
  deskColumns,
  headerStatus,
  keypadContext,
  keypadKey,
  visibleControls,
  type ControlId,
  type KeypadContext,
} from "./controls";
import { createGame, inputDigit, saveCheckpoint, type GameState } from "./game";
import { DEFAULT_PREFERENCES } from "./prefs";
import { mulberry32, type Digit } from "./sudoku";

const ids = (prefs: Partial<typeof DEFAULT_PREFERENCES>) =>
  visibleControls({ ...DEFAULT_PREFERENCES, ...prefs }).map((control) => control.id);

describe("control panel", () => {
  it("shows eleven controls in order with the notes button", () => {
    assert.deepEqual(
      ids({ entry: "button" }),
      ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "check", "save", "restore", "clear"],
    );
  });

  it("hides only the notes control with one tap, two taps", () => {
    assert.deepEqual(
      ids({ entry: "tap" }),
      ["fill", "erase", "undo", "redo", "hint", "explain", "check", "save", "restore", "clear"],
    );
  });

  it("hides Hint and Explain with Solving help off", () => {
    assert.deepEqual(ids({ solvingHelp: false }), ["notes", "fill", "erase", "undo", "redo", "check", "save", "restore", "clear"]);
  });

  it("hides Check with Error checking off", () => {
    assert.deepEqual(ids({ showConflicts: false }), ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "save", "restore", "clear"]);
  });

  it("keeps the basic controls with every helper off", () => {
    const off = { showConflicts: false, solvingHelp: false, noteHelpers: false, highlighting: false, guessingTools: false };
    assert.deepEqual(ids({ ...off, entry: "tap" }), ["erase", "undo", "redo", "clear"]);
    assert.deepEqual(ids({ ...off, noteHelpers: true, highlighting: true }), ["notes", "fill", "erase", "undo", "redo", "clear"]);
    assert.deepEqual(ids({ ...off, highlighting: true }), ["notes", "erase", "undo", "redo", "clear"]);
  });

  it("hides Save and Restore checkpoint with Guessing tools off", () => {
    assert.deepEqual(ids({ guessingTools: false }), ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "check", "clear"]);
  });

  it("puts up to nine controls in one desktop row and splits more over two", () => {
    assert.equal(deskColumns(7), 7);
    assert.equal(deskColumns(9), 9);
    assert.equal(deskColumns(10), 5);
    assert.equal(deskColumns(11), 6);
  });
});

/** A fresh easy game with the first empty cell selected. */
function freshGame(): GameState {
  const game = createGame("easy", mulberry32(8));
  const index = game.puzzle.flat().indexOf(0);
  return { ...game, selected: { r: (index / 9) | 0, c: index % 9 } };
}

/** The game after the right digit goes into the selected cell: one undo step, started. */
function playedGame(): GameState {
  const game = freshGame();
  return inputDigit(game, game.solution[game.selected.r][game.selected.c] as Digit);
}

const disabledIds = (game: GameState | null, busy = false) =>
  Object.entries(controlStatus({ game, busy, explaining: false }))
    .filter(([, status]) => status.disabled)
    .map(([id]) => id as ControlId);

describe("control state", () => {
  it("turns every control off while no game is loaded, and while one loads", () => {
    const all = ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "check", "save", "restore", "clear"];
    assert.deepEqual(disabledIds(null), all);
    assert.deepEqual(disabledIds(playedGame(), true), all);
  });

  it("a fresh game has nothing to undo, redo, restore, or clear", () => {
    assert.deepEqual(disabledIds(freshGame()), ["undo", "redo", "restore", "clear"]);
  });

  it("undo is available after a move, redo after an undo", () => {
    const game = playedGame();
    assert.equal(controlStatus({ game, busy: false, explaining: false }).undo.disabled, false);
    const undone = { ...game, history: [], future: game.history };
    const status = controlStatus({ game: undone, busy: false, explaining: false });
    assert.equal(status.undo.disabled, true);
    assert.equal(status.redo.disabled, false);
  });

  it("pausing turns off play, undo, redo, Check, and Hint, but not Clear entries", () => {
    const game = { ...playedGame(), paused: true };
    assert.deepEqual(disabledIds(game), ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "check", "save", "restore"]);
  });

  it("after a win, Undo, Check, and Clear entries stay available", () => {
    const game = { ...playedGame(), won: true };
    assert.deepEqual(disabledIds(game), ["notes", "fill", "erase", "redo", "hint", "explain", "save", "restore"]);
  });

  it("Hint names and badges the hints used, only once there are some", () => {
    const game = freshGame();
    assert.deepEqual(controlStatus({ game, busy: false, explaining: false }).hint, { disabled: false });
    const hinted = controlStatus({ game: { ...game, hintsUsed: 2 }, busy: false, explaining: false }).hint;
    assert.deepEqual(hinted, { disabled: false, label: "Hint, 2 used", badge: 2 });
  });

  it("Restore names and badges the checkpoints saved; Save stops at the limit", () => {
    let game = saveCheckpoint(playedGame());
    let status = controlStatus({ game, busy: false, explaining: false });
    assert.deepEqual(status.restore, { disabled: false, label: "Restore checkpoint, 1 saved", badge: 1 });
    assert.equal(status.save.disabled, false);
    const full = Array.from({ length: CHECKPOINT_LIMIT }, () => game.checkpoints[0]);
    game = { ...game, checkpoints: full };
    status = controlStatus({ game, busy: false, explaining: false });
    assert.equal(status.save.disabled, true);
    assert.equal(status.restore.badge, CHECKPOINT_LIMIT);
  });

  it("Notes shows notes mode and Explain an open explanation as pressed", () => {
    const game = { ...freshGame(), notesMode: true };
    const status = controlStatus({ game, busy: false, explaining: true });
    assert.equal(status.notes.pressed, true);
    assert.equal(status.explain.pressed, true);
  });

  it("Hint needs a cell that is empty or wrong", () => {
    const game = freshGame();
    assert.equal(canHint(game), true);
    assert.equal(canHint({ ...game, grid: game.solution }), false);
    assert.equal(canHint({ ...game, paused: true }), false);
    assert.equal(canHint(null), false);
  });
});

describe("header buttons", () => {
  it("pause is off with no game, while loading, and after a win, and reads Resume while paused", () => {
    const game = freshGame();
    assert.equal(headerStatus(game, false, false).pause.disabled, false);
    assert.equal(headerStatus(null, false, false).pause.disabled, true);
    assert.equal(headerStatus(game, true, false).pause.disabled, true);
    assert.equal(headerStatus({ ...game, won: true }, false, false).pause.disabled, true);
    assert.equal(headerStatus({ ...game, paused: true }, false, false).pause.paused, true);
  });

  it("Preferences and High scores wait for a confirmation to close; New puzzle waits for loading", () => {
    const game = freshGame();
    assert.equal(headerStatus(game, false, true).prefs.disabled, true);
    assert.equal(headerStatus(game, false, true).scores.disabled, true);
    assert.equal(headerStatus(game, false, true).newPuzzle.disabled, false);
    assert.equal(headerStatus(game, true, false).newPuzzle.disabled, true);
    assert.equal(headerStatus(game, true, false).scores.disabled, false);
  });
});

describe("keypad", () => {
  const ctx: KeypadContext = {
    entry: "button",
    notesMode: false,
    selectedValue: 0,
    noteMask: 0,
    highlighting: true,
    locked: false,
  };

  it("shows how many are still missing with Board highlighting on, and no count with it off", () => {
    assert.deepEqual(keypadKey(4, 6, ctx), {
      pressed: false,
      disabled: false,
      exhausted: false,
      label: "Enter 4, 3 still missing",
      count: 3,
      over: false,
    });
    const off = keypadKey(4, 6, { ...ctx, highlighting: false });
    assert.equal(off.label, "Enter 4");
    assert.equal(off.count, null);
  });

  it("grays out a digit with all nine placed, highlighting on or off", () => {
    for (const highlighting of [true, false]) {
      const key = keypadKey(4, 9, { ...ctx, highlighting, selectedValue: 4 });
      assert.equal(key.disabled, true);
      assert.equal(key.pressed, false);
      assert.equal(key.label, "Enter 4, all nine placed");
    }
    assert.equal(keypadKey(4, 10, ctx).over, true);
  });

  it("presses the selected cell's digit, or with notes mode its pencil marks", () => {
    assert.equal(keypadKey(4, 1, { ...ctx, selectedValue: 4 }).pressed, true);
    const notes = { ...ctx, noteMask: 1 << 4 };
    assert.equal(keypadKey(4, 1, notes).pressed, false);
    assert.equal(keypadKey(4, 1, { ...notes, notesMode: true }).pressed, true);
    assert.equal(keypadKey(4, 1, { ...notes, entry: "tap" }).pressed, true, "tap entry shows marks without notes mode");
  });

  it("is locked while play is locked", () => {
    assert.equal(keypadKey(4, 1, { ...ctx, locked: true }).disabled, true);
    assert.equal(keypadContext(null, "button", true, false).locked, true);
    assert.equal(keypadContext({ ...freshGame(), paused: true }, "button", true, false).locked, true);
    assert.equal(keypadContext(freshGame(), "button", true, true).locked, true);
    assert.equal(keypadContext(freshGame(), "button", true, false).locked, false);
  });
});
