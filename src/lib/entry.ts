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

/**
 * Whether a digit press writes a note, for either entry method, and the tap
 * to remember for the next press. With the notes button the pencil decides
 * and the remembered tap is left as it was.
 */
export function chooseEntry(
  entry: "button" | "tap",
  notesMode: boolean,
  previous: Tap | null,
  digit: Digit,
  cell: string,
  now: number,
): { asNote: boolean; tap: Tap | null } {
  if (entry === "button") return { asNote: notesMode, tap: previous };
  const result = nextTap(previous, digit, cell, now);
  return { asNote: result.action === "note", tap: result.tap };
}
