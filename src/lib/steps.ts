// The step finder (#41): works out the next logical move from the current
// board the way a person would, and says why in plain words. It never guesses
// and never peeks at the solution for the logic. The solution is used only to
// catch a wrong digit the player entered, since every deduction made on top of
// a wrong digit is unreliable.
//
// Candidates come from the digits on the board, not from the player's pencil
// marks, which may be incomplete. A candidate set is a bitmask with bit `d`
// set for digit d, the same layout the notes use (bit 0 unused).
//
// The finder looks for a placement first (a single). When none is visible it
// applies eliminations (pointing, claiming, pairs, triples, X-Wing, Swordfish,
// XY-Wing, X-chains) to its private
// candidate copy and looks again. It then keeps only the eliminations the
// placement actually depends on, so the explanation is a short chain that ends
// in a digit to write in.

import type { Coord } from "./game";
import { isDigit, sameGroup, type Digit, type Grid } from "./sudoku";

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

const ALL = 0b11_1111_1110;

const BOX_NAMES = [
  "top-left",
  "top-middle",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-middle",
  "bottom-right",
];

function boxOf(r: number, c: number): number {
  return ((r / 3) | 0) * 3 + ((c / 3) | 0);
}

function buildUnits(): Unit[] {
  const rows: Unit[] = [];
  const columns: Unit[] = [];
  const boxes: Unit[] = [];
  for (let i = 0; i < 9; i++) {
    rows.push({ kind: "row", index: i, cells: Array.from({ length: 9 }, (_, c) => ({ r: i, c })) });
    columns.push({ kind: "column", index: i, cells: Array.from({ length: 9 }, (_, r) => ({ r, c: i })) });
    const top = ((i / 3) | 0) * 3;
    const left = (i % 3) * 3;
    boxes.push({
      kind: "box",
      index: i,
      cells: Array.from({ length: 9 }, (_, k) => ({ r: top + ((k / 3) | 0), c: left + (k % 3) })),
    });
  }
  return [...boxes, ...rows, ...columns];
}

// Boxes first: a person scanning for singles usually starts with the boxes.
const UNITS = buildUnits();
const LINES = UNITS.filter((unit) => unit.kind !== "box");
const BOXES = UNITS.filter((unit) => unit.kind === "box");

/** Packs (cell, digit) into one number, so a Set<number> can hold them. */
function key(r: number, c: number, digit: number): number {
  return (r * 9 + c) * 10 + digit;
}

function bitCount(mask: number): number {
  let count = 0;
  for (let m = mask; m !== 0; m &= m - 1) count++;
  return count;
}

function maskDigits(mask: number): Digit[] {
  const digits: Digit[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) digits.push(d as Digit);
  return digits;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i <= items.length - size; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) out.push([items[i], ...rest]);
  }
  return out;
}

/** Candidates for every empty cell from the digits on the board; 0 for filled cells. */
export function boardCandidates(grid: Grid): number[][] {
  const cand = grid.map((row) => row.map((value) => (value === 0 ? ALL : 0)));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const value = grid[r][c];
      if (value === 0) continue;
      const bit = ~(1 << value);
      for (let k = 0; k < 9; k++) {
        cand[r][k] &= bit;
        cand[k][c] &= bit;
      }
      const top = r - (r % 3);
      const left = c - (c % 3);
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) cand[top + dr][left + dc] &= bit;
    }
  }
  return cand;
}

/**
 * A pattern found on the candidates, before it is put into words. `relies`
 * lists the (cell, digit) candidates whose absence the pattern depends on;
 * that is how the chain is trimmed back to the steps that matter.
 */
type Found = Omit<Step, "text"> & { relies: number[] };

function open(grid: Grid, unit: Unit): Coord[] {
  return unit.cells.filter(({ r, c }) => grid[r][c] === 0);
}

function hiddenSingle(grid: Grid, cand: number[][]): Found | null {
  for (const unit of UNITS) {
    const cells = open(grid, unit);
    for (let d = 1; d <= 9; d++) {
      const spots = cells.filter(({ r, c }) => cand[r][c] & (1 << d));
      if (spots.length !== 1) continue;
      const [spot] = spots;
      const digit = d as Digit;
      return {
        technique: "hidden-single",
        unit,
        cells: [spot],
        digits: [digit],
        removals: [],
        place: { ...spot, digit },
        relies: cells.filter((cell) => cell !== spot).map(({ r, c }) => key(r, c, d)),
      };
    }
  }
  return null;
}

function nakedSingle(grid: Grid, cand: number[][]): Found | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0 || bitCount(cand[r][c]) !== 1) continue;
      const [digit] = maskDigits(cand[r][c]);
      return {
        technique: "naked-single",
        unit: null,
        cells: [{ r, c }],
        digits: [digit],
        removals: [],
        place: { r, c, digit },
        relies: maskDigits(ALL & ~cand[r][c]).map((d) => key(r, c, d)),
      };
    }
  }
  return null;
}

/** A box whose candidates for a digit sit on one line clears that digit from the rest of the line. */
function pointing(grid: Grid, cand: number[][]): Found | null {
  for (const box of BOXES) {
    const cells = open(grid, box);
    for (let d = 1; d <= 9; d++) {
      const spots = cells.filter(({ r, c }) => cand[r][c] & (1 << d));
      if (spots.length < 2) continue;
      for (const line of LINES) {
        const along = line.kind === "row" ? (cell: Coord) => cell.r === line.index : (cell: Coord) => cell.c === line.index;
        if (!spots.every(along)) continue;
        const removals = open(grid, line)
          .filter((cell) => boxOf(cell.r, cell.c) !== box.index && cand[cell.r][cell.c] & (1 << d))
          .map((cell) => ({ ...cell, digit: d as Digit }));
        if (removals.length === 0) continue;
        return {
          technique: "pointing",
          unit: box,
          cells: spots,
          digits: [d as Digit],
          removals,
          place: null,
          relies: cells.filter((cell) => !along(cell)).map(({ r, c }) => key(r, c, d)),
        };
      }
    }
  }
  return null;
}

/** A line whose candidates for a digit sit in one box clears that digit from the rest of the box. */
function claiming(grid: Grid, cand: number[][]): Found | null {
  for (const line of LINES) {
    const cells = open(grid, line);
    for (let d = 1; d <= 9; d++) {
      const spots = cells.filter(({ r, c }) => cand[r][c] & (1 << d));
      if (spots.length < 2) continue;
      const box = boxOf(spots[0].r, spots[0].c);
      if (!spots.every((cell) => boxOf(cell.r, cell.c) === box)) continue;
      const along = line.kind === "row" ? (cell: Coord) => cell.r === line.index : (cell: Coord) => cell.c === line.index;
      const removals = open(grid, BOXES[box])
        .filter((cell) => !along(cell) && cand[cell.r][cell.c] & (1 << d))
        .map((cell) => ({ ...cell, digit: d as Digit }));
      if (removals.length === 0) continue;
      return {
        technique: "claiming",
        unit: line,
        cells: spots,
        digits: [d as Digit],
        removals,
        place: null,
        relies: cells.filter((cell) => boxOf(cell.r, cell.c) !== box).map(({ r, c }) => key(r, c, d)),
      };
    }
  }
  return null;
}

/** k cells in a unit that can hold only k digits between them keep those digits to themselves. */
function nakedSubset(grid: Grid, cand: number[][], size: 2 | 3): Found | null {
  for (const unit of UNITS) {
    const cells = open(grid, unit);
    const small = cells.filter(({ r, c }) => bitCount(cand[r][c]) >= 2 && bitCount(cand[r][c]) <= size);
    for (const group of combinations(small, size)) {
      const union = group.reduce((mask, { r, c }) => mask | cand[r][c], 0);
      if (bitCount(union) !== size) continue;
      const removals: Removal[] = [];
      for (const cell of cells) {
        if (group.includes(cell)) continue;
        for (const digit of maskDigits(cand[cell.r][cell.c] & union)) removals.push({ ...cell, digit });
      }
      if (removals.length === 0) continue;
      return {
        technique: size === 2 ? "naked-pair" : "naked-triple",
        unit,
        cells: group,
        digits: maskDigits(union),
        removals,
        place: null,
        relies: group.flatMap(({ r, c }) => maskDigits(ALL & ~union).map((d) => key(r, c, d))),
      };
    }
  }
  return null;
}

/** k digits that fit in only k cells of a unit push every other digit out of those cells. */
function hiddenSubset(grid: Grid, cand: number[][], size: 2 | 3): Found | null {
  for (const unit of UNITS) {
    const cells = open(grid, unit);
    const placesFor = (d: number) => cells.filter(({ r, c }) => cand[r][c] & (1 << d));
    const few: Digit[] = [];
    for (let d = 1; d <= 9; d++) {
      const count = placesFor(d).length;
      if (count >= 2 && count <= size) few.push(d as Digit);
    }
    for (const digits of combinations(few, size)) {
      const spots = cells.filter(({ r, c }) => digits.some((d) => cand[r][c] & (1 << d)));
      if (spots.length !== size) continue;
      const keep = digits.reduce((mask, d) => mask | (1 << d), 0);
      const removals = spots.flatMap((cell) =>
        maskDigits(cand[cell.r][cell.c] & ~keep).map((digit) => ({ ...cell, digit })),
      );
      if (removals.length === 0) continue;
      return {
        technique: size === 2 ? "hidden-pair" : "hidden-triple",
        unit,
        cells: spots,
        digits,
        removals,
        place: null,
        relies: cells
          .filter((cell) => !spots.includes(cell))
          .flatMap(({ r, c }) => digits.map((d) => key(r, c, d))),
      };
    }
  }
  return null;
}

/**
 * X-Wing (size 2) and Swordfish (size 3). Take `size` rows in which a digit
 * fits only within the same `size` columns. Each of those rows needs the
 * digit once, and no two can use the same column, so between them they fill
 * the digit in every one of those columns. No other cell in those columns can
 * hold it. The same works with rows and columns swapped.
 */
function fish(grid: Grid, cand: number[][], size: 2 | 3): Found | null {
  for (let d = 1; d <= 9; d++) {
    const bit = 1 << d;
    for (const baseKind of ["row", "column"] as const) {
      // at(b, k) is the cell in base line b, cover line k.
      const at = baseKind === "row" ? (b: number, k: number) => ({ r: b, c: k }) : (b: number, k: number) => ({ r: k, c: b });
      const isOpen = ({ r, c }: Coord) => grid[r][c] === 0;
      const has = ({ r, c }: Coord) => grid[r][c] === 0 && (cand[r][c] & bit) !== 0;
      // For each base line with 2..size places for d, those places as a mask of cover indices.
      const bases: { line: number; spots: number }[] = [];
      for (let b = 0; b < 9; b++) {
        let spots = 0;
        for (let k = 0; k < 9; k++) if (has(at(b, k))) spots |= 1 << k;
        const count = bitCount(spots);
        if (count >= 2 && count <= size) bases.push({ line: b, spots });
      }
      for (const group of combinations(bases, size)) {
        const cover = group.reduce((mask, base) => mask | base.spots, 0);
        if (bitCount(cover) !== size) continue;
        const baseLines = group.map((base) => base.line);
        const coverLines = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((k) => cover & (1 << k));
        const removals: Removal[] = [];
        for (const k of coverLines) {
          for (let b = 0; b < 9; b++) {
            const cell = at(b, k);
            if (!baseLines.includes(b) && has(cell)) removals.push({ ...cell, digit: d as Digit });
          }
        }
        if (removals.length === 0) continue;
        const cells = baseLines.flatMap((b) => coverLines.map((k) => at(b, k)).filter(has));
        // The pattern needs d to be out of every other open cell of the base lines.
        const relies = baseLines.flatMap((b) =>
          [0, 1, 2, 3, 4, 5, 6, 7, 8]
            .filter((k) => !(cover & (1 << k)))
            .map((k) => at(b, k))
            .filter(isOpen)
            .map(({ r, c }) => key(r, c, d)),
        );
        // Removals in reading order, so the wording lists them tidily.
        removals.sort((a, b) => a.r * 9 + a.c - (b.r * 9 + b.c));
        return {
          technique: size === 2 ? "x-wing" : "swordfish",
          unit: null,
          cells,
          digits: [d as Digit],
          removals,
          place: null,
          relies,
        };
      }
    }
  }
  return null;
}

/**
 * XY-Wing: a pivot cell that can only be x or y sees two pincer cells, one
 * that can only be x or z and one that can only be y or z. Whichever digit the
 * pivot takes, one pincer must be z, so a cell that sees both pincers can't be
 * z. `digits` is [x, y, z].
 */
function xyWing(grid: Grid, cand: number[][]): Found | null {
  const pairs: Coord[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && bitCount(cand[r][c]) === 2) pairs.push({ r, c });
  }
  const sees = (a: Coord, b: Coord) => (a.r !== b.r || a.c !== b.c) && sameGroup(a.r, a.c, b.r, b.c);
  for (const pivot of pairs) {
    const pivotMask = cand[pivot.r][pivot.c];
    const [x, y] = maskDigits(pivotMask);
    const wings = pairs.filter((cell) => sees(pivot, cell));
    for (const a of wings) {
      const aMask = cand[a.r][a.c];
      // Pincer A shares x with the pivot, and its other digit z is not y.
      if (!(aMask & (1 << x)) || aMask & (1 << y)) continue;
      const zBit = aMask & ~(1 << x);
      const yzMask = (1 << y) | zBit;
      for (const b of wings) {
        if (cand[b.r][b.c] !== yzMask) continue;
        const z = maskDigits(zBit)[0];
        const removals: Removal[] = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            const cell = { r, c };
            if (grid[r][c] !== 0 || !(cand[r][c] & zBit)) continue;
            if (sees(cell, a) && sees(cell, b) && (r !== pivot.r || c !== pivot.c)) removals.push({ ...cell, digit: z });
          }
        }
        if (removals.length === 0) continue;
        const allBut = (cell: Coord, mask: number) => maskDigits(ALL & ~mask).map((d) => key(cell.r, cell.c, d));
        return {
          technique: "xy-wing",
          unit: null,
          cells: [pivot, a, b],
          digits: [x, y, z],
          removals,
          place: null,
          relies: [...allBut(pivot, pivotMask), ...allBut(a, aMask), ...allBut(b, yzMask)],
        };
      }
    }
  }
  return null;
}

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
function xChain(grid: Grid, cand: number[][]): Found | null {
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

// ---- Wording ---------------------------------------------------------------

function cellName({ r, c }: Coord): string {
  return `row ${r + 1}, column ${c + 1}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function unitName(unit: Unit): string {
  return unit.kind === "box" ? `the ${BOX_NAMES[unit.index]} box` : `${unit.kind} ${unit.index + 1}`;
}

function andList(items: readonly (string | number)[], joiner = "and"): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} ${joiner} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${joiner} ${items[items.length - 1]}`;
}

/** Names a set of cells compactly when they share a row or column. */
export function cellsName(cells: readonly Coord[]): string {
  if (cells.length === 1) return cellName(cells[0]);
  if (cells.every((cell) => cell.r === cells[0].r)) {
    return `row ${cells[0].r + 1}, columns ${andList(cells.map((cell) => cell.c + 1))}`;
  }
  if (cells.every((cell) => cell.c === cells[0].c)) {
    return `column ${cells[0].c + 1}, rows ${andList(cells.map((cell) => cell.r + 1))}`;
  }
  return cells.map(cellName).join("; ");
}

function removalText(removals: readonly Removal[]): string {
  const byDigit = new Map<Digit, Coord[]>();
  for (const { r, c, digit } of removals) byDigit.set(digit, [...(byDigit.get(digit) ?? []), { r, c }]);
  const parts = [...byDigit].sort(([a], [b]) => a - b).map(([digit, cells]) => `${digit} from ${cellsName(cells)}`);
  // Cell names hold commas, so the parts are separated by semicolons.
  if (parts.length === 1) return `remove ${parts[0]}`;
  return `remove ${parts.slice(0, -1).join("; ")}; and ${parts[parts.length - 1]}`;
}

/** Where cells sit inside a unit: just the columns for a row, the rows for a column. */
function placeIn(unit: Unit | null, cells: readonly Coord[]): string {
  const list = (values: number[]) => andList(values.map((v) => v + 1));
  if (unit?.kind === "row") return `${cells.length === 1 ? "column" : "columns"} ${list(cells.map((cell) => cell.c))}`;
  if (unit?.kind === "column") return `${cells.length === 1 ? "row" : "rows"} ${list(cells.map((cell) => cell.r))}`;
  return cellsName(cells);
}

/** "rows 2 and 7", or "columns 1, 4, and 9". */
function linesName(kind: "row" | "column", indices: readonly number[]): string {
  return `${kind}s ${andList([...indices].sort((a, b) => a - b).map((i) => i + 1))}`;
}

function describe(step: Found, usesEarlier: boolean): string {
  const [first] = step.cells;
  const digits = andList(step.digits);
  const unit = step.unit ? unitName(step.unit) : "";
  const earlier = usesEarlier ? " This relies on what the earlier steps ruled out." : "";
  switch (step.technique) {
    case "hidden-single": {
      const d = step.digits[0];
      return `In ${unit}, ${d} can only go in ${placeIn(step.unit, step.cells)}. Every other open cell there already sees ${d === 8 ? "an" : "a"} ${d} in its row, column, or box.${earlier}`;
    }
    case "naked-single":
      return `${capitalize(cellName(first))} can only be ${step.digits[0]}. Its row, column, and box already hold every other digit.${earlier}`;
    case "pointing": {
      const line = first.r === step.cells[1].r ? `row ${first.r + 1}` : `column ${first.c + 1}`;
      return `In ${unit}, ${digits} can only go in ${line}. So ${line} gets its ${digits} inside that box, and no other cell in ${line} can be ${digits}: ${removalText(step.removals)}.${earlier}`;
    }
    case "claiming": {
      const box = `the ${BOX_NAMES[boxOf(first.r, first.c)]} box`;
      return `In ${unit}, ${digits} can only go inside ${box}. So that box gets its ${digits} in ${unit}, and no other cell in the box can be ${digits}: ${removalText(step.removals)}.${earlier}`;
    }
    case "naked-pair":
    case "naked-triple": {
      const count = step.cells.length === 2 ? "two" : "three";
      return `In ${unit}, ${placeIn(step.unit, step.cells)} can only hold ${digits} between them, so those ${count} digits go there. No other cell in ${unit} can be ${andList(step.digits, "or")}: ${removalText(step.removals)}.${earlier}`;
    }
    case "hidden-pair":
    case "hidden-triple": {
      const count = step.cells.length === 2 ? "two" : "three";
      return `In ${unit}, ${digits} can only go in ${placeIn(step.unit, step.cells)}. Those ${count} cells must hold them, so nothing else fits there: ${removalText(step.removals)}.${earlier}`;
    }
    case "x-wing":
    case "swordfish": {
      // The pattern's cells all sit in the base lines; the removals sit in
      // the cover lines, outside the base lines. A removal shares a column
      // with the pattern when the base lines are rows.
      const rowsBase = step.cells.some((cell) => cell.c === step.removals[0].c && cell.r !== step.removals[0].r);
      const rows = [...new Set(step.cells.map((cell) => cell.r))];
      const columns = [...new Set(step.cells.map((cell) => cell.c))];
      const base = rowsBase ? linesName("row", rows) : linesName("column", columns);
      const cover = rowsBase ? linesName("column", columns) : linesName("row", rows);
      const count = step.technique === "x-wing" ? "two" : "three";
      return `In ${base}, ${digits} can only go in ${cover}. Those ${count} ${rowsBase ? "rows" : "columns"} need their ${digits}s in those ${count} ${rowsBase ? "columns" : "rows"}, so ${cover} get their ${digits}s in ${base}. No other cell in ${cover} can be ${digits}: ${removalText(step.removals)}.${earlier}`;
    }
    case "xy-wing": {
      const [pivot, a, b] = step.cells.map(cellName);
      const [x, y, z] = step.digits;
      return `${capitalize(pivot)} can only be ${x} or ${y}. It sees ${a}, which can only be ${x} or ${z}, and ${b}, which can only be ${y} or ${z}. If ${pivot} is ${x}, ${a} must be ${z}; if it is ${y}, ${b} must be ${z}. Either way one of those two is ${z}, so no cell that sees both of them can be ${z}: ${removalText(step.removals)}.${earlier}`;
    }
    case "x-chain": {
      // Strong link i runs from cells[2i] to cells[2i+1] in links[i].
      const d = step.digits[0];
      const names = step.cells.map(cellName);
      const links = (step.links ?? []).map((unit, i) => {
        const [from, to] = [names[2 * i], names[2 * i + 1]];
        const why = `${to} must be, as the only other place for ${d} in ${unitName(unit)}.`;
        return i === 0 ? `If ${from} isn't ${d}, ${why}` : `Then ${from}, which sees ${names[2 * i - 1]}, isn't ${d}, so ${why}`;
      });
      return `${capitalize(links.join(" "))} So either ${names[0]} or ${names[names.length - 1]} is ${d}, and no cell that sees both can be ${d}: ${removalText(step.removals)}.${earlier}`;
    }
  }
}

// ---- The finder ------------------------------------------------------------

const ELIMINATIONS: ((grid: Grid, cand: number[][]) => Found | null)[] = [
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
