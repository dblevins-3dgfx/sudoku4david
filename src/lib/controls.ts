import { helperOn, type HelperGroup } from "./helpers";
import type { EntryMethod, Preferences } from "./prefs";

export type ControlId = "notes" | "fill" | "erase" | "undo" | "redo" | "hint" | "explain" | "check" | "clear";

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
  { id: "clear", label: "Clear entries", group: null },
];

/** The controls shown for these preferences, in screen order. */
export function visibleControls(prefs: Preferences): ControlSpec[] {
  return CONTROLS.filter(
    (control) =>
      (!control.entry || control.entry.includes(prefs.entry)) && (!control.group || helperOn(prefs, control.group)),
  );
}
