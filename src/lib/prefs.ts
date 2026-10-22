export const PREFS_STORAGE_KEY = "sudoku.prefs.v1";

export type EntryMethod = "button" | "tap";

export type Preferences = {
  entry: EntryMethod;
  /**
   * The Error checking helpers: shown conflicts, the error count, and Check.
   * It keeps the field's original name so records saved before Available
   * helpers existed keep the player's choice.
   */
  showConflicts: boolean;
  /** Hint and Explain. */
  solvingHelp: boolean;
  /** Tidying pencil marks after a digit is placed. */
  noteHelpers: boolean;
  /** Peer and same-digit tints, highlighted marks, and the keypad counts. */
  highlighting: boolean;
  /** Save and restore checkpoints. */
  guessingTools: boolean;
  /** The dead-end warning; it works only while guessingTools is on. */
  deadEndWarning: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  entry: "button",
  showConflicts: true,
  solvingHelp: true,
  noteHelpers: true,
  highlighting: true,
  guessingTools: true,
  deadEndWarning: false,
};

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Reads a stored preferences record one field at a time. A field that is
 * missing or invalid takes its value from `fallback`, so adding a new field
 * later never throws away the fields an older record already holds. Returns
 * null only when `raw` is not an object at all.
 */
export function parsePreferences(raw: unknown, fallback: Preferences = DEFAULT_PREFERENCES): Preferences | null {
  if (!raw || typeof raw !== "object") return null;
  // JSON.parse gives back an untyped object, so each field is checked before use.
  const data = raw as Partial<Record<keyof Preferences, unknown>>;
  return {
    entry: data.entry === "button" || data.entry === "tap" ? data.entry : fallback.entry,
    showConflicts: flag(data.showConflicts, fallback.showConflicts),
    solvingHelp: flag(data.solvingHelp, fallback.solvingHelp),
    noteHelpers: flag(data.noteHelpers, fallback.noteHelpers),
    highlighting: flag(data.highlighting, fallback.highlighting),
    guessingTools: flag(data.guessingTools, fallback.guessingTools),
    deadEndWarning: flag(data.deadEndWarning, fallback.deadEndWarning),
  };
}

export function loadPreferences(fallbackShowConflicts = true): Preferences {
  const fallback: Preferences = { ...DEFAULT_PREFERENCES, showConflicts: fallbackShowConflicts };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return fallback;
    return parsePreferences(JSON.parse(raw) as unknown, fallback) ?? fallback;
  } catch {
    return fallback;
  }
}

export function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
