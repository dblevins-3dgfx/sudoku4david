import { CHECKPOINT_LIMIT } from "./checkpoints";
import type { GameState } from "./game";
import { helperOn, type HelperGroup } from "./helpers";
import { keypadBadge } from "./labels";
import type { EntryMethod, Preferences } from "./prefs";

export type ControlId = "notes" | "fill" | "erase" | "undo" | "redo" | "hint" | "explain" | "check" | "save" | "restore" | "clear";

export type ControlSpec = {
  id: ControlId;
  /** Shown as the tooltip and read by screen readers. */
  label: string;
  /** The Available helpers group that offers it; null for basic play, always shown. */
  group: HelperGroup | null;
  /** Entry methods that show this control; omitted means every method. */
  entry?: readonly EntryMethod[];
};

/**
 * The control panel's buttons, in screen order. The panel renders whichever
 * of these `visibleControls` returns, so a new control is one more row here.
 */
export const CONTROLS: readonly ControlSpec[] = [
  { id: "notes", label: "Notes", group: null, entry: ["button"] },
  { id: "fill", label: "Fill all notes", group: "notes" },
  { id: "erase", label: "Erase", group: null },
  { id: "undo", label: "Undo", group: null },
  { id: "redo", label: "Redo", group: null },
  { id: "hint", label: "Hint", group: "solving" },
  { id: "explain", label: "Explain the next step", group: "solving" },
  { id: "check", label: "Check", group: "checking" },
  { id: "save", label: "Save checkpoint", group: "guessing" },
  { id: "restore", label: "Restore checkpoint", group: "guessing" },
  { id: "clear", label: "Clear entries", group: null },
];

/** The controls shown for these preferences, in screen order. */
export function visibleControls(prefs: Preferences): ControlSpec[] {
  return CONTROLS.filter(
    (control) =>
      (!control.entry || control.entry.includes(prefs.entry)) && (!control.group || helperOn(prefs, control.group)),
  );
}

/**
 * How many controls sit in each row under the keypad from 720 pixels wide:
 * up to nine share one row; more are split over two rows, so each icon
 * stays wide enough to hit.
 */
export function deskColumns(count: number): number {
  return count <= 9 ? count : Math.ceil(count / 2);
}

/** What the control rules read: the game (null while none is loaded) and what the screen is doing. */
export type ControlContext = {
  game: GameState | null;
  /** A puzzle is being loaded or dealt. */
  busy: boolean;
  /** The Explain panel is open. */
  explaining: boolean;
};

/** The parts of a control that change with the game. */
export type ControlStatus = {
  disabled: boolean;
  pressed?: boolean;
  /** Replaces the table's label, e.g. "Hint, 2 used". */
  label?: string;
  /** A small count in the button's corner. */
  badge?: number;
};

/** True while some cell the player can change differs from the solution, so Hint has something to fix or fill. */
export function canHint(game: GameState | null): boolean {
  return (
    !!game &&
    !game.paused &&
    !game.won &&
    game.grid.some((row, r) => row.some((value, c) => !game.locked[r][c] && value !== game.solution[r][c]))
  );
}

/** A count shown on a control: its label names the count, and the badge shows it, only when it is above 0. */
function counted(count: number, label: string): Pick<ControlStatus, "label" | "badge"> {
  return count > 0 ? { label, badge: count } : {};
}

/**
 * Each control's state for the current game. Play controls are off with no
 * game, while loading, while paused, and after a win; undo and redo also need
 * a step in their direction; Save stops at CHECKPOINT_LIMIT.
 */
export function controlStatus({ game, busy, explaining }: ControlContext): Record<ControlId, ControlStatus> {
  // `?.` reads a field only when the object is there, like `p ? p->f : undefined` in C.
  const idle = !game || game.paused || busy;
  const locked = idle || game.won;
  const hints = game?.hintsUsed ?? 0;
  const saved = game?.checkpoints.length ?? 0;
  return {
    notes: { pressed: game?.notesMode ?? false, disabled: locked },
    fill: { disabled: locked },
    erase: { disabled: locked },
    undo: { disabled: idle || game.history.length === 0 },
    redo: { disabled: idle || game.future.length === 0 },
    hint: { disabled: !canHint(game) || busy, ...counted(hints, `Hint, ${hints} used`) },
    explain: { pressed: explaining, disabled: locked },
    check: { disabled: idle },
    save: { disabled: locked || saved >= CHECKPOINT_LIMIT },
    restore: { disabled: locked || saved === 0, ...counted(saved, `Restore checkpoint, ${saved} saved`) },
    clear: { disabled: !game || !game.started || busy },
  };
}

/** The header's buttons: Pause or Resume, Preferences, High scores, and New puzzle. */
export function headerStatus(game: GameState | null, busy: boolean, dialogPending: boolean) {
  return {
    pause: { disabled: !game || game.won || busy, paused: game?.paused ?? false },
    prefs: { disabled: !game || busy || dialogPending },
    scores: { disabled: dialogPending },
    newPuzzle: { disabled: busy },
  };
}

/** What the keypad reads about the selected cell and the screen. */
export type KeypadContext = {
  entry: EntryMethod;
  notesMode: boolean;
  /** The selected cell's digit, or 0 when it is empty. */
  selectedValue: number;
  /** The selected cell's pencil marks, bit d for digit d. */
  noteMask: number;
  /** Board highlighting is on, so keys show how many are still missing. */
  highlighting: boolean;
  /** Play is locked: no game, loading, paused, or won. */
  locked: boolean;
};

/** The keypad's view of the game: the selected cell, the mode, and whether play is locked. */
export function keypadContext(game: GameState | null, entry: EntryMethod, highlighting: boolean, busy: boolean): KeypadContext {
  if (!game) return { entry, notesMode: false, selectedValue: 0, noteMask: 0, highlighting, locked: true };
  const { r, c } = game.selected;
  return {
    entry,
    notesMode: game.notesMode,
    selectedValue: game.grid[r][c],
    noteMask: game.notes[r][c],
    highlighting,
    locked: game.paused || game.won || busy,
  };
}

/**
 * One digit key. It is grayed out once all nine are placed. It shows as
 * pressed when it matches the selected cell: its digit, or its pencil mark in
 * an empty cell (in notes mode for the notes button, always for tap entry).
 */
export function keypadKey(digit: number, placed: number, ctx: KeypadContext) {
  const { remaining, exhausted, over } = keypadBadge(placed);
  const marked = ctx.selectedValue === 0 && (ctx.noteMask & (1 << digit)) !== 0;
  const matches = ctx.entry === "tap" ? ctx.selectedValue === digit || marked : ctx.notesMode ? marked : ctx.selectedValue === digit;
  const label = exhausted
    ? `Enter ${digit}, all nine placed`
    : ctx.highlighting
      ? `Enter ${digit}, ${remaining} still missing`
      : `Enter ${digit}`;
  return {
    pressed: !exhausted && matches,
    disabled: ctx.locked || exhausted,
    exhausted,
    label,
    /** The "still missing" count, or null with Board highlighting off. */
    count: ctx.highlighting ? remaining : null,
    /** More than nine placed: the 0 is shown as an error. */
    over,
  };
}
