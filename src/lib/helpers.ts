// The Available helpers section of Preferences: which groups of helpers the
// player can switch off, and whether a group is on. Every helper asks
// helperOn before it shows a button, answers a key, tints a cell, or tidies
// notes, so the rule for each group lives in one place.

import type { Preferences } from "./prefs";

/** A group of related helpers; controls name the group that offers them. */
export type HelperGroup = "solving" | "checking" | "notes" | "highlighting" | "guessing";

/**
 * A switch in Preferences: one per group, plus the dead-end warning, which
 * sits inside Guessing tools and works only while that is on.
 */
export type HelperSwitch = HelperGroup | "deadEnds";

// Which Preferences field holds each switch. `satisfies` checks the table
// against the type without widening it, a little like a static_assert.
const FIELD = {
  solving: "solvingHelp",
  checking: "showConflicts",
  notes: "noteHelpers",
  highlighting: "highlighting",
  guessing: "guessingTools",
  deadEnds: "deadEndWarning",
} as const satisfies Record<HelperSwitch, keyof Preferences>;

export type SwitchSpec = {
  key: HelperSwitch;
  label: string;
  detail: string;
  /** The switch this one sits inside; it does nothing while that one is off. */
  parent?: HelperGroup;
};

/** The switches in Preferences, in the order shown, with the words on each. */
export const HELPER_SWITCHES: readonly SwitchSpec[] = [
  { key: "solving", label: "Solving help", detail: "Hint and Explain." },
  { key: "checking", label: "Error checking", detail: "Conflicts, the error count, and Check." },
  { key: "notes", label: "Note helpers", detail: "Fill all notes, and clearing a placed digit from nearby notes." },
  { key: "highlighting", label: "Board highlighting", detail: "Row, column, box, and same-digit tints, and the keypad counts." },
  { key: "guessing", label: "Guessing tools", detail: "Save and restore checkpoints." },
  {
    key: "deadEnds",
    label: "Dead-end warning",
    detail: "Flags a cell with no candidates, or a digit with no place left.",
    parent: "guessing",
  },
];

/** True when the player's preferences have this switch on, and its parent too. */
export function helperOn(prefs: Preferences, key: HelperSwitch): boolean {
  if (key === "deadEnds" && !prefs[FIELD.guessing]) return false;
  return prefs[FIELD[key]];
}

/** The switch's own stored setting, whatever its parent is set to. */
export function switchValue(prefs: Preferences, key: HelperSwitch): boolean {
  return prefs[FIELD[key]];
}

/** The preferences with one switch on or off. */
export function withHelper(prefs: Preferences, key: HelperSwitch, on: boolean): Preferences {
  return { ...prefs, [FIELD[key]]: on };
}
