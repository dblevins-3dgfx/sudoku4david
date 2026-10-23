// XY-Wing: three two-candidate cells that force a digit out of a fourth.

import type { Coord } from "../game";
import type { Digit, Grid } from "../sudoku";
import { ALL, bitCount, key, maskDigits, sees } from "./board";
import type { Found, Phrase, Removal } from "./types";
import { capitalize, cellName, removalText } from "./wording";

/**
 * XY-Wing: a pivot cell that can only be x or y sees two pincer cells, one
 * that can only be x or z and one that can only be y or z. Whichever digit the
 * pivot takes, one pincer must be z, so a cell that sees both pincers can't be
 * z. `digits` is [x, y, z].
 */
export function xyWing(grid: Grid, cand: number[][]): Found | null {
  const pairs: Coord[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && bitCount(cand[r][c]) === 2) pairs.push({ r, c });
  }
  for (const pivot of pairs) {
    const pivotMask = cand[pivot.r][pivot.c];
    const [x, y] = maskDigits(pivotMask);
    const wings = pairs.filter((cell) => sees(pivot, cell));
    for (const a of wings) {
      const aMask = cand[a.r][a.c];
      // Pincer A shares x with the pivot, and its other digit z is not y.
      if (!(aMask & (1 << x)) || aMask & (1 << y)) continue;
      const zBit = aMask & ~(1 << x);
      const yzMask = (1 << y) | zBit;
      for (const b of wings) {
        if (cand[b.r][b.c] !== yzMask) continue;
        const z = maskDigits(zBit)[0];
        const removals = pincerRemovals(grid, cand, z, pivot, a, b);
        if (removals.length === 0) continue;
        const allBut = (cell: Coord, mask: number) => maskDigits(ALL & ~mask).map((d) => key(cell.r, cell.c, d));
        return {
          technique: "xy-wing",
          unit: null,
          cells: [pivot, a, b],
          digits: [x, y, z],
          removals,
          place: null,
          relies: [...allBut(pivot, pivotMask), ...allBut(a, aMask), ...allBut(b, yzMask)],
        };
      }
    }
  }
  return null;
}

/** Every open cell other than the pivot that still has z and sees both pincers. */
function pincerRemovals(grid: Grid, cand: number[][], z: Digit, pivot: Coord, a: Coord, b: Coord): Removal[] {
  const removals: Removal[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = { r, c };
      if (grid[r][c] !== 0 || !(cand[r][c] & (1 << z))) continue;
      if (sees(cell, a) && sees(cell, b) && (r !== pivot.r || c !== pivot.c)) removals.push({ ...cell, digit: z });
    }
  }
  return removals;
}

export const xyWingPhrase: Phrase = (step) => {
  const [pivot, a, b] = step.cells.map(cellName);
  const [x, y, z] = step.digits;
  return `${capitalize(pivot)} can only be ${x} or ${y}. It sees ${a}, which can only be ${x} or ${z}, and ${b}, which can only be ${y} or ${z}. If ${pivot} is ${x}, ${a} must be ${z}; if it is ${y}, ${b} must be ${z}. Either way one of those two is ${z}, so no cell that sees both of them can be ${z}: ${removalText(step.removals)}.`;
};
