"use client";

import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game";
import { cellInk, cellTone, noteHighlighted, type CellInk, type CellMark, type CellTone } from "@/lib/tint";

type BoardProps = {
  game: GameState;
  conflicts: boolean[][];
  /** A 9×9 map of marks for the explained step; omitted when none is shown. */
  marks?: (CellMark | null)[][] | null;
  /** The cell Hint just filled, which pulses once; null when none. */
  flash?: { r: number; c: number } | null;
  /** Called when the pulse has finished, so the caller can clear `flash`. */
  onFlashEnd?: () => void;
  /** The Board highlighting switch: peer and same-digit tints, and highlighted marks. */
  highlighting: boolean;
  /** A 9×9 map of cells the dead-end warning flags; omitted when it is off. */
  deadEnds?: boolean[][] | null;
  onSelect: (r: number, c: number) => void;
};

// The Tailwind class for each tone that cellTone in src/lib/tint.ts can pick.
const TONE_CLASS: Record<CellTone, string> = {
  conflict: "bg-cell-conflict",
  // A dead end borrows the conflict color, with a dotted outline (below) to tell them apart.
  deadend: "bg-cell-conflict",
  target: "bg-cell-note-hit",
  pattern: "bg-cell-same",
  removal: "bg-cell-peer",
  unit: "bg-cell-peer",
  selected: "bg-cell-selected",
  same: "bg-cell-same",
  peer: "bg-cell-peer",
  plain: "bg-board",
};

// The Tailwind class for each digit color that cellInk in src/lib/tint.ts can pick.
const INK_CLASS: Record<CellInk, string> = {
  conflict: "text-cell-bad",
  given: "text-cell-given",
  entered: "text-cell-user",
};

function noteDigits(mask: number): number[] {
  const digits: number[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    if ((mask & (1 << digit)) !== 0) digits.push(digit);
  }
  return digits;
}

function cellLabel(
  r: number,
  c: number,
  value: number,
  locked: boolean,
  notes: number,
  conflict: boolean,
  selectedValue: number,
): string {
  const position = `Row ${r + 1}, column ${c + 1}`;
  if (value !== 0) {
    const kind = locked ? "given" : "entered";
    return `${position}, ${kind} ${value}${conflict ? ", conflicts with another cell" : ""}`;
  }
  const notesList = noteDigits(notes);
  const marked =
    selectedValue !== 0 && notesList.includes(selectedValue) ? `, note ${selectedValue} highlighted` : "";
  if (notesList.length > 0) return `${position}, empty, notes ${notesList.join(", ")}${marked}`;
  return `${position}, empty`;
}

function lineClass(r: number, c: number): string {
  const boxRight = c % 3 === 2 && c !== 8;
  const boxBottom = r % 3 === 2 && r !== 8;
  return cn(
    "bg-clip-padding",
    c === 8 ? "border-r-0" : boxRight ? "border-r-4 border-r-board-line" : "border-r-2 border-r-board-line-soft",
    r === 8 ? "border-b-0" : boxBottom ? "border-b-4 border-b-board-line" : "border-b-2 border-b-board-line-soft",
  );
}

export function Board({ game, conflicts, marks, flash, onFlashEnd, highlighting, deadEnds, onSelect }: BoardProps) {
  return (
    <div
      role="grid"
      aria-label="Sudoku grid"
      className="grid h-full w-full grid-cols-9 grid-rows-9 border-4 border-board-line bg-board shadow-[0_18px_40px_-24px_oklch(0.28_0.04_55/0.55)]"
    >
      {Array.from({ length: 81 }, (_, index) => {
        const r = (index / 9) | 0;
        const c = index % 9;
        return (
          <Cell
            key={index}
            game={game}
            r={r}
            c={c}
            conflict={game.showMistakes && conflicts[r][c]}
            deadEnd={deadEnds?.[r][c] ?? false}
            marks={marks ?? null}
            flashing={flash?.r === r && flash?.c === c}
            highlighting={highlighting}
            onSelect={onSelect}
            onFlashEnd={onFlashEnd}
          />
        );
      })}
    </div>
  );
}

type CellProps = {
  game: GameState;
  r: number;
  c: number;
  /** Conflicts are shown and this cell repeats a digit. */
  conflict: boolean;
  deadEnd: boolean;
  marks: (CellMark | null)[][] | null;
  /** Hint just filled this cell, so it pulses. */
  flashing: boolean;
  highlighting: boolean;
  onSelect: (r: number, c: number) => void;
  onFlashEnd?: () => void;
};

/** One square of the grid: a button holding its digit, its pencil marks, or nothing. */
function Cell({ game, r, c, conflict, deadEnd, marks, flashing, highlighting, onSelect, onFlashEnd }: CellProps) {
  const value = game.grid[r][c];
  const locked = game.locked[r][c];
  const selected = game.selected.r === r && game.selected.c === c;
  const selectedValue = highlighting ? game.grid[game.selected.r][game.selected.c] : 0;
  const tint = { grid: game.grid, selected: game.selected, conflict, deadEnd, marks, highlighting };
  const toneName = cellTone(tint, r, c);
  const mark = marks?.[r][c] ?? null;

  return (
    <button
      type="button"
      role="gridcell"
      data-coord={`${r}-${c}`}
      aria-selected={selected}
      aria-rowindex={r + 1}
      aria-colindex={c + 1}
      aria-label={
        cellLabel(r, c, value, locked, game.notes[r][c], conflict, selectedValue) +
        (toneName === "deadend" ? ", dead end" : "")
      }
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(r, c)}
      // The browser fires animationend when a CSS animation finishes.
      // Removing the class then lets a later hint on the same cell pulse again.
      onAnimationEnd={flashing ? onFlashEnd : undefined}
      className={cn(
        "cell-face relative flex min-h-0 min-w-0 cursor-pointer items-center justify-center tabular-nums transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        lineClass(r, c),
        TONE_CLASS[toneName],
        value !== 0 && INK_CLASS[cellInk(conflict, locked)],
        locked ? "font-semibold" : "font-medium",
        selected && "ring-2 ring-primary ring-inset",
        // A dashed outline drawn just inside the cell marks a candidate being removed.
        mark === "removal" && "outline-2 outline-dashed outline-destructive -outline-offset-4",
        toneName === "deadend" && "outline-2 outline-dotted outline-destructive -outline-offset-4",
        flashing && "hint-flash",
      )}
    >
      {value !== 0 ? (
        <span className="cell-digit">{value}</span>
      ) : game.notes[r][c] !== 0 ? (
        <CellNotes game={game} r={r} c={c} highlighting={highlighting} />
      ) : null}
    </button>
  );
}

/** An empty cell's pencil marks in a 3×3 grid, with the selected digit's mark highlighted. */
function CellNotes({ game, r, c, highlighting }: { game: GameState; r: number; c: number; highlighting: boolean }) {
  return (
    <span className="cell-notes grid h-full w-full grid-cols-3 grid-rows-3 text-cell-note">
      {Array.from({ length: 9 }, (_, digit) => {
        const n = digit + 1;
        const on = (game.notes[r][c] & (1 << n)) !== 0;
        const marked = noteHighlighted(game.grid, game.notes, game.selected, r, c, n, highlighting);
        return (
          <span
            key={n}
            className={cn(
              "flex items-center justify-center rounded-[2px]",
              marked && "bg-cell-note-hit font-semibold text-cell-note-hit-ink",
            )}
          >
            {on ? n : ""}
          </span>
        );
      })}
    </span>
  );
}

export function BoardSkeleton() {
  return (
    <div className="grid h-full w-full animate-pulse grid-cols-9 grid-rows-9 border-4 border-board-line bg-board" aria-hidden="true">
      {Array.from({ length: 81 }, (_, index) => {
        const r = (index / 9) | 0;
        const c = index % 9;
        return <div key={index} className={cn("min-h-0 min-w-0 bg-board", lineClass(r, c))} />;
      })}
    </div>
  );
}
