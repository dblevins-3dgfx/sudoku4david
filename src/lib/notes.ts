import type { Coord } from "./game";
import { BOXES, bitCount, boardCandidates, open } from "./steps/board";
import { claiming, pointing } from "./steps/intersections";
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

/**
 * What the player's marks say about one digit in one box: it can go only in
 * `cells`. Marks are read this way, per box and per digit, because pair notes
 * (a digit's two or three spots in a box) are not full candidate lists: a
 * cell marked only "3" does not mean nothing else can go there.
 */
export type NoteClaim = { box: number; digit: Digit; cells: Coord[] };

/**
 * The claims the player's marks make, boxes in order and digits 1-9 within
 * each. A box with no mark of a digit makes no claim about it. A mark where
 * the digit can't go (it is already in the cell's row, column, or box) is
 * dropped, so a claim can end up with no cells at all; that leaves the digit
 * nowhere to go in the box, which is a dead end the player made.
 * The fill style "With pointing" uses this, and so will Explain with notes.
 */
export function noteClaims(grid: Grid, notes: Notes): NoteClaim[] {
  const cand = boardCandidates(grid);
  const claims: NoteClaim[] = [];
  for (const box of BOXES) {
    const cells = open(grid, box);
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      const marked = cells.filter(({ r, c }) => notes[r][c] & bit);
      if (marked.length === 0) continue;
      claims.push({ box: box.index, digit: d as Digit, cells: marked.filter(({ r, c }) => cand[r][c] & bit) });
    }
  }
  return claims;
}

/**
 * Narrows `cand` (candidate bitmasks) to the claims: each claimed digit is
 * cleared from every cell of its box outside the claim. Returns a new array.
 */
export function applyClaims(cand: number[][], claims: readonly NoteClaim[]): number[][] {
  const out = cand.map((row) => row.slice());
  for (const { box, digit, cells } of claims) {
    const bit = 1 << digit;
    for (const { r, c } of BOXES[box].cells) {
      if (!cells.some((cell) => cell.r === r && cell.c === c)) out[r][c] &= ~bit;
    }
  }
  return out;
}

/**
 * The marks the "With pointing" fill style writes, and how many candidates
 * pointing and claiming took off (the fill charges a second for each):
 *
 * 1. every cell's candidates, as candidateNotes gives them;
 * 2. narrowed by the player's own marks (noteClaims), trusted as they are;
 * 3. then pointing and claiming, repeated until neither removes anything.
 *
 * Step 3 uses the step finder's own rules. Each call finds one removal set;
 * applying it can expose the next one, so the loop runs until both find none.
 * It always ends, since every pass clears at least one bit from a finite set.
 */
export function pointingNotes(grid: Grid, notes: Notes): { notes: Notes; eliminated: number } {
  const cand = applyClaims(candidateNotes(grid), noteClaims(grid, notes));
  let eliminated = 0;
  for (;;) {
    const found = pointing(grid, cand) ?? claiming(grid, cand);
    if (!found) break;
    for (const { r, c, digit } of found.removals) cand[r][c] &= ~(1 << digit);
    eliminated += found.removals.length;
  }
  return { notes: cand, eliminated };
}

export function notesEqual(a: Notes, b: Notes): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (a[r][c] !== b[r][c]) return false;
  }
  return true;
}
