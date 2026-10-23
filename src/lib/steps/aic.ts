// Alternating inference chains (AIC): the X-chain idea with more than one
// digit. XY-chains and W-Wings are named shapes of the same thing.

import type { Coord } from "../game";
import type { Digit, Grid } from "../sudoku";
import { ALL, bitCount, key, maskDigits, open, sees, UNITS } from "./board";
import { searchChains, unwindChain, type ChainGraph, type ChainPath, type StrongOut } from "./chain";
import type { Found, Phrase, Technique, Unit } from "./types";
import { capitalize, cellName, removalText, unitName } from "./wording";

/** A candidate: `digit` is still possible in the cell. */
type Node = Coord & { digit: Digit };

const sameCell = (a: Coord, b: Coord) => a.r === b.r && a.c === b.c;
const nodeId = (n: Node) => key(n.r, n.c, n.digit);

/** At most one of the two can be true: one cell with two digits, or one digit in two cells that see each other. */
function weak(a: Node, b: Node): boolean {
  return sameCell(a, b) ? a.digit !== b.digit : a.digit === b.digit && sees(a, b);
}

/**
 * AIC. A node is a candidate. A strong link joins two nodes of which at least
 * one is true: the two digits left in a cell, or the two places left for a
 * digit in a unit. A weak link joins two nodes of which at most one is true
 * (see `weak`). A chain that starts with a strong link, alternates, and ends
 * with a strong link makes one of its two end nodes true. So any candidate
 * that is weakly linked to both ends is false.
 *
 * The search is searchChains (chain.ts), the same breadth-first search the
 * X-chain uses, run over candidates instead of cells: the shortest chain that
 * removes something wins. It runs after X-chains, so a single-digit chain is
 * already found there.
 *
 * `nodes` is the chain in order; strong link i runs from nodes[2i] to
 * nodes[2i+1], and `links[i]` is its unit, or null for a cell link.
 */
export function aic(grid: Grid, cand: number[][]): Found | null {
  const nodes: Node[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) for (const digit of maskDigits(cand[r][c])) nodes.push({ r, c, digit });
    }
  }
  const graph = candidateGraph(grid, cand, nodes);

  let best: Found | null = null;
  let bestLength = Infinity;
  const nearStart = new Uint8Array(nodes.length);
  for (let s = 0; s < nodes.length; s++) {
    if (graph.strong[s].length === 0) continue;
    // nearStart[j] is set when node j is weakly linked to the start, so a
    // possible removal at the far end is a quick lookup.
    nearStart.fill(0);
    for (const j of graph.weak[s]) nearStart[j] = 1;
    searchChains(
      graph,
      s,
      () => bestLength,
      (path) => {
        if (!graph.weak[path.at].some((j) => nearStart[j])) return;
        const found = chainStep(grid, cand, nodes, path);
        if (!found) return;
        bestLength = path.length;
        best = found;
      },
    );
  }
  return best;
}

/**
 * The links among the candidates in `nodes`, numbered by their place in it.
 * A strong link is labelled with its unit, or null when it joins the two
 * digits of a two-candidate cell.
 */
function candidateGraph(grid: Grid, cand: number[][], nodes: readonly Node[]): ChainGraph<Unit | null> {
  const index = new Map(nodes.map((node, i) => [nodeId(node), i]));
  const strong: StrongOut<Unit | null>[][] = nodes.map(() => []);
  const addStrong = (a: Node, b: Node, unit: Unit | null) => {
    const [i, j] = [index.get(nodeId(a))!, index.get(nodeId(b))!];
    for (const [x, y] of [[i, j], [j, i]]) {
      if (!strong[x].some((link) => link.to === y)) strong[x].push({ to: y, label: unit });
    }
  };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0 || bitCount(cand[r][c]) !== 2) continue;
      const [x, y] = maskDigits(cand[r][c]);
      addStrong({ r, c, digit: x }, { r, c, digit: y }, null);
    }
  }
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const spots = open(grid, unit).filter(({ r, c }) => cand[r][c] & (1 << d));
      if (spots.length === 2) addStrong({ ...spots[0], digit: d as Digit }, { ...spots[1], digit: d as Digit }, unit);
    }
  }
  // Each node's weak neighbours, listed once so the search walks plain
  // arrays instead of rescanning every candidate at each step.
  const weakOut = nodes.map((a) => nodes.flatMap((b, j) => (weak(a, b) ? [j] : [])));
  return { strong, weak: weakOut };
}

/** The AIC that `path` ends, or null when nothing clashes with both of its ends. */
function chainStep(grid: Grid, cand: number[][], nodes: readonly Node[], path: ChainPath<Unit | null>): Found | null {
  const unwound = unwindChain(path);
  if (!unwound) return null;
  const chain = unwound.nodes.map((i) => nodes[i]);
  const links = unwound.labels;
  const [start, end] = [chain[0], chain[chain.length - 1]];
  const removals = nodes.filter((node, i) => !unwound.nodes.includes(i) && weak(node, start) && weak(node, end));
  if (removals.length === 0) return null;
  return {
    technique: shape(chain, links, cand),
    unit: null,
    cells: chain.filter((node, i) => i === 0 || !sameCell(node, chain[i - 1])).map(({ r, c }) => ({ r, c })),
    digits: [...new Set(chain.map((node) => node.digit))].sort((a, b) => a - b),
    removals,
    place: null,
    relies: links.flatMap((unit, i) => {
      const [a, b] = [chain[2 * i], chain[2 * i + 1]];
      // A cell link needs every other digit gone from the cell; a unit
      // link needs the digit gone from the rest of the unit.
      if (!unit) return maskDigits(ALL & ~((1 << a.digit) | (1 << b.digit))).map((d) => key(a.r, a.c, d));
      return open(grid, unit)
        .filter((cell) => !sameCell(cell, a) && !sameCell(cell, b))
        .map(({ r, c }) => key(r, c, a.digit));
    }),
    nodes: chain,
    links,
  };
}

/**
 * Names the chain when it has a well-known shape. An XY-chain uses only
 * two-candidate cells as its strong links. A W-Wing is two cells holding the
 * same pair x/y, joined through a unit where y has only two places.
 */
function shape(chain: readonly Node[], links: readonly (Unit | null)[], cand: number[][]): Technique {
  if (links.every((unit) => unit === null)) return "xy-chain";
  if (links.length === 3 && links[0] === null && links[1] !== null && links[2] === null) {
    const [a, , , , , b] = chain;
    if (cand[a.r][a.c] === cand[b.r][b.c]) return "w-wing";
  }
  return "aic";
}

function nodeName(node: Node): string {
  return `${cellName(node)} is ${node.digit}`;
}

/** The same wording serves all three names; the heading says which shape it is. */
export const aicPhrase: Phrase = (step) => {
  const chain = step.nodes ?? [];
  const parts = (step.links ?? []).map((unit, i) => {
    const [from, to] = [chain[2 * i], chain[2 * i + 1]];
    // A cell link stays in the same cell, so the second half says "it".
    const why = unit
      ? `${cellName(to)} must be ${to.digit}, as the only other place for ${to.digit} in ${unitName(unit)}.`
      : `it must be ${to.digit}, its only other candidate.`;
    if (i === 0) return `If ${cellName(from)} isn't ${from.digit}, ${why}`;
    const prev = chain[2 * i - 1];
    const off = sameCell(prev, from)
      ? `Then ${cellName(from)} can't also be ${from.digit}`
      : `Then ${cellName(from)}, which sees ${cellName(prev)}, isn't ${from.digit}`;
    return `${off}, so ${why}`;
  });
  const [first, last] = [chain[0], chain[chain.length - 1]];
  const ends =
    first.digit === last.digit
      ? `So either ${cellName(first)} or ${cellName(last)} is ${first.digit}, and no cell that sees both can be ${first.digit}`
      : `So either ${nodeName(first)} or ${nodeName(last)}, and nothing that clashes with both can be true`;
  return `${capitalize(parts.join(" "))} ${ends}: ${removalText(step.removals)}.`;
};
