import type { EntryMethod } from "./prefs";

/**
 * The helper groups that Preferences will be able to switch off (issue #69).
 * A control with no group is part of basic play and is always offered.
 */
export type HelperGroup = "solving" | "checking" | "notes" | "highlighting" | "guessing";

export type ControlId = "notes" | "erase" | "undo" | "redo" | "hint" | "explain" | "check" | "clear";

export type ControlSpec = {
  id: ControlId;
  /** Shown as the tooltip and read by screen readers. */
  label: string;
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
  { id: "erase", label: "Erase", group: null },
  { id: "undo", label: "Undo", group: null },
  { id: "redo", label: "Redo", group: null },
  { id: "hint", label: "Hint", group: "solving" },
  { id: "explain", label: "Explain the next step", group: "solving" },
  { id: "check", label: "Check", group: "checking" },
  { id: "clear", label: "Clear entries", group: null },
];

/** The controls shown for this entry method, in screen order. */
export function visibleControls(entry: EntryMethod): ControlSpec[] {
  return CONTROLS.filter((control) => !control.entry || control.entry.includes(entry));
}
