import type { GameSource, GameState } from "./game";
import { isDifficulty } from "./storage";
import type { Difficulty, Grid } from "./sudoku";

export const RECORDS_STORAGE_KEY = "sudoku.scores.v1";
export const DEVICE_ID_STORAGE_KEY = "sudoku.device";

/** One finished game. Records are written once and never edited. */
export type ScoreRecord = {
  id: string;
  /** The puzzle's 81 givens, row by row, with 0 for empty cells. */
  puzzleKey: string;
  /** Finish time in UTC epoch milliseconds. */
  finishedAt: number;
  difficulty: Difficulty;
  elapsedMs: number;
  hintsUsed: number;
  source: GameSource;
  deviceId: string;
};

export type RecordStore = {
  version: 1;
  /** Records finished before this time were reset and no longer count. */
  clearedBefore?: number;
  records: ScoreRecord[];
};

export type Period = "week" | "month" | "all";

export function emptyStore(): RecordStore {
  return { version: 1, records: [] };
}

export function puzzleKey(puzzle: Grid): string {
  return puzzle.map((row) => row.join("")).join("");
}

function isTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is ScoreRecord {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ScoreRecord>;
  return (
    typeof data.id === "string" &&
    data.id.length > 0 &&
    typeof data.puzzleKey === "string" &&
    /^[0-9]{81}$/.test(data.puzzleKey) &&
    isTime(data.finishedAt) &&
    isDifficulty(data.difficulty) &&
    isTime(data.elapsedMs) &&
    typeof data.hintsUsed === "number" &&
    Number.isInteger(data.hintsUsed) &&
    data.hintsUsed >= 0 &&
    data.hintsUsed <= 81 &&
    (data.source === "mtsudoku" || data.source === "generated") &&
    typeof data.deviceId === "string"
  );
}

function copyRecord(record: ScoreRecord): ScoreRecord {
  return {
    id: record.id,
    puzzleKey: record.puzzleKey,
    finishedAt: record.finishedAt,
    difficulty: record.difficulty,
    elapsedMs: record.elapsedMs,
    hintsUsed: record.hintsUsed,
    source: record.source,
    deviceId: record.deviceId,
  };
}

function byFinish(a: ScoreRecord, b: ScoreRecord): number {
  if (a.finishedAt !== b.finishedAt) return a.finishedAt - b.finishedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Applies the store's rules so any two devices holding the same records end up
 * with the same list: records before `clearedBefore` are dropped, and only the
 * earliest finish of each puzzle is kept (which also drops duplicate IDs).
 */
function normalize(clearedBefore: number | undefined, records: ScoreRecord[]): RecordStore {
  const seen = new Set<string>();
  const kept: ScoreRecord[] = [];
  for (const record of [...records].sort(byFinish)) {
    if (clearedBefore !== undefined && record.finishedAt < clearedBefore) continue;
    if (seen.has(record.puzzleKey)) continue;
    seen.add(record.puzzleKey);
    kept.push(record);
  }
  return clearedBefore === undefined
    ? { version: 1, records: kept }
    : { version: 1, clearedBefore, records: kept };
}

/** Reads a stored payload, skipping invalid records. Returns null for an unknown format. */
export function parseRecordStore(raw: unknown): RecordStore | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<RecordStore>;
  if (data.version !== 1 || !Array.isArray(data.records)) return null;
  const clearedBefore = isTime(data.clearedBefore) ? data.clearedBefore : undefined;
  return normalize(clearedBefore, data.records.filter(isRecord).map(copyRecord));
}

export function hasPuzzle(store: RecordStore, key: string): boolean {
  return store.records.some((record) => record.puzzleKey === key);
}

/** Adds a record unless its puzzle already has one (only the first finish counts). */
export function addRecord(
  store: RecordStore,
  record: ScoreRecord,
): { store: RecordStore; added: boolean } {
  if (hasPuzzle(store, record.puzzleKey)) return { store, added: false };
  if (store.clearedBefore !== undefined && record.finishedAt < store.clearedBefore) {
    return { store, added: false };
  }
  return { store: normalize(store.clearedBefore, [...store.records, record]), added: true };
}

/** Combines two stores: union by ID, the later reset wins, earliest finish per puzzle. */
export function mergeRecords(a: RecordStore, b: RecordStore): RecordStore {
  const resets = [a.clearedBefore, b.clearedBefore].filter((t): t is number => t !== undefined);
  const clearedBefore = resets.length ? Math.max(...resets) : undefined;
  return normalize(clearedBefore, [...a.records, ...b.records]);
}

export function resetRecords(store: RecordStore, now: number): RecordStore {
  const clearedBefore = Math.max(now, store.clearedBefore ?? 0);
  return normalize(clearedBefore, store.records);
}

export function createRecord(
  game: GameState,
  options: { id: string; deviceId: string; finishedAt: number },
): ScoreRecord {
  return {
    id: options.id,
    puzzleKey: puzzleKey(game.puzzle),
    finishedAt: options.finishedAt,
    difficulty: game.difficulty,
    elapsedMs: game.elapsedMs,
    hintsUsed: game.hintsUsed,
    source: game.source,
    deviceId: options.deviceId,
  };
}

/** Start of the period in local time, or null for all time. Weeks start on Monday. */
export function periodStart(period: Period, now: Date): number | null {
  if (period === "all") return null;
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday).getTime();
}

function byScore(a: ScoreRecord, b: ScoreRecord): number {
  if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
  return byFinish(a, b);
}

/** Fastest records for one difficulty in a period, hinted games included. */
export function rankRecords(
  store: RecordStore,
  difficulty: Difficulty,
  period: Period,
  now: Date,
): ScoreRecord[] {
  const start = periodStart(period, now);
  return store.records
    .filter((record) => record.difficulty === difficulty)
    .filter((record) => start === null || record.finishedAt >= start)
    .sort(byScore);
}

export function topRecords(
  store: RecordStore,
  difficulty: Difficulty,
  period: Period,
  now: Date,
  limit = 10,
): ScoreRecord[] {
  return rankRecords(store, difficulty, period, now).slice(0, limit);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function loadRecords(): RecordStore {
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return emptyStore();
    return parseRecordStore(JSON.parse(raw) as unknown) ?? emptyStore();
  } catch {
    return emptyStore();
  }
}

export function saveRecords(store: RecordStore) {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private mode and quota failures should not interrupt play.
  }
}

export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return "unknown";
  }
}

/** Saves a record for a won game. Returns null when the puzzle was already recorded. */
export function recordWin(game: GameState, now = Date.now()): ScoreRecord | null {
  if (!game.won) return null;
  const record = createRecord(game, { id: randomId(), deviceId: deviceId(), finishedAt: now });
  const { store, added } = addRecord(loadRecords(), record);
  if (!added) return null;
  saveRecords(store);
  return record;
}

export function resetStoredRecords(now = Date.now()) {
  saveRecords(resetRecords(loadRecords(), now));
}
