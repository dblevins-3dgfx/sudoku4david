// The step finder (#41): works out the next logical move from the current
// board the way a person would, and says why in plain words. It never guesses
// and never peeks at the solution for the logic. The solution is used only to
// catch a wrong digit the player entered, since every deduction made on top of
// a wrong digit is unreliable.
//
// Candidates come from the digits on the board. The player's pencil marks,
// which may be incomplete, are read only when Explain uses my notes is on, and
// then only as per-box claims checked against the solution (note-claims.ts).
//
// The finder looks for a placement first (a single). When none is visible it
// applies eliminations (pointing, claiming, pairs, triples, X-Wing, Swordfish,
// XY-Wing, X-chains, AIC) to its private candidate copy and looks again. It then
// keeps only the eliminations the placement actually depends on, so the
// explanation is a short chain that ends in a digit to write in.
//
// Each technique lives in its own file with its finder and its wording. To add
// one: write the file, add it to `Technique` in types.ts, to ELIMINATIONS
// below (in the order a person would try it), and to PHRASES.

import type { NoteClaim, Notes } from "../notes";
import { isDigit, type Grid } from "../sudoku";
import { aic, aicPhrase } from "./aic";
import { boardCandidates, key } from "./board";
import { fish, fishPhrases } from "./fish";
import { claiming, intersectionPhrases, pointing } from "./intersections";
import { notesPhrase, readNotes, startFromClaims, wrongNotesText } from "./note-claims";
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
  "xy-chain": aicPhrase,
  "w-wing": aicPhrase,
  aic: aicPhrase,
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
  aic,
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

/**
 * Puts the chain into words. `fromNotes` maps each candidate the player's
 * notes took out to the claim that did it, so a step relying on one says so.
 */
function words(chain: readonly Found[], fromNotes: ReadonlyMap<number, NoteClaim>): Step[] {
  const removed = new Set<number>();
  return chain.map(({ relies, ...step }) => {
    const usesEarlier = relies.some((k) => removed.has(k));
    const used = new Set<NoteClaim>();
    for (const k of relies) {
      const claim = fromNotes.get(k);
      if (claim) used.add(claim);
    }
    for (const { r, c, digit } of step.removals) removed.add(key(r, c, digit));
    return { ...step, text: describe({ ...step, relies }, usesEarlier) + notesPhrase([...used]) };
  });
}

/** A filled cell that is not locked and does not match the solution, as advice. */
function findMistake(grid: Grid, solution: Grid, locked: boolean[][]): Advice | null {
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
  return null;
}

/**
 * The next logical step for `grid`. `locked` marks givens and hint-filled
 * cells, which are always right; any other filled cell is checked against
 * `solution` first. With `notes` (Explain uses my notes), the player's marks
 * are read as per-box claims: a wrong one is reported before any step, and
 * the rest narrow the candidates the search starts from.
 */
export function nextStep(grid: Grid, solution: Grid, locked: boolean[][], notes?: Notes): Advice {
  const mistake = findMistake(grid, solution, locked);
  if (mistake) return mistake;
  if (grid.every((row) => row.every((value) => value !== 0))) return { kind: "solved" };

  const reading = notes ? readNotes(grid, solution, notes) : { claims: [], wrong: null };
  if (reading.wrong) {
    const { box, digit } = reading.wrong;
    return { kind: "wrong-notes", box, digit, text: wrongNotesText(reading.wrong) };
  }
  const { cand, source } = startFromClaims(boardCandidates(grid), reading.claims);
  const found: Found[] = [];
  // Each elimination removes at least one of at most 729 candidates, so this
  // loop always ends; the bound is only a guard.
  for (let guard = 0; guard < 729; guard++) {
    const single = hiddenSingle(grid, cand) ?? nakedSingle(grid, cand);
    if (single) return { kind: "steps", steps: words(trim(found, single), source), fromNotes: notes !== undefined };
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
    text: "I can't find the next step with the techniques I know (singles, pointing, claiming, pairs, triples, X-Wing, Swordfish, XY-Wing, X-chains, XY-chains, W-Wings, and AIC). This puzzle needs a harder one. Hint can still fill in a cell.",
  };
}

/** The wording of a found pattern, exported for the unit tests. */
export { describe as describeFound };

/** The individual pattern finders, exported for the unit tests. */
export const finders = { hiddenSingle, nakedSingle, pointing, claiming, nakedSubset, hiddenSubset, fish, xyWing, xChain, aic };
