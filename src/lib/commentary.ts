// Play-by-play commentary: one short remark on the status line after a move,
// while the Commentary switch is on (see SPEC.md, "Commentary"). Every
// decision about what to say lives here as plain functions of the game state,
// so it can be unit tested; the hook in use-game.ts only calls them and shows
// the text.
//
// What a remark may know:
// - Technique, progress, and a mark that can't go where it was written come
//   from the digits on the board alone, so they reveal nothing.
// - A placement that clashes, and notes that leave out where a digit really
//   goes, are mistakes. They are reported only while Error checking is on, and
//   notes are named by box and digit, never by cell, as Explain does.
// - A digit that is wrong but clashes with nothing is never called wrong.

import type { Coord, GameState } from "./game";
import { noteClaims, type Notes } from "./notes";
import {
  andList,
  BOX_NAMES,
  BOXES,
  boardCandidates,
  boxOf,
  capitalize,
  cellName,
  TECHNIQUE_NAMES,
  UNITS,
  unitName,
  followsFromSingles,
  whyPlaced,
  whyRemoved,
  type Technique,
  type Unit,
} from "./steps";
import { cloneGrid, countClues, type Digit, type Grid } from "./sudoku";

// A Found (the step finder's record of a pattern) is not exported from
// "./steps", so its shape is taken from whyPlaced's return type: ReturnType
// gives "Found[] | null", NonNullable drops the null, and [number] picks the
// element type, much like decltype on a C++ function call.
type Found = NonNullable<ReturnType<typeof whyPlaced>>[number];

/** How a technique reads inside a sentence, after "after". */
const IN_A_SENTENCE: Record<Technique, string> = {
  "hidden-single": "a hidden single",
  "naked-single": "a naked single",
  pointing: "pointing",
  claiming: "claiming",
  "naked-pair": "a naked pair",
  "hidden-pair": "a hidden pair",
  "naked-triple": "a naked triple",
  "hidden-triple": "a hidden triple",
  "x-wing": "an X-Wing",
  swordfish: "a Swordfish",
  "xy-wing": "an XY-Wing",
  "x-chain": "an X-chain",
  "xy-chain": "an XY-chain",
  "w-wing": "a W-Wing",
  aic: "a chain (AIC)",
};

/**
 * The most eliminations a remark names before its single. A longer chain is
 * one the finder can build but a player is unlikely to have used, so naming it
 * would be noise.
 */
export const MOST_ELIMINATIONS = 2;

function shortChain(chain: Found[] | null): Found[] | null {
  return chain && chain.length - 1 <= MOST_ELIMINATIONS ? chain : null;
}

/** "a 4", but "an 8". */
function aDigit(digit: number): string {
  return `${digit === 8 ? "an" : "a"} ${digit}`;
}

/**
 * ", after pointing and a naked pair", or "" when the chain is one step. An
 * earlier step of the same technique as the last reads "claiming elsewhere".
 */
function afterText(chain: readonly Found[]): string {
  const last = chain[chain.length - 1].technique;
  const earlier = [...new Set(chain.slice(0, -1).map((step) => step.technique))];
  const names = earlier.map((t) => IN_A_SENTENCE[t] + (t === last ? " elsewhere" : ""));
  return names.length === 0 ? "" : `, after ${andList(names)}`;
}

/** The units that hold a cell: its row, column, and box, in that order for wording. */
function unitsOf({ r, c }: Coord): Unit[] {
  const row = UNITS.find((unit) => unit.kind === "row" && unit.index === r)!;
  const column = UNITS.find((unit) => unit.kind === "column" && unit.index === c)!;
  return [row, column, BOXES[boxOf(r, c)]];
}

function sameCell(a: Coord, b: Coord): boolean {
  return a.r === b.r && a.c === b.c;
}

/** The first unit of the cell (row, column, then box) that already holds `digit` elsewhere. */
function unitHolding(grid: Grid, cell: Coord, digit: Digit): { unit: Unit; at: Coord } | null {
  for (const unit of unitsOf(cell)) {
    const at = unit.cells.find((other) => !sameCell(other, cell) && grid[other.r][other.c] === digit);
    if (at) return { unit, at };
  }
  return null;
}

/** What a placement took, e.g. "Hidden single: 7 had only one place left in row 3." */
function placedText(chain: readonly Found[], digit: Digit): string {
  const last = chain[chain.length - 1];
  const head = `${TECHNIQUE_NAMES[last.technique]}${afterText(chain)}`;
  return last.technique === "hidden-single"
    ? `${head}: ${digit} had only one place left in ${unitName(last.unit!)}.`
    : `${head}: ${digit} was the only digit left for ${cellName(last.cells[0])}.`;
}

/**
 * The progress a placement made: the units it finished, the ninth copy of a
 * digit, and the halfway mark. "" when it made none worth a remark.
 */
export function progressText(before: Grid, after: Grid, cell: Coord): string {
  const parts: string[] = [];
  const full = (grid: Grid, unit: Unit) => unit.cells.every(({ r, c }) => grid[r][c] !== 0);
  const finished = unitsOf(cell).filter((unit) => full(after, unit) && !full(before, unit));
  if (finished.length > 0) {
    parts.push(`${capitalize(andList(finished.map(unitName)))} ${finished.length === 1 ? "is" : "are"} done.`);
  }
  const digit = after[cell.r][cell.c];
  const copies = (grid: Grid) => grid.flat().filter((value) => value === digit).length;
  if (digit !== 0 && copies(after) === 9 && copies(before) < 9) parts.push(`That's all nine ${digit}s.`);
  if (countClues(before) < 41 && countClues(after) >= 41) parts.push("Halfway: 41 of 81 filled.");
  return parts.join(" ");
}

/**
 * The remark on writing `digit` into `cell`. `before` is the board just before
 * (the cell may have held another digit); `after` is the board with it.
 */
export function placementRemark(before: Grid, after: Grid, cell: Coord, digit: Digit, checking: boolean): string | null {
  const base = cloneGrid(before);
  base[cell.r][cell.c] = 0;
  if (!(boardCandidates(base)[cell.r][cell.c] & (1 << digit))) {
    if (!checking) return null;
    const clash = unitHolding(after, cell, digit);
    return clash ? `That ${digit} clashes with the ${digit} in ${cellName(clash.at)}.` : null;
  }
  const chain = shortChain(whyPlaced(base, cell, digit));
  const head = chain
    ? placedText(chain, digit)
    : followsFromSingles(base, cell, digit)
      ? "You're ahead of the board: that becomes a single once other singles are filled in."
      : "Nothing on the board forces that yet. It may follow from other moves first, or it's a guess.";
  const progress = progressText(before, after, cell);
  return progress ? `${head} ${progress}` : head;
}

/**
 * The remark on adding or removing one pencil mark in an empty cell.
 * `before` and `after` are that cell's mark bitmasks. A mark added where the
 * digit can't go says why; a mark removed says which technique backs that up,
 * or nothing when none of the finder's techniques does.
 */
export function markRemark(grid: Grid, cell: Coord, before: number, after: number): string | null {
  const changed = before ^ after;
  // Exactly one bit should differ: `x & (x - 1)` clears the lowest set bit, so
  // it is zero only for a power of two.
  if (changed === 0 || (changed & (changed - 1)) !== 0) return null;
  const digit = Math.log2(changed) as Digit;
  if (after & changed) {
    const held = unitHolding(grid, cell, digit);
    if (!held) return null;
    return `${capitalize(unitName(held.unit))} already has ${aDigit(digit)}, so ${digit} can't go in ${cellName(cell)}.`;
  }
  const chain = shortChain(whyRemoved(grid, cell, digit));
  if (!chain) return null;
  const last = chain[chain.length - 1];
  if (last.place) {
    return `${TECHNIQUE_NAMES[last.technique]}${afterText(chain)}: ${digit} must go in ${cellName(last.place)}, so not here.`;
  }
  const where = last.unit ? ` in ${unitName(last.unit)}` : "";
  const earlier = afterText(chain);
  return `${TECHNIQUE_NAMES[last.technique]}${where}${earlier}${earlier ? "," : ""} rules out ${digit} here.`;
}

/** The remark, if any, on a digit press: a placement or a pencil mark. */
export function moveRemark(before: GameState, after: GameState, checking: boolean): string | null {
  if (after === before || after.won) return null;
  const cell = after.selected;
  const was = before.grid[cell.r][cell.c];
  const now = after.grid[cell.r][cell.c];
  if (now !== 0 && now !== was) return placementRemark(before.grid, after.grid, cell, now as Digit, checking);
  if (now === 0 && was === 0) return markRemark(after.grid, cell, before.notes[cell.r][cell.c], after.notes[cell.r][cell.c]);
  return null;
}

/**
 * The remark when the player leaves a box after writing pencil marks in it.
 * `entry` is the notes as they were when the player came into the box (or at
 * the last change to the notes that the player did not type, such as a
 * placement tidying them). Only the digits whose marks in the box changed since
 * are looked at, and they are read as Explain uses my notes reads them: per box
 * and digit (noteClaims). The first remark found is returned:
 *
 * 1. with Error checking on, marks that leave out where the digit goes;
 * 2. marks that leave a digit one place in the box;
 * 3. marks that all sit on one row or column, when that takes the digit out of
 *    an open cell of that line outside the box (pointing).
 */
export function leaveBoxRemark(
  grid: Grid,
  solution: Grid,
  entry: Notes,
  notes: Notes,
  box: number,
  checking: boolean,
): string | null {
  const cells = BOXES[box].cells.filter(({ r, c }) => grid[r][c] === 0);
  const changed = cells.reduce((mask, { r, c }) => mask | (entry[r][c] ^ notes[r][c]), 0);
  const claims = noteClaims(grid, notes).filter(
    (claim) => claim.box === box && changed & (1 << claim.digit) && claim.cells.length > 0,
  );
  const name = BOX_NAMES[box];
  if (checking) {
    for (const { digit, cells: marked } of claims) {
      const home = cells.find(({ r, c }) => solution[r][c] === digit);
      if (home && !marked.some((cell) => sameCell(cell, home))) {
        return `Your ${digit}s in the ${name} box leave out the cell where ${digit} goes.`;
      }
    }
  }
  for (const { digit, cells: marked } of claims) {
    if (marked.length === 1) return `Your notes leave ${digit} only one place in the ${name} box: ${cellName(marked[0])}.`;
  }
  const cand = boardCandidates(grid);
  for (const { digit, cells: marked } of claims) {
    for (const kind of ["row", "column"] as const) {
      const index = kind === "row" ? marked[0].r : marked[0].c;
      if (!marked.every((cell) => (kind === "row" ? cell.r : cell.c) === index)) continue;
      const line = UNITS.find((unit) => unit.kind === kind && unit.index === index)!;
      const outside = line.cells.filter(
        ({ r, c }) => boxOf(r, c) !== box && grid[r][c] === 0 && cand[r][c] & (1 << digit),
      );
      if (outside.length === 0) continue;
      return `Pointing: your ${digit}s in the ${name} box all sit in ${kind} ${index + 1}, so no other cell in ${kind} ${index + 1} can be ${aDigit(digit)}.`;
    }
  }
  return null;
}
