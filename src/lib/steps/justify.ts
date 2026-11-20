// Why a move the player has just made follows from the board, for the
// play-by-play commentary (commentary.ts). Explain (finder.ts) asks "what is
// the next step anywhere?"; this asks a narrower question about one cell and
// one digit: "which steps lead to this digit going here?" or "which steps rule
// this digit out here?". Both run the same elimination finders, in the same
// order, on the board's own candidates. The player's pencil marks are not read
// and the solution is never consulted, so the answer gives nothing away.

import type { Coord } from "../game";
import { cloneGrid, type Digit, type Grid } from "../sudoku";
import { ALL, boardCandidates, key, maskDigits, open, sees, UNITS } from "./board";
import { ELIMINATIONS, trim } from "./finder";
import { hiddenSingle, nakedSingle } from "./singles";
import type { Found } from "./types";

function sameCell(a: Coord, b: Coord): boolean {
  return a.r === b.r && a.c === b.c;
}

/**
 * The single that places `digit` at `cell` on these candidates, if there is
 * one: a hidden single in one of the cell's units (boxes first, as the finder
 * scans them), or else a naked single.
 */
function singleAt(grid: Grid, cand: number[][], cell: Coord, digit: Digit): Found | null {
  const bit = 1 << digit;
  if (!(cand[cell.r][cell.c] & bit)) return null;
  const place = { ...cell, digit };
  for (const unit of UNITS) {
    if (!unit.cells.some((other) => sameCell(other, cell))) continue;
    const cells = open(grid, unit);
    if (cells.filter(({ r, c }) => cand[r][c] & bit).length !== 1) continue;
    return {
      technique: "hidden-single",
      unit,
      cells: [cell],
      digits: [digit],
      removals: [],
      place,
      relies: cells.filter((other) => !sameCell(other, cell)).map(({ r, c }) => key(r, c, digit)),
    };
  }
  if (cand[cell.r][cell.c] !== bit) return null;
  return {
    technique: "naked-single",
    unit: null,
    cells: [cell],
    digits: [digit],
    removals: [],
    place,
    relies: maskDigits(ALL & ~bit).map((d) => key(cell.r, cell.c, d)),
  };
}

/**
 * Applies the eliminations one at a time, as Explain does, and asks `look`
 * after each one whether the question is settled. `look` returns a chain to
 * stop with that answer, null to stop with none, or undefined to go on.
 * (undefined and null are two different "nothing" values in JavaScript; here
 * they mean "not yet" and "never".)
 */
function search(grid: Grid, look: (cand: number[][], found: readonly Found[]) => Found[] | null | undefined): Found[] | null {
  const cand = boardCandidates(grid);
  const found: Found[] = [];
  // Each pass removes at least one of at most 729 candidates; the bound is a guard.
  for (let guard = 0; guard < 729; guard++) {
    const answer = look(cand, found);
    if (answer !== undefined) return answer;
    let next: Found | null = null;
    for (const find of ELIMINATIONS) {
      next = find(grid, cand);
      if (next) break;
    }
    if (!next) return null;
    for (const { r, c, digit } of next.removals) cand[r][c] &= ~(1 << digit);
    found.push(next);
  }
  return null;
}

/**
 * The steps that place `digit` in the empty `cell` of `grid`, ending with the
 * single that places it and keeping only the eliminations it depends on. Null
 * when the digit is not a candidate there, or when the eliminations run out (or
 * rule it out) before a single places it: the move needs other placements
 * first, or it was a guess.
 */
export function whyPlaced(grid: Grid, cell: Coord, digit: Digit): Found[] | null {
  if (grid[cell.r][cell.c] !== 0) return null;
  const bit = 1 << digit;
  return search(grid, (cand, found) => {
    if (!(cand[cell.r][cell.c] & bit)) return null;
    const single = singleAt(grid, cand, cell, digit);
    return single ? trim(found, single) : undefined;
  });
}

/**
 * The steps that rule `digit` out of the empty `cell`, ending with the step
 * that does it: either an elimination that removes it there, or a single that
 * places the same digit in a cell it sees. Null when it is not a candidate
 * there to begin with (the board already rules it out), or when no chain of
 * the finder's techniques reaches it.
 */
export function whyRemoved(grid: Grid, cell: Coord, digit: Digit): Found[] | null {
  const bit = 1 << digit;
  if (grid[cell.r][cell.c] !== 0 || !(boardCandidates(grid)[cell.r][cell.c] & bit)) return null;
  const peers = UNITS.flatMap((unit) => unit.cells).filter(
    (other, i, all) => sees(cell, other) && grid[other.r][other.c] === 0 && all.findIndex((x) => sameCell(x, other)) === i,
  );
  return search(grid, (cand, found) => {
    if (!(cand[cell.r][cell.c] & bit)) {
      // The last elimination took it out.
      return trim(found.slice(0, -1), found[found.length - 1]);
    }
    if (singleAt(grid, cand, cell, digit)) return null;
    for (const peer of peers) {
      const single = singleAt(grid, cand, peer, digit);
      if (single) return trim(found, single);
    }
    return undefined;
  });
}

/**
 * True when `digit` at `cell` becomes a single once other singles are filled
 * in, one at a time, with no other technique: the player is ahead of the
 * board rather than using a harder technique. Singles never place a wrong
 * digit, so this is true only for the solution's digit.
 */
export function followsFromSingles(grid: Grid, cell: Coord, digit: Digit): boolean {
  const work = cloneGrid(grid);
  // Each pass fills one of at most 81 cells.
  for (let guard = 0; guard < 81; guard++) {
    if (work[cell.r][cell.c] !== 0) return false;
    const cand = boardCandidates(work);
    if (singleAt(work, cand, cell, digit)) return true;
    const next = hiddenSingle(work, cand) ?? nakedSingle(work, cand);
    if (!next?.place) return false;
    work[next.place.r][next.place.c] = next.place.digit;
  }
  return false;
}
