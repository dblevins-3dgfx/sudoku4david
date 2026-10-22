// Pointing and claiming: a digit confined to where a box and a line overlap.

import type { Coord } from "../game";
import type { Digit, Grid } from "../sudoku";
import { BOXES, boxOf, key, LINES, open } from "./board";
import type { Found, Phrase } from "./types";
import { andList, BOX_NAMES, removalText, unitName } from "./wording";

/** A box whose candidates for a digit sit on one line clears that digit from the rest of the line. */
export function pointing(grid: Grid, cand: number[][]): Found | null {
  for (const box of BOXES) {
    const cells = open(grid, box);
    for (let d = 1; d <= 9; d++) {
      const spots = cells.filter(({ r, c }) => cand[r][c] & (1 << d));
      if (spots.length < 2) continue;
      for (const line of LINES) {
        const along = line.kind === "row" ? (cell: Coord) => cell.r === line.index : (cell: Coord) => cell.c === line.index;
        if (!spots.every(along)) continue;
        const removals = open(grid, line)
          .filter((cell) => boxOf(cell.r, cell.c) !== box.index && cand[cell.r][cell.c] & (1 << d))
          .map((cell) => ({ ...cell, digit: d as Digit }));
        if (removals.length === 0) continue;
        return {
          technique: "pointing",
          unit: box,
          cells: spots,
          digits: [d as Digit],
          removals,
          place: null,
          relies: cells.filter((cell) => !along(cell)).map(({ r, c }) => key(r, c, d)),
        };
      }
    }
  }
  return null;
}

/** A line whose candidates for a digit sit in one box clears that digit from the rest of the box. */
export function claiming(grid: Grid, cand: number[][]): Found | null {
  for (const line of LINES) {
    const cells = open(grid, line);
    for (let d = 1; d <= 9; d++) {
      const spots = cells.filter(({ r, c }) => cand[r][c] & (1 << d));
      if (spots.length < 2) continue;
      const box = boxOf(spots[0].r, spots[0].c);
      if (!spots.every((cell) => boxOf(cell.r, cell.c) === box)) continue;
      const along = line.kind === "row" ? (cell: Coord) => cell.r === line.index : (cell: Coord) => cell.c === line.index;
      const removals = open(grid, BOXES[box])
        .filter((cell) => !along(cell) && cand[cell.r][cell.c] & (1 << d))
        .map((cell) => ({ ...cell, digit: d as Digit }));
      if (removals.length === 0) continue;
      return {
        technique: "claiming",
        unit: line,
        cells: spots,
        digits: [d as Digit],
        removals,
        place: null,
        relies: cells.filter((cell) => boxOf(cell.r, cell.c) !== box).map(({ r, c }) => key(r, c, d)),
      };
    }
  }
  return null;
}

export const intersectionPhrases: Record<"pointing" | "claiming", Phrase> = {
  pointing: (step) => {
    const [first, second] = step.cells;
    const digits = andList(step.digits);
    const line = first.r === second.r ? `row ${first.r + 1}` : `column ${first.c + 1}`;
    return `In ${unitName(step.unit!)}, ${digits} can only go in ${line}. So ${line} gets its ${digits} inside that box, and no other cell in ${line} can be ${digits}: ${removalText(step.removals)}.`;
  },
  claiming: (step) => {
    const [first] = step.cells;
    const digits = andList(step.digits);
    const unit = unitName(step.unit!);
    const box = `the ${BOX_NAMES[boxOf(first.r, first.c)]} box`;
    return `In ${unit}, ${digits} can only go inside ${box}. So that box gets its ${digits} in ${unit}, and no other cell in the box can be ${digits}: ${removalText(step.removals)}.`;
  },
};
