// Alternating inference chains (AIC): the X-chain idea with more than one
// digit. XY-chains and W-Wings are named shapes of the same thing.

import type { Coord } from "../game";
import { sameGroup, type Digit, type Grid } from "../sudoku";
import { ALL, bitCount, key, maskDigits, open, UNITS } from "./board";
import type { Found, Phrase, Technique, Unit } from "./types";
import { capitalize, cellName, removalText, unitName } from "./wording";

/** A candidate: `digit` is still possible in the cell. */
type Node = Coord & { digit: Digit };

/** A strong link out of a node: `to` must be true if the node is false. `unit` is null when both sit in one two-candidate cell. */
type Strong = { to: Node; unit: Unit | null };

const sees = (a: Coord, b: Coord) => (a.r !== b.r || a.c !== b.c) && sameGroup(a.r, a.c, b.r, b.c);
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
 * The search is the X-chain's breadth-first search, run over candidates
 * instead of cells: the shortest chain that removes something wins. It runs
 * after X-chains, so a single-digit chain is already found there.
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
  const strong = new Map<number, Strong[]>();
  const addStrong = (a: Node, b: Node, unit: Unit | null) => {
    for (const [x, y] of [[a, b], [b, a]]) {
      const list = strong.get(nodeId(x)) ?? [];
      if (!list.some((link) => nodeId(link.to) === nodeId(y))) list.push({ to: y, unit });
      strong.set(nodeId(x), list);
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

  // Number the nodes and list each one's weak neighbours once, so the search
  // below walks plain arrays (like adjacency lists in C) instead of
  // rescanning every candidate at each step.
  const index = new Map(nodes.map((node, i) => [nodeId(node), i]));
  const weakOut = nodes.map((a) => nodes.flatMap((b, j) => (weak(a, b) ? [j] : [])));
  const strongOut = nodes.map((a) => (strong.get(nodeId(a)) ?? []).map((link) => ({ to: index.get(nodeId(link.to))!, link })));

  let best: Found | null = null;
  let bestLength = Infinity;
  // seen[2i] / seen[2i+1]: node i already reached as false / as true.
  const seen = new Uint8Array(nodes.length * 2);
  const nearStart = new Uint8Array(nodes.length);
  for (let s = 0; s < nodes.length; s++) {
    if (strongOut[s].length === 0) continue;
    const start = nodes[s];
    // `on` marks the far end of a strong link; `link` is the strong link that
    // reached this node, or null after a weak one.
    type Path = { at: number; on: boolean; link: Strong | null; back: Path | null; length: number };
    seen.fill(0);
    seen[2 * s] = 1;
    // nearStart[j] is set when node j is weakly linked to the start, so a
    // possible removal at the far end is a quick lookup.
    nearStart.fill(0);
    for (const j of weakOut[s]) nearStart[j] = 1;
    let frontier: Path[] = [{ at: s, on: false, link: null, back: null, length: 0 }];
    while (frontier.length > 0) {
      const next: Path[] = [];
      for (const path of frontier) {
        if (path.length + 1 >= bestLength) continue;
        const steps = path.on
          ? weakOut[path.at].map((to) => ({ to, link: null }))
          : strongOut[path.at];
        for (const step of steps) {
          const slot = 2 * step.to + (path.on ? 0 : 1);
          if (seen[slot]) continue;
          seen[slot] = 1;
          const grown: Path = { at: step.to, on: !path.on, link: step.link, back: path, length: path.length + 1 };
          next.push(grown);
          if (!grown.on || grown.length < 3) continue;
          if (!weakOut[grown.at].some((j) => nearStart[j])) continue;
          const chain: Node[] = [];
          const links: (Unit | null)[] = [];
          for (let p: Path | null = grown; p; p = p.back) {
            chain.unshift(nodes[p.at]);
            if (p.link) links.unshift(p.link.unit);
          }
          if (new Set(chain.map(nodeId)).size !== chain.length) continue;
          const end = nodes[grown.at];
          const removals = nodes.filter(
            (node) => !chain.some((n) => nodeId(n) === nodeId(node)) && weak(node, start) && weak(node, end),
          );
          if (removals.length === 0) continue;
          bestLength = grown.length;
          best = {
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
      }
      frontier = next;
    }
  }
  return best;
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
