// The shapes the step finder works with. A `type` here is like a C struct
// declaration: it has no code and vanishes after compiling.

import type { Coord } from "../game";
import type { Digit, Grid } from "../sudoku";

export type UnitKind = "row" | "column" | "box";

/** A row, column, or box, with its nine cells in reading order. */
export type Unit = { kind: UnitKind; index: number; cells: Coord[] };

export type Technique =
  | "hidden-single"
  | "naked-single"
  | "pointing"
  | "claiming"
  | "naked-pair"
  | "hidden-pair"
  | "naked-triple"
  | "hidden-triple"
  | "x-wing"
  | "swordfish"
  | "xy-wing"
  | "x-chain";

/** One candidate taken out: `digit` can no longer go in that cell. */
export type Removal = Coord & { digit: Digit };

export type Step = {
  technique: Technique;
  /**
   * Where the pattern sits. Null for a naked single, and for the patterns
   * that span several rows and columns (X-Wing, Swordfish, XY-Wing, X-chain).
   */
  unit: Unit | null;
  /** The cells that make the pattern (for a single, the cell being filled). */
  cells: Coord[];
  digits: Digit[];
  removals: Removal[];
  /** For an X-chain, the unit of each strong link, in chain order. */
  links?: Unit[];
  /** The digit to write in, on the last step of a chain. */
  place: (Coord & { digit: Digit }) | null;
  text: string;
};

/**
 * What the finder has to say about a position. `steps` always ends with a
 * placement. A tagged union like this is TypeScript's take on a C++
 * std::variant: switch on `kind` and the compiler knows which fields exist.
 */
export type Advice =
  | { kind: "solved" }
  | { kind: "mistake"; cell: Coord; digit: Digit; text: string }
  | { kind: "steps"; steps: Step[] }
  | { kind: "stuck"; text: string };

/**
 * A pattern as a finder reports it, before it is put into words. It is a
 * Step without its text (Omit<T, K> drops fields from a type).
 */
export type Pattern = Omit<Step, "text">;

/**
 * A pattern found on the candidates, before it is put into words. `relies`
 * lists the (cell, digit) candidates whose absence the pattern depends on;
 * that is how the chain is trimmed back to the steps that matter.
 */
export type Found = Pattern & { relies: number[] };

/** A pattern finder: reads the board and the candidates, never changes them. */
export type Finder = (grid: Grid, cand: number[][]) => Found | null;

/** Puts one technique's pattern into words, without the trailing note about earlier steps. */
export type Phrase = (step: Pattern) => string;
