// X-chains: one digit followed through a chain of strong and weak links.

import type { Coord } from "../game";
import { sameGroup, type Digit, type Grid } from "../sudoku";
import { key, open, UNITS } from "./board";
import type { Found, Phrase, Unit } from "./types";
import { capitalize, cellName, removalText, unitName } from "./wording";

/** One strong link of an X-chain: `from` and `to` are the only places left for the digit in `unit`. */
type Link = { unit: Unit; from: Coord; to: Coord };

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
  const sees = (a: Coord, b: Coord) => (a.r !== b.r || a.c !== b.c) && sameGroup(a.r, a.c, b.r, b.c);
  let best: Found | null = null;
  for (let d = 1; d <= 9; d++) {
    const bit = 1 << d;
    const nodes: Coord[] = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && cand[r][c] & bit) nodes.push({ r, c });
    const id = (cell: Coord) => cell.r * 9 + cell.c;
    // strong[i] lists the strong links out of cell i: the partner and the unit.
    const strong = new Map<number, { to: Coord; unit: Unit }[]>();
    for (const unit of UNITS) {
      const spots = open(grid, unit).filter(({ r, c }) => cand[r][c] & bit);
      if (spots.length !== 2) continue;
      const [a, b] = spots;
      for (const [x, y] of [[a, b], [b, a]]) {
        const list = strong.get(id(x)) ?? [];
        // A pair of cells can share a line and a box; one unit names the link.
        if (!list.some((link) => id(link.to) === id(y))) list.push({ to: y, unit });
        strong.set(id(x), list);
      }
    }
    for (const start of nodes) {
      // Breadth-first search, so each end is first reached by a shortest
      // chain. A path is a linked list through `back`, like a C struct with a
      // parent pointer; `on` is the far end of a strong link.
      type Path = { cell: Coord; on: boolean; link: Link | null; back: Path | null; length: number };
      const seen = new Set<string>([`${id(start)}off`]);
      let frontier: Path[] = [{ cell: start, on: false, link: null, back: null, length: 0 }];
      while (frontier.length > 0) {
        const next: Path[] = [];
        for (const path of frontier) {
          // Nothing longer than the best chain so far can beat it.
          if (best && path.length + 1 >= best.cells.length - 1) continue;
          const steps = path.on
            ? nodes.filter((cell) => sees(path.cell, cell)).map((cell) => ({ cell, link: null }))
            : (strong.get(id(path.cell)) ?? []).map(({ to, unit }) => ({ cell: to, link: { unit, from: path.cell, to } }));
          for (const step of steps) {
            const tag = `${id(step.cell)}${path.on ? "off" : "on"}`;
            if (seen.has(tag)) continue;
            seen.add(tag);
            const grown: Path = { cell: step.cell, on: !path.on, link: step.link, back: path, length: path.length + 1 };
            next.push(grown);
            if (!grown.on || grown.length < 3) continue;
            const cells: Coord[] = [];
            const chain: Link[] = [];
            for (let p: Path | null = grown; p; p = p.back) {
              cells.unshift(p.cell);
              if (p.link) chain.unshift(p.link);
            }
            if (new Set(cells.map(id)).size !== cells.length) continue;
            const end = grown.cell;
            const removals = nodes
              .filter((cell) => !cells.some((x) => id(x) === id(cell)) && sees(cell, start) && sees(cell, end))
              .map((cell) => ({ ...cell, digit: d as Digit }));
            if (removals.length === 0) continue;
            if (best && cells.length >= best.cells.length) continue;
            best = {
              technique: "x-chain",
              unit: null,
              cells,
              digits: [d as Digit],
              removals,
              place: null,
              // Each strong link needs the digit gone from the rest of its unit.
              relies: chain.flatMap((link) =>
                open(grid, link.unit)
                  .filter((cell) => id(cell) !== id(link.from) && id(cell) !== id(link.to))
                  .map(({ r, c }) => key(r, c, d)),
              ),
              links: chain.map((link) => link.unit),
            };
          }
        }
        frontier = next;
      }
    }
  }
  return best;
}

export const xChainPhrase: Phrase = (step) => {
  // Strong link i runs from cells[2i] to cells[2i+1] in links[i].
  const d = step.digits[0];
  const names = step.cells.map(cellName);
  const links = (step.links ?? []).map((unit, i) => {
    const [from, to] = [names[2 * i], names[2 * i + 1]];
    const why = `${to} must be, as the only other place for ${d} in ${unitName(unit)}.`;
    return i === 0 ? `If ${from} isn't ${d}, ${why}` : `Then ${from}, which sees ${names[2 * i - 1]}, isn't ${d}, so ${why}`;
  });
  return `${capitalize(links.join(" "))} So either ${names[0]} or ${names[names.length - 1]} is ${d}, and no cell that sees both can be ${d}: ${removalText(step.removals)}.`;
};
