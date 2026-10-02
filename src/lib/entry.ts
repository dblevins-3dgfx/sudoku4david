import type { Digit } from "./sudoku";

export const DOUBLE_TAP_MS = 450;

export type Tap = {
  digit: Digit;
  cell: string;
  at: number;
};

export type TapAction = "note" | "fill";

export function nextTap(
  previous: Tap | null,
  digit: Digit,
  cell: string,
  now: number,
  windowMs = DOUBLE_TAP_MS,
): { action: TapAction; tap: Tap | null } {
  if (
    previous &&
    previous.digit === digit &&
    previous.cell === cell &&
    now >= previous.at &&
    now - previous.at <= windowMs
  ) {
    return { action: "fill", tap: null };
  }
  return { action: "note", tap: { digit, cell, at: now } };
}
