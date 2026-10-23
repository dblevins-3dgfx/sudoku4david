// X-Wing and Swordfish: a digit's places in several rows (or columns) lined
// up in the same few columns (or rows).

import type { Coord } from "../game";
import type { Digit, Grid } from "../sudoku";
import { bitCount, combinations, key } from "./board";
import type { Found, Phrase, Removal } from "./types";
import { andList, linesName, removalText } from "./wording";

/** at(b, k) is the cell in base line b, cover line k. */
type At = (b: number, k: number) => Coord;

/**
 * X-Wing (size 2) and Swordfish (size 3). Take `size` rows in which a digit
 * fits only within the same `size` columns. Each of those rows needs the
 * digit once, and no two can use the same column, so between them they fill
 * the digit in every one of those columns. No other cell in those columns can
 * hold it. The same works with rows and columns swapped.
 */
export function fish(grid: Grid, cand: number[][], size: 2 | 3): Found | null {
  for (let d = 1; d <= 9; d++) {
    const bit = 1 << d;
    for (const baseKind of ["row", "column"] as const) {
      // at(b, k) is the cell in base line b, cover line k.
      const at = baseKind === "row" ? (b: number, k: number) => ({ r: b, c: k }) : (b: number, k: number) => ({ r: k, c: b });
      const isOpen = ({ r, c }: Coord) => grid[r][c] === 0;
      const has = ({ r, c }: Coord) => grid[r][c] === 0 && (cand[r][c] & bit) !== 0;
      const bases = baseLines(at, has, size);
      for (const group of combinations(bases, size)) {
        const cover = group.reduce((mask, base) => mask | base.spots, 0);
        if (bitCount(cover) !== size) continue;
        const baseLines = group.map((base) => base.line);
        const coverLines = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((k) => cover & (1 << k));
        const removals = coverRemovals(at, has, baseLines, coverLines, d as Digit);
        if (removals.length === 0) continue;
        const cells = baseLines.flatMap((b) => coverLines.map((k) => at(b, k)).filter(has));
        // The pattern needs d to be out of every other open cell of the base lines.
        const relies = baseLines.flatMap((b) =>
          [0, 1, 2, 3, 4, 5, 6, 7, 8]
            .filter((k) => !(cover & (1 << k)))
            .map((k) => at(b, k))
            .filter(isOpen)
            .map(({ r, c }) => key(r, c, d)),
        );
        // Removals in reading order, so the wording lists them tidily.
        removals.sort((a, b) => a.r * 9 + a.c - (b.r * 9 + b.c));
        return {
          technique: size === 2 ? "x-wing" : "swordfish",
          unit: null,
          cells,
          digits: [d as Digit],
          removals,
          place: null,
          relies,
        };
      }
    }
  }
  return null;
}

/** For each base line with 2..size places for the digit, those places as a mask of cover indices. */
function baseLines(at: At, has: (cell: Coord) => boolean, size: number): { line: number; spots: number }[] {
  const bases: { line: number; spots: number }[] = [];
  for (let b = 0; b < 9; b++) {
    let spots = 0;
    for (let k = 0; k < 9; k++) if (has(at(b, k))) spots |= 1 << k;
    const count = bitCount(spots);
    if (count >= 2 && count <= size) bases.push({ line: b, spots });
  }
  return bases;
}

/** The digit's places in the cover lines outside the base lines. */
function coverRemovals(at: At, has: (cell: Coord) => boolean, bases: number[], covers: number[], d: Digit): Removal[] {
  const removals: Removal[] = [];
  for (const k of covers) {
    for (let b = 0; b < 9; b++) {
      const cell = at(b, k);
      if (!bases.includes(b) && has(cell)) removals.push({ ...cell, digit: d });
    }
  }
  return removals;
}

const phrase: Phrase = (step) => {
  // The pattern's cells all sit in the base lines; the removals sit in the
  // cover lines, outside the base lines. A removal shares a column with the
  // pattern when the base lines are rows.
  const digits = andList(step.digits);
  const rowsBase = step.cells.some((cell) => cell.c === step.removals[0].c && cell.r !== step.removals[0].r);
  const rows = [...new Set(step.cells.map((cell) => cell.r))];
  const columns = [...new Set(step.cells.map((cell) => cell.c))];
  const base = rowsBase ? linesName("row", rows) : linesName("column", columns);
  const cover = rowsBase ? linesName("column", columns) : linesName("row", rows);
  const count = step.technique === "x-wing" ? "two" : "three";
  return `In ${base}, ${digits} can only go in ${cover}. Those ${count} ${rowsBase ? "rows" : "columns"} need their ${digits}s in those ${count} ${rowsBase ? "columns" : "rows"}, so ${cover} get their ${digits}s in ${base}. No other cell in ${cover} can be ${digits}: ${removalText(step.removals)}.`;
};

export const fishPhrases: Record<"x-wing" | "swordfish", Phrase> = { "x-wing": phrase, swordfish: phrase };
