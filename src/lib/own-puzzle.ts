// Checks a puzzle the player brought in (read from a photo, then corrected by
// hand) before it can be played. The game needs the solution up front, for
// Hint, Check, and the win, so a puzzle is playable only when its givens have
// exactly one solution.

import { conflictCount, countClues, countSolutions, solveUnique, type Cell, type Grid } from "./sudoku";

/**
 * The result of the check. In TypeScript a union of object types with a
 * shared literal field (`ok`) works like a tagged union in C: testing
 * `check.ok` tells the compiler which member it has, so `solution` can only
 * be read once `ok` is known to be true.
 */
export type GivensCheck = { ok: true; solution: Grid; message: string } | { ok: false; message: string };

/** Whether `givens` can be played, and the line the photo dialog shows about it. */
export function checkGivens(givens: Grid): GivensCheck {
  const clues = countClues(givens);
  if (clues === 0) return { ok: false, message: "No digits yet. Enter the givens, or try another photo." };
  if (conflictCount(givens) > 0) {
    return { ok: false, message: "A digit repeats in a row, column, or box. Check the cells shown in red." };
  }
  const solutions = countSolutions(givens, 2);
  if (solutions === 0) return { ok: false, message: "These digits have no solution. A given may be misread." };
  if (solutions > 1) return { ok: false, message: "These digits allow more than one solution. A given may be missing." };
  return { ok: true, solution: solveUnique(givens)!, message: `${clues} givens and one solution. Ready to play.` };
}

export type EditKey = { kind: "digit"; digit: Cell } | { kind: "move"; dr: number; dc: number };

/**
 * What a key does on the photo dialog's grid: 1–9 write that digit, 0,
 * Backspace, and Delete clear the cell, and the arrows move the selection.
 * `key` is KeyboardEvent.key, the name the browser gives the key pressed.
 */
export function editKey(key: string): EditKey | null {
  if (/^[0-9]$/.test(key)) return { kind: "digit", digit: Number(key) as Cell };
  if (key === "Backspace" || key === "Delete") return { kind: "digit", digit: 0 };
  const moves: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const move = moves[key];
  return move ? { kind: "move", dr: move[0], dc: move[1] } : null;
}

/** A copy of `grid` with one cell changed, as the photo dialog's grid needs. */
export function setGiven(grid: Grid, r: number, c: number, digit: Cell): Grid {
  return grid.map((row, i) => (i === r ? row.map((value, j) => (j === c ? digit : value)) : row));
}
