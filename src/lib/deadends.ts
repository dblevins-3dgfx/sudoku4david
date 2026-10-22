// The dead-end warning: signs that the board, as it stands, can no longer be
// finished. It reads only the digits on the board, never the solution, so it
// gives away nothing a careful player could not see. Typically it fires a
// few moves after a wrong guess, which is when Restore checkpoint is wanted.

import type { Coord } from "./game";
import { boardCandidates, UNITS } from "./steps/board";
import type { Unit } from "./steps/types";
import { cellName, unitName } from "./steps/wording";
import type { Digit, Grid } from "./sudoku";

export type DeadEnds = {
  /** Empty cells where no digit can go. */
  cells: Coord[];
  /** A digit missing from a row, column, or box that has no empty cell left for it. */
  units: { unit: Unit; digit: Digit }[];
};

/** Every dead end on the board, cells in reading order, then units (boxes, rows, columns). */
export function findDeadEnds(grid: Grid): DeadEnds {
  const cand = boardCandidates(grid);
  const cells: Coord[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && cand[r][c] === 0) cells.push({ r, c });
  }
  const units: DeadEnds["units"] = [];
  for (const unit of UNITS) {
    let present = 0;
    let room = 0; // digits some empty cell of the unit can still take
    let empty = false;
    for (const { r, c } of unit.cells) {
      if (grid[r][c] !== 0) present |= 1 << grid[r][c];
      else {
        empty = true;
        room |= cand[r][c];
      }
    }
    // A full unit with a repeat is a conflict, which Error checking reports.
    if (!empty) continue;
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      if ((present & bit) === 0 && (room & bit) === 0) units.push({ unit, digit: d as Digit });
    }
  }
  return { cells, units };
}

export function hasDeadEnd(found: DeadEnds): boolean {
  return found.cells.length > 0 || found.units.length > 0;
}

/**
 * A 9×9 map of the cells to tint for the dead end the status line names (see
 * deadEndText): every dead cell, or else the empty cells of the first unit
 * with a digit that has no place. Tinting every dead unit at once would flood
 * the board after a bad guess, so only the first is shown.
 */
export function deadEndCells(grid: Grid, found: DeadEnds): boolean[][] {
  const marked = grid.map((row) => row.map(() => false));
  for (const { r, c } of found.cells) marked[r][c] = true;
  const dead = found.units[0];
  if (found.cells.length === 0 && dead) {
    for (const { r, c } of dead.unit.cells) if (grid[r][c] === 0) marked[r][c] = true;
  }
  return marked;
}

/** The status line for the first dead end, or null when there is none. */
export function deadEndText(found: DeadEnds): string | null {
  const cell = found.cells[0];
  if (cell) return `Dead end: ${cellName(cell)} has no candidates.`;
  const dead = found.units[0];
  if (dead) return `Dead end: ${dead.digit} has no place in ${unitName(dead.unit)}.`;
  return null;
}
