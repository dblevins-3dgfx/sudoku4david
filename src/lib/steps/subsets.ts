// Naked and hidden pairs and triples: k cells of a unit tied to k digits.

import type { Digit, Grid } from "../sudoku";
import { ALL, bitCount, combinations, key, maskDigits, open, UNITS } from "./board";
import type { Found, Phrase, Removal } from "./types";
import { andList, placeIn, removalText, unitName } from "./wording";

/** k cells in a unit that can hold only k digits between them keep those digits to themselves. */
export function nakedSubset(grid: Grid, cand: number[][], size: 2 | 3): Found | null {
  for (const unit of UNITS) {
    const cells = open(grid, unit);
    const small = cells.filter(({ r, c }) => bitCount(cand[r][c]) >= 2 && bitCount(cand[r][c]) <= size);
    for (const group of combinations(small, size)) {
      const union = group.reduce((mask, { r, c }) => mask | cand[r][c], 0);
      if (bitCount(union) !== size) continue;
      const removals: Removal[] = [];
      for (const cell of cells) {
        if (group.includes(cell)) continue;
        for (const digit of maskDigits(cand[cell.r][cell.c] & union)) removals.push({ ...cell, digit });
      }
      if (removals.length === 0) continue;
      return {
        technique: size === 2 ? "naked-pair" : "naked-triple",
        unit,
        cells: group,
        digits: maskDigits(union),
        removals,
        place: null,
        relies: group.flatMap(({ r, c }) => maskDigits(ALL & ~union).map((d) => key(r, c, d))),
      };
    }
  }
  return null;
}

/** k digits that fit in only k cells of a unit push every other digit out of those cells. */
export function hiddenSubset(grid: Grid, cand: number[][], size: 2 | 3): Found | null {
  for (const unit of UNITS) {
    const cells = open(grid, unit);
    const placesFor = (d: number) => cells.filter(({ r, c }) => cand[r][c] & (1 << d));
    const few: Digit[] = [];
    for (let d = 1; d <= 9; d++) {
      const count = placesFor(d).length;
      if (count >= 2 && count <= size) few.push(d as Digit);
    }
    for (const digits of combinations(few, size)) {
      const spots = cells.filter(({ r, c }) => digits.some((d) => cand[r][c] & (1 << d)));
      if (spots.length !== size) continue;
      const keep = digits.reduce((mask, d) => mask | (1 << d), 0);
      const removals = spots.flatMap((cell) =>
        maskDigits(cand[cell.r][cell.c] & ~keep).map((digit) => ({ ...cell, digit })),
      );
      if (removals.length === 0) continue;
      return {
        technique: size === 2 ? "hidden-pair" : "hidden-triple",
        unit,
        cells: spots,
        digits,
        removals,
        place: null,
        relies: cells
          .filter((cell) => !spots.includes(cell))
          .flatMap(({ r, c }) => digits.map((d) => key(r, c, d))),
      };
    }
  }
  return null;
}

const naked: Phrase = (step) => {
  const unit = unitName(step.unit!);
  const count = step.cells.length === 2 ? "two" : "three";
  return `In ${unit}, ${placeIn(step.unit, step.cells)} can only hold ${andList(step.digits)} between them, so those ${count} digits go there. No other cell in ${unit} can be ${andList(step.digits, "or")}: ${removalText(step.removals)}.`;
};

const hidden: Phrase = (step) => {
  const count = step.cells.length === 2 ? "two" : "three";
  return `In ${unitName(step.unit!)}, ${andList(step.digits)} can only go in ${placeIn(step.unit, step.cells)}. Those ${count} cells must hold them, so nothing else fits there: ${removalText(step.removals)}.`;
};

export const subsetPhrases: Record<"naked-pair" | "naked-triple" | "hidden-pair" | "hidden-triple", Phrase> = {
  "naked-pair": naked,
  "naked-triple": naked,
  "hidden-pair": hidden,
  "hidden-triple": hidden,
};
