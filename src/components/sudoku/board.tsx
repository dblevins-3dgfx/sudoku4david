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
): string {
  const position = `Row ${r + 1}, column ${c + 1}`;
  if (value !== 0) {
    const kind = locked ? "given" : "entered";
    return `${position}, ${kind} ${value}${conflict ? ", conflicts with another cell" : ""}`;
  }
  const notesList = noteDigits(notes);
  if (notesList.length > 0) return `${position}, empty, notes ${notesList.join(", ")}`;
  return `${position}, empty`;
}

export function Board({ game, conflicts, onSelect }: BoardProps) {
  const selectedValue = game.grid[game.selected.r][game.selected.c];

  return (
    <div
      role="grid"
      aria-label="Sudoku grid"
      className="bg-board-line p-[3px] shadow-[0_24px_50px_-28px_oklch(0.28_0.04_55/0.55)]"
    >
      <div className="grid grid-cols-3 gap-[3px] bg-board-line">
        {Array.from({ length: 9 }, (_, box) => {
          const br = ((box / 3) | 0) * 3;
          const bc = (box % 3) * 3;
          return (
            <div key={box} className="grid grid-cols-3 gap-px bg-board-line-soft">
              {Array.from({ length: 9 }, (_, index) => {
                const r = br + ((index / 3) | 0);
                const c = bc + (index % 3);
                const value = game.grid[r][c];
                const selected = game.selected.r === r && game.selected.c === c;
                const conflict = game.showMistakes && conflicts[r][c];
                const peer = !selected && sameGroup(r, c, game.selected.r, game.selected.c);
                const same =
                  !selected &&
                  value !== 0 &&
                  selectedValue !== 0 &&
                  value === selectedValue;
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
                    aria-label={cellLabel(r, c, value, game.locked[r][c], game.notes[r][c], conflict)}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => onSelect(r, c)}
                    className={cn(
                      "relative flex aspect-square cursor-pointer items-center justify-center text-[clamp(1.15rem,4.1vw,1.8rem)] leading-none tabular-nums transition-colors outline-none",
                      "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                      tone,
                      value !== 0 && ink,
                      game.locked[r][c] ? "font-semibold" : "font-medium",
                      selected && "z-10 ring-2 ring-primary ring-inset",
                    )}
                  >
                    {value !== 0 ? (
                      value
                    ) : game.notes[r][c] !== 0 ? (
                      <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[9%] text-[clamp(0.45rem,1.35vw,0.68rem)] font-medium text-cell-note">
                        {Array.from({ length: 9 }, (_, digit) => {
                          const n = digit + 1;
                          const on = (game.notes[r][c] & (1 << n)) !== 0;
                          return (
                            <span key={n} className="flex items-center justify-center">
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
        })}
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="animate-pulse bg-board-line p-[3px]" aria-hidden="true">
      <div className="grid grid-cols-3 gap-[3px] bg-board-line">
        {Array.from({ length: 9 }, (_, box) => (
          <div key={box} className="grid grid-cols-3 gap-px bg-board-line-soft">
            {Array.from({ length: 9 }, (_, cell) => (
              <div key={cell} className="aspect-square bg-board" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
