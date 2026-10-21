// Decisions the game screen makes about input: which key does what, what
// Check reports, whether a digit press is allowed, and so on. They used to sit
// inside the React hook in use-game.ts, where only a simulated browser could
// reach them. As plain functions of their inputs they can be unit tested like
// the rest of src/lib, and the hook just carries out what they decide.

import type { Advice } from "./steps";
import { conflictCount, countClues, digitCounts, type Digit, type Grid } from "./sudoku";
import { inputDigit, type GameState } from "./game";
import type { EntryMethod } from "./prefs";

/** False once nine copies of the digit are on the board: the key is ignored. */
export function digitAllowed(grid: Grid, digit: Digit): boolean {
  return (digitCounts(grid)[digit] ?? 0) < 9;
}

/** A digit press: ignored while nine copies are placed, otherwise entered. */
export function pressDigit(state: GameState, digit: Digit, asNote: boolean): GameState {
  return digitAllowed(state.grid, digit) ? inputDigit(state, digit, asNote) : state;
}

/**
 * What Check reports. `revealConflicts` is true when there are repeats, in
 * which case the screen turns conflicts on (and stores that choice) if they
 * were hidden.
 */
export function checkResult(grid: Grid, won: boolean): { text: string; revealConflicts: boolean } {
  if (won) return { text: "This grid is already solved.", revealConflicts: false };
  const conflicts = conflictCount(grid);
  if (conflicts > 0) {
    return {
      text: conflicts === 1 ? "One digit is repeated." : `${conflicts} cells repeat a digit.`,
      revealConflicts: true,
    };
  }
  const open = 81 - countClues(grid);
  if (open === 0) return { text: "The grid is full, but it isn't the solution.", revealConflicts: false };
  return {
    text: open === 1 ? "No repeats yet. One cell is still open." : `No repeats yet. ${open} cells are still open.`,
    revealConflicts: false,
  };
}

/** Clear entries does nothing before play starts, clears a solved grid at once, and otherwise asks. */
export function clearEntriesAction(game: GameState): "none" | "now" | "ask" {
  if (!game.started) return "none";
  return game.won ? "now" : "ask";
}

/**
 * Whether an explanation counts as a hint: only when it found something to
 * say (a step or a wrong digit), and not again for a board already counted.
 */
export function explanationCounts(advice: Advice, alreadyCounted: boolean): boolean {
  return (advice.kind === "steps" || advice.kind === "mistake") && !alreadyCounted;
}

/**
 * True on the render where a game in play becomes won. `wasWon` is null for a
 * game that was just loaded or replaced (a reload, a sync, a backup), so a
 * game that arrives already won is not recorded as a new win.
 */
export function isNewWin(wasWon: boolean | null, won: boolean): boolean {
  return won && wasWon === false;
}

/** The parts of a keyboard event the game looks at (a DOM KeyboardEvent has them all). */
export type KeyInput = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export type KeyContext = {
  dialogOpen: boolean;
  paused: boolean;
  won: boolean;
  entry: EntryMethod;
};

/**
 * What a key asks for. A tagged union, like a C++ std::variant: the `kind`
 * field says which of the shapes below a value has.
 */
export type KeyCommand =
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "dismiss" }
  | { kind: "pause" }
  | { kind: "move"; dr: number; dc: number }
  | { kind: "digit"; digit: Digit }
  | { kind: "erase" }
  | { kind: "notes" }
  | { kind: "hint" };

const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * The keyboard table from SPEC.md. Returns null for a key the game ignores
 * in this context. The undo chord (Command or Ctrl with Z) works even with a
 * dialog open; undo() itself refuses while paused.
 */
export function keyCommand(event: KeyInput, ctx: KeyContext): KeyCommand | null {
  const key = event.key.toLowerCase();
  const chord = event.metaKey || event.ctrlKey;
  if (chord && key === "z") return { kind: event.shiftKey ? "redo" : "undo" };
  if (chord || event.altKey) return null;

  if (event.key === "Escape") {
    if (ctx.dialogOpen) return { kind: "dismiss" };
    return ctx.paused ? { kind: "pause" } : null;
  }
  if (ctx.dialogOpen) return null;
  if (ctx.paused || ctx.won) return key === "p" ? { kind: "pause" } : null;

  const step = ARROW_STEPS[event.key];
  if (step) return { kind: "move", dr: step[0], dc: step[1] };
  if (/^[1-9]$/.test(event.key)) return { kind: "digit", digit: Number(event.key) as Digit };
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") return { kind: "erase" };
  if (key === "n") return ctx.entry === "button" ? { kind: "notes" } : null;
  if (key === "p") return { kind: "pause" };
  if (key === "u") return { kind: "undo" };
  if (key === "y") return { kind: "redo" };
  if (key === "h") return { kind: "hint" };
  return null;
}
