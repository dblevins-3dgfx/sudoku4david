// Singles: the two ways a digit is placed outright. Every chain the finder
// explains ends with one of these.

import type { Digit, Grid } from "../sudoku";
import { ALL, bitCount, key, maskDigits, open, UNITS } from "./board";
import type { Found, Phrase } from "./types";
import { capitalize, cellName, placeIn, unitName } from "./wording";

/** A digit with only one place left in a row, column, or box. */
export function hiddenSingle(grid: Grid, cand: number[][]): Found | null {
  for (const unit of UNITS) {
    const cells = open(grid, unit);
    for (let d = 1; d <= 9; d++) {
      const spots = cells.filter(({ r, c }) => cand[r][c] & (1 << d));
      if (spots.length !== 1) continue;
      const [spot] = spots;
      const digit = d as Digit;
      return {
        technique: "hidden-single",
        unit,
        cells: [spot],
        digits: [digit],
        removals: [],
        place: { ...spot, digit },
        relies: cells.filter((cell) => cell !== spot).map(({ r, c }) => key(r, c, d)),
      };
    }
  }
  return null;
}

/** A cell with only one candidate left. */
export function nakedSingle(grid: Grid, cand: number[][]): Found | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0 || bitCount(cand[r][c]) !== 1) continue;
      const [digit] = maskDigits(cand[r][c]);
      return {
        technique: "naked-single",
        unit: null,
        cells: [{ r, c }],
        digits: [digit],
        removals: [],
        place: { r, c, digit },
        relies: maskDigits(ALL & ~cand[r][c]).map((d) => key(r, c, d)),
      };
    }
  }
  return null;
}

export const singlePhrases: Record<"hidden-single" | "naked-single", Phrase> = {
  "hidden-single": (step) => {
    const d = step.digits[0];
    return `In ${unitName(step.unit!)}, ${d} can only go in ${placeIn(step.unit, step.cells)}. Every other open cell there already sees ${d === 8 ? "an" : "a"} ${d} in its row, column, or box.`;
  },
  "naked-single": (step) =>
    `${capitalize(cellName(step.cells[0]))} can only be ${step.digits[0]}. Its row, column, and box already hold every other digit.`,
};
