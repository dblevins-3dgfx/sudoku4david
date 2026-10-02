"use client";

import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game";
import { sameGroup } from "@/lib/sudoku";

type BoardProps = {
  game: GameState;
  conflicts: boolean[][];
  onSelect: (r: number, c: number) => void;
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

export function Board({ game, conflicts, onSelect }: BoardProps) {
  const selectedValue = game.grid[game.selected.r][game.selected.c];

  return (
    <div
      role="grid"
      aria-label="Sudoku grid"
      className="grid h-full w-full grid-cols-9 grid-rows-9 border-4 border-board-line bg-board shadow-[0_18px_40px_-24px_oklch(0.28_0.04_55/0.55)]"
    >
      {Array.from({ length: 81 }, (_, index) => {
        const r = (index / 9) | 0;
        const c = index % 9;
        const value = game.grid[r][c];
        const selected = game.selected.r === r && game.selected.c === c;
        const conflict = game.showMistakes && conflicts[r][c];
        const peer = !selected && sameGroup(r, c, game.selected.r, game.selected.c);
        const same =
          !selected && value !== 0 && selectedValue !== 0 && value === selectedValue;
        const tone = conflict
          ? "bg-cell-conflict"
          : selected
            ? "bg-cell-selected"
            : same
              ? "bg-cell-same"
              : peer
                ? "bg-cell-peer"
                : "bg-board";
        const ink = conflict
          ? "text-cell-bad"
          : game.locked[r][c]
            ? "text-cell-given"
            : "text-cell-user";

        return (
          <button
            key={index}
            type="button"
            role="gridcell"
            data-coord={`${r}-${c}`}
            aria-selected={selected}
            aria-rowindex={r + 1}
            aria-colindex={c + 1}
            aria-label={cellLabel(r, c, value, game.locked[r][c], game.notes[r][c], conflict, selectedValue)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(r, c)}
            className={cn(
              "cell-face relative flex min-h-0 min-w-0 cursor-pointer items-center justify-center tabular-nums transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              lineClass(r, c),
              tone,
              value !== 0 && ink,
              game.locked[r][c] ? "font-semibold" : "font-medium",
              selected && "ring-2 ring-primary ring-inset",
            )}
          >
            {value !== 0 ? (
              <span className="cell-digit">{value}</span>
            ) : game.notes[r][c] !== 0 ? (
              <span className="cell-notes grid h-full w-full grid-cols-3 grid-rows-3 text-cell-note">
                {Array.from({ length: 9 }, (_, digit) => {
                  const n = digit + 1;
                  const on = (game.notes[r][c] & (1 << n)) !== 0;
                  const marked = on && selectedValue !== 0 && n === selectedValue;
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
            ) : null}
          </button>
        );
      })}
    </div>
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
