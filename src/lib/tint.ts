import type { Grid } from "./sudoku";
import { sameGroup } from "./sudoku";

/**
 * How a cell takes part in the step being explained: the cell to fill, the
 * cells that make the pattern, cells losing a candidate, or the rest of the
 * row, column, or box the step is about.
 */
export type CellMark = "target" | "pattern" | "removal" | "unit";

/**
 * The background a board cell is drawn with. The board component maps each
 * one to a CSS class; keeping the choice here, as a plain function, lets the
 * order of precedence be unit-tested without rendering anything.
 */
export type CellTone = "conflict" | CellMark | "selected" | "same" | "peer" | "plain";

export type TintInput = {
  grid: Grid;
  selected: { r: number; c: number };
  /** True when conflicts are shown and this cell repeats a digit. */
  conflict: boolean;
  /** The 9×9 marks of the step being explained, or null when none is shown. */
  marks: (CellMark | null)[][] | null;
};

/**
 * Picks one cell's tone. A shown conflict wins, then an explanation mark, then
 * the selected cell. While a step is explained, its marks replace the usual
 * same-digit and peer tints so only the cells it talks about stand out.
 */
export function cellTone({ grid, selected, conflict, marks }: TintInput, r: number, c: number): CellTone {
  if (conflict) return "conflict";
  const mark = marks?.[r][c] ?? null;
  if (mark) return mark;
  const isSelected = selected.r === r && selected.c === c;
  if (isSelected) return "selected";
  if (marks) return "plain";
  const selectedValue = grid[selected.r][selected.c];
  const value = grid[r][c];
  if (value !== 0 && selectedValue !== 0 && value === selectedValue) return "same";
  if (sameGroup(r, c, selected.r, selected.c)) return "peer";
  return "plain";
}

/**
 * True when pencil mark `digit` in cell (r, c) is highlighted: the selected
 * cell holds that same digit and this cell has the mark. Selecting an empty
 * cell highlights no marks.
 */
export function noteHighlighted(
  grid: Grid,
  notes: number[][],
  selected: { r: number; c: number },
  r: number,
  c: number,
  digit: number,
): boolean {
  const selectedValue = grid[selected.r][selected.c];
  return selectedValue !== 0 && digit === selectedValue && (notes[r][c] & (1 << digit)) !== 0;
}
