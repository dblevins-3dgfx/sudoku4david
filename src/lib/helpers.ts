// The Available helpers section of Preferences: which groups of helpers the
// player can switch off, and whether a group is on. Every helper asks
// helperOn before it shows a button, answers a key, tints a cell, or tidies
// notes, so the rule for each group lives in one place.

import type { Preferences } from "./prefs";

/**
 * A group of related helpers. "guessing" is for checkpoints and the
 * dead-end warning (#68); it has no switch until those exist.
 */
export type HelperGroup = "solving" | "checking" | "notes" | "highlighting" | "guessing";

/** The groups that have a switch in Preferences: the boolean fields of Preferences. */
export type SwitchedGroup = Exclude<HelperGroup, "guessing">;

// Which Preferences field holds each group's switch. `satisfies` checks the
// table against the type without widening it, a little like a static_assert.
const FIELD = {
  solving: "solvingHelp",
  checking: "showConflicts",
  notes: "noteHelpers",
  highlighting: "highlighting",
} as const satisfies Record<SwitchedGroup, keyof Preferences>;

/** The switches in Preferences, in the order shown, with the words on each. */
export const HELPER_SWITCHES: readonly { group: SwitchedGroup; label: string; detail: string }[] = [
  { group: "solving", label: "Solving help", detail: "Hint and Explain." },
  { group: "checking", label: "Error checking", detail: "Conflicts, the error count, and Check." },
  { group: "notes", label: "Note helpers", detail: "Placing a digit clears it from nearby notes." },
  { group: "highlighting", label: "Board highlighting", detail: "Row, column, box, and same-digit tints, and the keypad counts." },
];

/** True when the player offers this group of helpers. */
export function helperOn(prefs: Preferences, group: HelperGroup): boolean {
  if (group === "guessing") return true;
  return prefs[FIELD[group]];
}

/** The preferences with one group switched on or off. */
export function withHelper(prefs: Preferences, group: SwitchedGroup, on: boolean): Preferences {
  return { ...prefs, [FIELD[group]]: on };
}
