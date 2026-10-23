// The board model the finders share: the 27 units, candidate bitmasks, and
// small helpers on them. A candidate set is a bitmask with bit `d` set for
// digit d, the same layout the notes use (bit 0 unused).

import type { Coord } from "../game";
import { sameGroup, type Digit, type Grid } from "../sudoku";
import type { Unit } from "./types";

export const ALL = 0b11_1111_1110;

export function boxOf(r: number, c: number): number {
  return ((r / 3) | 0) * 3 + ((c / 3) | 0);
}

function buildUnits(): Unit[] {
  const rows: Unit[] = [];
  const columns: Unit[] = [];
  const boxes: Unit[] = [];
  for (let i = 0; i < 9; i++) {
    rows.push({ kind: "row", index: i, cells: Array.from({ length: 9 }, (_, c) => ({ r: i, c })) });
    columns.push({ kind: "column", index: i, cells: Array.from({ length: 9 }, (_, r) => ({ r, c: i })) });
    const top = ((i / 3) | 0) * 3;
    const left = (i % 3) * 3;
    boxes.push({
      kind: "box",
      index: i,
      cells: Array.from({ length: 9 }, (_, k) => ({ r: top + ((k / 3) | 0), c: left + (k % 3) })),
    });
  }
  return [...boxes, ...rows, ...columns];
}

// Boxes first: a person scanning for singles usually starts with the boxes.
export const UNITS = buildUnits();
export const LINES = UNITS.filter((unit) => unit.kind !== "box");
export const BOXES = UNITS.filter((unit) => unit.kind === "box");

/** Packs (cell, digit) into one number, so a Set<number> can hold them. */
export function key(r: number, c: number, digit: number): number {
  return (r * 9 + c) * 10 + digit;
}

export function bitCount(mask: number): number {
  let count = 0;
  for (let m = mask; m !== 0; m &= m - 1) count++;
  return count;
}

export function maskDigits(mask: number): Digit[] {
  const digits: Digit[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) digits.push(d as Digit);
  return digits;
}

export function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i <= items.length - size; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) out.push([items[i], ...rest]);
  }
  return out;
}

/** Candidates for every empty cell from the digits on the board; 0 for filled cells. */
export function boardCandidates(grid: Grid): number[][] {
  const cand = grid.map((row) => row.map((value) => (value === 0 ? ALL : 0)));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const value = grid[r][c];
      if (value === 0) continue;
      const bit = ~(1 << value);
      for (let k = 0; k < 9; k++) {
        cand[r][k] &= bit;
        cand[k][c] &= bit;
      }
      const top = r - (r % 3);
      const left = c - (c % 3);
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) cand[top + dr][left + dc] &= bit;
    }
  }
  return cand;
}

export function open(grid: Grid, unit: Unit): Coord[] {
  return unit.cells.filter(({ r, c }) => grid[r][c] === 0);
}

/** Two different cells that share a row, column, or box. */
export function sees(a: Coord, b: Coord): boolean {
  return (a.r !== b.r || a.c !== b.c) && sameGroup(a.r, a.c, b.r, b.c);
}
