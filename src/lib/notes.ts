import { bitCount, boardCandidates } from "./steps/board";
import { digitCounts, type Digit, type Grid } from "./sudoku";

/**
 * Pencil marks, one 9×9 array of bitmasks: bit d (1 << d, for d = 1..9) is set
 * when the cell is marked with digit d. Bit 0 is unused.
 */
export type Notes = number[][];

export function emptyNotes(): Notes {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(0));
}

export function cloneNotes(notes: Notes): Notes {
  return notes.map((row) => row.slice());
}

export function notesAreEmpty(notes: Notes): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (notes[r][c] !== 0) return false;
  }
  return true;
}

/** Removes `digit` from the marks in the row, column, and box of (r, c). */
export function clearDigitNotes(notes: Notes, r: number, c: number, digit: Digit) {
  const bit = 1 << digit;
  for (let i = 0; i < 9; i++) {
    notes[r][i] &= ~bit;
    notes[i][c] &= ~bit;
  }
  const br = ((r / 3) | 0) * 3;
  const bc = ((c / 3) | 0) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) notes[br + i][bc + j] &= ~bit;
  }
}

export function countDigit(grid: Grid, digit: number): number {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (grid[r][c] === digit) count++;
  }
  return count;
}

/** Removes `digit` from every mark on the board. */
export function clearDigitEverywhere(notes: Notes, digit: Digit) {
  const mask = ~(1 << digit);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) notes[r][c] &= mask;
  }
}

/**
 * Tidies the marks after `digit` is written at (r, c), which `grid` already
 * holds: the cell's own marks go. With the note helpers on (`tidy`), `digit`
 * also leaves the marks in its row, column, and box, and once nine copies are
 * on the board it leaves every mark. Changes `notes` in place, so callers pass
 * a copy.
 */
export function notesAfterPlacing(grid: Grid, notes: Notes, r: number, c: number, digit: Digit, tidy = true) {
  notes[r][c] = 0;
  if (!tidy) return;
  clearDigitNotes(notes, r, c, digit);
  if (countDigit(grid, digit) >= 9) clearDigitEverywhere(notes, digit);
}

/**
 * The marks Fill all notes writes: for every empty cell, each digit that is not
 * already in its row, column, or box, worked out from the digits on the board
 * alone (the solution is never consulted). A digit with nine copies on the
 * board is left out everywhere, the same as the keypad refuses it. Filled
 * cells get no marks. Returns a new array.
 */
export function candidateNotes(grid: Grid): Notes {
  const counts = digitCounts(grid);
  let full = 0;
  for (let digit = 1; digit <= 9; digit++) if ((counts[digit] ?? 0) >= 9) full |= 1 << digit;
  return boardCandidates(grid).map((row) => row.map((mask) => mask & ~full));
}

/**
 * The time Fill all notes charges, in seconds: one per mark it adds or removes
 * in an empty cell. A mark the player already had right costs nothing.
 * `before ^ after` (XOR) leaves exactly the bits that changed, so the charge is
 * the population count of that, summed over the empty cells.
 */
export function fillPenaltySeconds(grid: Grid, before: Notes, after: Notes): number {
  let seconds = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (grid[r][c] === 0) seconds += bitCount(before[r][c] ^ after[r][c]);
  }
  return seconds;
}

export function notesEqual(a: Notes, b: Notes): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (a[r][c] !== b[r][c]) return false;
  }
  return true;
}
