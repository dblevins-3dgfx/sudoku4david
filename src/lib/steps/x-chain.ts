// X-chains: one digit followed through a chain of strong and weak links.

import type { Coord } from "../game";
import type { Digit, Grid } from "../sudoku";
import { key, open, sees, UNITS } from "./board";
import { searchChains, unwindChain, type ChainGraph, type ChainPath, type StrongOut } from "./chain";
import type { Found, Phrase, Unit } from "./types";
import { capitalize, cellName, removalText, unitName } from "./wording";

const cellId = (cell: Coord) => cell.r * 9 + cell.c;

/**
 * X-chain, for one digit. A strong link is a unit where the digit has exactly
 * two places left: if one isn't the digit, the other is. A weak link is two
 * cells that see each other: if one is the digit, the other isn't. A chain
 * that starts with a strong link, alternates, and ends with a strong link
 * proves that one of its two end cells holds the digit, so no cell that sees
 * both ends can. The shortest such chain with a removal wins; the shortest
 * has three links (Skyscraper, 2-String Kite, Turbot Fish), since one strong
 * link alone is pointing or claiming.
 *
 * `cells` is the chain in order. Its strong links run from cells[2i] to
 * cells[2i+1], and `links` names the unit of each; the weak links join each
 * strong link to the next.
 */
export function xChain(grid: Grid, cand: number[][]): Found | null {
  let best: Found | null = null;
  for (let d = 1; d <= 9; d++) {
    const nodes: Coord[] = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && cand[r][c] & (1 << d)) nodes.push({ r, c });
    const graph = digitGraph(grid, cand, d, nodes);
    for (let start = 0; start < nodes.length; start++) {
      searchChains(
        graph,
        start,
        () => (best ? best.cells.length - 1 : Infinity),
        (path) => {
          const found = chainStep(grid, d, nodes, path);
          if (found && (!best || found.cells.length < best.cells.length)) best = found;
        },
      );
    }
  }
  return best;
}

/**
 * Digit d's links among `nodes`, the open cells where d is still possible. A
 * strong link is a unit with exactly two places for d, labelled with that
 * unit; a weak link is two cells that see each other.
 */
function digitGraph(grid: Grid, cand: number[][], d: number, nodes: readonly Coord[]): ChainGraph<Unit> {
  const index = new Map(nodes.map((cell, i) => [cellId(cell), i]));
  const strong: StrongOut<Unit>[][] = nodes.map(() => []);
  for (const unit of UNITS) {
    const spots = open(grid, unit).filter(({ r, c }) => cand[r][c] & (1 << d));
    if (spots.length !== 2) continue;
    const [a, b] = spots.map((cell) => index.get(cellId(cell))!);
    for (const [x, y] of [[a, b], [b, a]]) {
      // A pair of cells can share a line and a box; one unit names the link.
      if (!strong[x].some((link) => link.to === y)) strong[x].push({ to: y, label: unit });
    }
  }
  const weak = nodes.map((a) => nodes.flatMap((b, j) => (sees(a, b) ? [j] : [])));
  return { strong, weak };
}

/** The X-chain that `path` ends, or null when no cell sees both of its ends. */
function chainStep(grid: Grid, d: number, nodes: readonly Coord[], path: ChainPath<Unit>): Found | null {
  const chain = unwindChain(path);
  if (!chain) return null;
  const cells = chain.nodes.map((i) => nodes[i]);
  const [start, end] = [cells[0], cells[cells.length - 1]];
  const removals = nodes
    .filter((cell, i) => !chain.nodes.includes(i) && sees(cell, start) && sees(cell, end))
    .map((cell) => ({ ...cell, digit: d as Digit }));
  if (removals.length === 0) return null;
  return {
    technique: "x-chain",
    unit: null,
    cells,
    digits: [d as Digit],
    removals,
    place: null,
    // Each strong link needs the digit gone from the rest of its unit.
    relies: chain.labels.flatMap((unit, i) => {
      const [from, to] = [cellId(cells[2 * i]), cellId(cells[2 * i + 1])];
      return open(grid, unit)
        .filter((cell) => cellId(cell) !== from && cellId(cell) !== to)
        .map(({ r, c }) => key(r, c, d));
    }),
    links: chain.labels,
  };
}

export const xChainPhrase: Phrase = (step) => {
  // Strong link i runs from cells[2i] to cells[2i+1] in links[i].
  const d = step.digits[0];
  const names = step.cells.map(cellName);
  const links = (step.links ?? []).map((unit, i) => {
    const [from, to] = [names[2 * i], names[2 * i + 1]];
    const why = `${to} must be, as the only other place for ${d} in ${unitName(unit!)}.`;
    return i === 0 ? `If ${from} isn't ${d}, ${why}` : `Then ${from}, which sees ${names[2 * i - 1]}, isn't ${d}, so ${why}`;
  });
  return `${capitalize(links.join(" "))} So either ${names[0]} or ${names[names.length - 1]} is ${d}, and no cell that sees both can be ${d}: ${removalText(step.removals)}.`;
};
