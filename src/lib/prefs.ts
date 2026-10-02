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

export function parsePreferences(raw: unknown): Preferences | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<Preferences>;
  if (data.entry !== "button" && data.entry !== "tap") return null;
  if (typeof data.showConflicts !== "boolean") return null;
  return { entry: data.entry, showConflicts: data.showConflicts };
}

export function loadPreferences(fallbackShowConflicts = true): Preferences {
  const fallback: Preferences = { entry: "button", showConflicts: fallbackShowConflicts };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return fallback;
    return parsePreferences(JSON.parse(raw) as unknown) ?? fallback;
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
