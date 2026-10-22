// Shared fixtures for the step finder's tests. The name has no ".test", so
// the test runner doesn't run it on its own; the test files import it.

import { boardCandidates, type Step } from ".";
import { emptyGrid, type Grid } from "../sudoku";

export const ALL = 0b11_1111_1110;

export function bits(...digits: number[]): number {
  return digits.reduce((mask, d) => mask | (1 << d), 0);
}

export function parse(rows: string): Grid {
  return rows
    .trim()
    .split("\n")
    .map((line) => [...line.trim()].map((ch) => (ch === "." ? 0 : Number(ch)))) as Grid;
}

export function lockedFrom(grid: Grid): boolean[][] {
  return grid.map((row) => row.map((value) => value !== 0));
}

// A widely published easy puzzle and its solution.
export const PUZZLE = parse(`
  53..7....
  6..195...
  .98....6.
  8...6...3
  4..8.3..1
  7...2...6
  .6....28.
  ...419..5
  ....8..79
`);
export const SOLUTION = parse(`
  534678912
  672195348
  198342567
  859761423
  426853791
  713924856
  961537284
  287419635
  345286179
`);

/** Every open cell, all digits possible: a blank slate for the pattern tests. */
export function openBoard() {
  return { grid: emptyGrid(), cand: emptyGrid().map((row) => row.map(() => ALL)) };
}

/** Leaves `digit` in only the given columns of row `r`. */
export function onlyIn(cand: number[][], r: number, digit: number, columns: number[]) {
  for (let c = 0; c < 9; c++) if (!columns.includes(c)) cand[r][c] &= ~bits(digit);
}

/** Rebuilds the candidates from the board plus only the chain's own removals. */
export function replay(grid: Grid, steps: Step[]): number[][] {
  const cand = boardCandidates(grid);
  for (const step of steps.slice(0, -1)) {
    for (const { r, c, digit } of step.removals) cand[r][c] &= ~(1 << digit);
  }
  return cand;
}
