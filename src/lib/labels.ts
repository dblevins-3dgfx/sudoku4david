// The words and counts the game screen shows, worked out from the game state.
// Kept out of the React components so the wording in SPEC.md can be unit
// tested; the components only place these strings on the page.

import type { GameState } from "./game";
import type { Pending } from "./pending";
import { fillPenaltySeconds } from "./notes";
import { formatTime } from "./sudoku";

/** The status line: the phase, or the conflict or open-cell count. */
export function statusText(game: GameState | null, conflictTotal: number, open: number): string {
  if (!game) return "Preparing a grid";
  if (game.won) return "Solved";
  if (game.paused) return "Paused";
  // conflictTotal counts cells and is never 1 (a repeat needs two cells).
  if (game.showMistakes && conflictTotal > 0) return `${conflictTotal} conflicting cells`;
  return open === 1 ? "1 cell open" : `${open} cells open`;
}

/** The first part of the phase line, before the source and error count. */
export function phaseText(game: GameState): string {
  return `${game.won ? "Solved" : game.started ? "Playing" : "Ready"} · ${game.difficulty}`;
}

export function errorsText(errors: number): string {
  return errors === 1 ? "1 error" : `${errors} errors`;
}

export function hintsText(hints: number): string {
  return hints === 0 ? "no hints" : hints === 1 ? "1 hint" : `${hints} hints`;
}

/** The solved panel's line, e.g. "4:05 on hard, 1 hint." */
export function winDetail(hintsUsed: number, elapsedMs: number, difficulty: string): string {
  return `${formatTime(elapsedMs)} on ${difficulty}, ${hintsText(hintsUsed)}.`;
}

/**
 * The notice after Hint, saying which cell it filled, e.g. "Hint: 7 in row 3,
 * column 5." or, when it replaced a wrong digit, "Hint: fixed row 6, column 2
 * from 4 to 9." Null when Hint changed nothing (`after` is then the very same
 * object as `before`, because game functions return their input unchanged
 * when they do nothing). Hint leaves the selection on the cell it filled.
 */
export function hintNotice(before: GameState, after: GameState): string | null {
  if (after === before) return null;
  const { r, c } = after.selected;
  const place = `row ${r + 1}, column ${c + 1}`;
  const was = before.grid[r][c];
  const now = after.grid[r][c];
  return was === 0 ? `Hint: ${now} in ${place}.` : `Hint: fixed ${place} from ${was} to ${now}.`;
}

/** The status-line notice after Fill all notes: the seconds it added. */
export function fillNotice(before: GameState, after: GameState): string | null {
  if (after === before) return null;
  return `Fill all notes: +${fillPenaltySeconds(before.grid, before.notes, after.notes)} s.`;
}

/** What the new-puzzle or Clear entries dialog asks. */
export function pendingCopy(pending: Pending, started: boolean): string {
  if (pending.kind === "restart") return "Clear every number you wrote? The given digits stay.";
  return started ? "Deal a new puzzle? This grid will be replaced." : "Choose a difficulty.";
}

/**
 * A keypad key's badge: how many of the digit are still missing (stopping
 * at 0), whether the key is grayed out, and whether more than nine are placed.
 */
export function keypadBadge(placed: number): { remaining: number; exhausted: boolean; over: boolean } {
  const remaining = Math.max(0, 9 - placed);
  return { remaining, exhausted: remaining === 0, over: placed > 9 };
}
