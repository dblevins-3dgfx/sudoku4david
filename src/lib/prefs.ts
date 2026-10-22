export const PREFS_STORAGE_KEY = "sudoku.prefs.v1";

export type EntryMethod = "button" | "tap";

export type Preferences = {
  entry: EntryMethod;
  showConflicts: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  entry: "button",
  showConflicts: true,
};

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
    showConflicts: typeof data.showConflicts === "boolean" ? data.showConflicts : fallback.showConflicts,
  };
}

export function loadPreferences(fallbackShowConflicts = true): Preferences {
  const fallback: Preferences = { entry: "button", showConflicts: fallbackShowConflicts };
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
