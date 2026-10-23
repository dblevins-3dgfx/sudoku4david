// Explain with the player's notes (#78). The notes are read the same way as
// the "With pointing" fill (#77): per box and per digit, as claims that a
// digit goes only in the cells where it is marked (see noteClaims in
// notes.ts). Explain trusts a claim only after checking it against the
// solution, so it never builds an explanation on a wrong note.

import { applyClaims, noteClaims, type NoteClaim, type Notes } from "../notes";
import type { Grid } from "../sudoku";
import { BOXES, key } from "./board";
import { andList, BOX_NAMES } from "./wording";

export type NoteReading = {
  /** The claims Explain starts from: every one is consistent with the solution. */
  claims: NoteClaim[];
  /** The first claim, in box order then digit order, that leaves out the digit's true cell. */
  wrong: NoteClaim | null;
};

/**
 * Reads the player's notes into claims and checks each against the solution.
 * A claim left with no cells (every mark of the digit was where it can't go,
 * such as a stale mark of a digit since written in the box) is ignored, as if
 * the box had no marks of it.
 */
export function readNotes(grid: Grid, solution: Grid, notes: Notes): NoteReading {
  const claims: NoteClaim[] = [];
  let wrong: NoteClaim | null = null;
  for (const claim of noteClaims(grid, notes)) {
    if (claim.cells.length === 0) continue;
    // Where the solution puts the digit in this box. That cell is empty: a
    // claim with cells means the digit isn't written anywhere in the box yet.
    const home = BOXES[claim.box].cells.find(({ r, c }) => solution[r][c] === claim.digit)!;
    if (claim.cells.some(({ r, c }) => r === home.r && c === home.c)) claims.push(claim);
    else wrong ??= claim;
  }
  return { claims, wrong };
}

/**
 * The starting candidates: the board's candidates narrowed by the claims.
 * Also returns which claim took out each candidate, keyed like `key()`, so a
 * step that relies on one of those can say which notes it used.
 */
export function startFromClaims(
  cand: number[][],
  claims: readonly NoteClaim[],
): { cand: number[][]; source: Map<number, NoteClaim> } {
  const source = new Map<number, NoteClaim>();
  for (const claim of claims) {
    const next = applyClaims(cand, [claim]);
    for (const { r, c } of BOXES[claim.box].cells) {
      if (cand[r][c] !== next[r][c]) source.set(key(r, c, claim.digit), claim);
    }
    cand = next;
  }
  return { cand, source };
}

function claimName({ box, digit }: NoteClaim): string {
  return `your ${digit}s in the ${BOX_NAMES[box]} box`;
}

/** The note added to a step that relies on what the player's notes ruled out. */
export function notesPhrase(used: readonly NoteClaim[]): string {
  return used.length === 0 ? "" : ` This relies on ${andList(used.map(claimName))}.`;
}

/** What Explain says about a wrong claim. It names the box and digit, never the cell. */
export function wrongNotesText(claim: NoteClaim): string {
  const name = claimName(claim);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} leave out the cell where ${claim.digit} goes. Fix those notes, or explain without them.`;
}
