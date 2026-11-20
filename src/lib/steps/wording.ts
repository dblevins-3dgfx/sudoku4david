// Phrasing helpers shared by the techniques' explanations. Rows, columns,
// and boxes are numbered from 1 in the text and from 0 in the code.

import type { Coord } from "../game";
import type { Digit } from "../sudoku";
import type { Removal, Technique, Unit } from "./types";

export const BOX_NAMES = [
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

export function cellName({ r, c }: Coord): string {
  return `row ${r + 1}, column ${c + 1}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function unitName(unit: Unit): string {
  return unit.kind === "box" ? `the ${BOX_NAMES[unit.index]} box` : `${unit.kind} ${unit.index + 1}`;
}

export function andList(items: readonly (string | number)[], joiner = "and"): string {
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

export function removalText(removals: readonly Removal[]): string {
  const byDigit = new Map<Digit, Coord[]>();
  for (const { r, c, digit } of removals) byDigit.set(digit, [...(byDigit.get(digit) ?? []), { r, c }]);
  const parts = [...byDigit].sort(([a], [b]) => a - b).map(([digit, cells]) => `${digit} from ${cellsName(cells)}`);
  // Cell names hold commas, so the parts are separated by semicolons.
  if (parts.length === 1) return `remove ${parts[0]}`;
  return `remove ${parts.slice(0, -1).join("; ")}; and ${parts[parts.length - 1]}`;
}

/** Where cells sit inside a unit: just the columns for a row, the rows for a column. */
export function placeIn(unit: Unit | null, cells: readonly Coord[]): string {
  const list = (values: number[]) => andList(values.map((v) => v + 1));
  if (unit?.kind === "row") return `${cells.length === 1 ? "column" : "columns"} ${list(cells.map((cell) => cell.c))}`;
  if (unit?.kind === "column") return `${cells.length === 1 ? "row" : "rows"} ${list(cells.map((cell) => cell.r))}`;
  return cellsName(cells);
}

/** "rows 2 and 7", or "columns 1, 4, and 9". */
export function linesName(kind: "row" | "column", indices: readonly number[]): string {
  return `${kind}s ${andList([...indices].sort((a, b) => a - b).map((i) => i + 1))}`;
}

// The keys are the technique strings. A key needs quotes only when it isn't a
// valid identifier: "x-wing" has a hyphen, so it is quoted; swordfish is not.
// Both spellings make the same string key; this file leaves out quotes it
// doesn't need. Record<K, V> requires an entry for every technique, so a new
// one that is missing here fails to compile.
/** The heading for each technique, as Explain and the commentary show it. */
export const TECHNIQUE_NAMES: Record<Technique, string> = {
  "hidden-single": "Hidden single",
  "naked-single": "Naked single",
  pointing: "Pointing",
  claiming: "Claiming",
  "naked-pair": "Naked pair",
  "hidden-pair": "Hidden pair",
  "naked-triple": "Naked triple",
  "hidden-triple": "Hidden triple",
  "x-wing": "X-Wing",
  swordfish: "Swordfish",
  "xy-wing": "XY-Wing",
  "x-chain": "X-chain",
  "xy-chain": "XY-chain",
  "w-wing": "W-Wing",
  aic: "Chain (AIC)",
};
