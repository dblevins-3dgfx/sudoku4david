// The step finder (#41): works out the next logical move from the current
// board the way a person would, and says why in plain words. It never guesses
// and never peeks at the solution for the logic. The solution is used only to
// catch a wrong digit the player entered, since every deduction made on top of
// a wrong digit is unreliable.
//
// Candidates come from the digits on the board, not from the player's pencil
// marks, which may be incomplete.
//
// The finder looks for a placement first (a single). When none is visible it
// applies eliminations (pointing, claiming, pairs, triples, X-Wing, Swordfish,
// XY-Wing, X-chains) to its private candidate copy and looks again. It then
// keeps only the eliminations the placement actually depends on, so the
// explanation is a short chain that ends in a digit to write in.
//
// Each technique lives in its own file with its finder and its wording. To add
// one: write the file, add it to `Technique` in types.ts, to ELIMINATIONS
// below (in the order a person would try it), and to PHRASES.

import { isDigit, type Grid } from "../sudoku";
import { boardCandidates, key } from "./board";
import { fish, fishPhrases } from "./fish";
import { claiming, intersectionPhrases, pointing } from "./intersections";
import { hiddenSingle, nakedSingle, singlePhrases } from "./singles";
import { hiddenSubset, nakedSubset, subsetPhrases } from "./subsets";
import type { Advice, Finder, Found, Phrase, Step, Technique } from "./types";
import { cellName } from "./wording";
import { xChain, xChainPhrase } from "./x-chain";
import { xyWing, xyWingPhrase } from "./xy-wing";

// Record<Technique, Phrase> must name every technique, so leaving a new one
// out fails to compile. `...` spreads each file's table into this one.
const PHRASES: Record<Technique, Phrase> = {
  ...singlePhrases,
  ...intersectionPhrases,
  ...subsetPhrases,
  ...fishPhrases,
  "xy-wing": xyWingPhrase,
  "x-chain": xChainPhrase,
};

function describe(step: Found, usesEarlier: boolean): string {
  const earlier = usesEarlier ? " This relies on what the earlier steps ruled out." : "";
  return PHRASES[step.technique](step) + earlier;
}

const ELIMINATIONS: Finder[] = [
  pointing,
  claiming,
  (grid, cand) => nakedSubset(grid, cand, 2),
  (grid, cand) => hiddenSubset(grid, cand, 2),
  (grid, cand) => nakedSubset(grid, cand, 3),
  (grid, cand) => hiddenSubset(grid, cand, 3),
  (grid, cand) => fish(grid, cand, 2),
  (grid, cand) => fish(grid, cand, 3),
  xyWing,
  xChain,
];

/** Keeps only the eliminations the placement depends on, oldest first. */
function trim(found: readonly Found[], last: Found): Found[] {
  const needed = new Set(last.relies);
  const kept: Found[] = [];
  for (let i = found.length - 1; i >= 0; i--) {
    const step = found[i];
    if (!step.removals.some(({ r, c, digit }) => needed.has(key(r, c, digit)))) continue;
    kept.unshift(step);
    for (const k of step.relies) needed.add(k);
  }
  return [...kept, last];
}

function words(chain: readonly Found[]): Step[] {
  const removed = new Set<number>();
  return chain.map(({ relies, ...step }) => {
    const usesEarlier = relies.some((k) => removed.has(k));
    for (const { r, c, digit } of step.removals) removed.add(key(r, c, digit));
    return { ...step, text: describe({ ...step, relies }, usesEarlier) };
  });
}

/**
 * The next logical step for `grid`. `locked` marks givens and hint-filled
 * cells, which are always right; any other filled cell is checked against
 * `solution` first.
 */
export function nextStep(grid: Grid, solution: Grid, locked: boolean[][]): Advice {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const value = grid[r][c];
      if (isDigit(value) && !locked[r][c] && value !== solution[r][c]) {
        return {
          kind: "mistake",
          cell: { r, c },
          digit: value,
          text: `The ${value} in ${cellName({ r, c })} is wrong. Fix it first, because every step that builds on a wrong digit can't be trusted.`,
        };
      }
    }
  }
  if (grid.every((row) => row.every((value) => value !== 0))) return { kind: "solved" };

  const cand = boardCandidates(grid);
  const found: Found[] = [];
  // Each elimination removes at least one of at most 729 candidates, so this
  // loop always ends; the bound is only a guard.
  for (let guard = 0; guard < 729; guard++) {
    const single = hiddenSingle(grid, cand) ?? nakedSingle(grid, cand);
    if (single) return { kind: "steps", steps: words(trim(found, single)) };
    let next: Found | null = null;
    for (const find of ELIMINATIONS) {
      next = find(grid, cand);
      if (next) break;
    }
    if (!next) break;
    for (const { r, c, digit } of next.removals) cand[r][c] &= ~(1 << digit);
    found.push(next);
  }
  return {
    kind: "stuck",
    text: "I can't find the next step with the techniques I know (singles, pointing, claiming, pairs, triples, X-Wing, Swordfish, XY-Wing, and X-chains). This puzzle needs a harder one. Hint can still fill in a cell.",
  };
}

/** The wording of a found pattern, exported for the unit tests. */
export { describe as describeFound };

/** The individual pattern finders, exported for the unit tests. */
export const finders = { hiddenSingle, nakedSingle, pointing, claiming, nakedSubset, hiddenSubset, fish, xyWing, xChain };
