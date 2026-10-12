/**
 * Backup files (#32): the current game and high-score records in one JSON
 * file the player can download and load back, in this browser or another.
 * It needs no server, and it is the "export everything" path that keeps the
 * sync backend replaceable.
 *
 * The file holds the same JSON the app keeps in localStorage, wrapped in an
 * envelope with a version so the format can change later.
 */
import type { GameState } from "./game";
import { emptyStore, loadRecords, mergeRecords, parseRecordStore, saveRecords, type RecordStore } from "./records";
import { deserializeGame, loadGameRaw, writeGameRaw } from "./storage";

export const BACKUP_APP = "sudoku4david";

export type Backup = {
  app: typeof BACKUP_APP;
  version: 1;
  /** When the file was made, UTC epoch ms. */
  exportedAt: number;
  /** The stored game as saved (savedAt included), or null when there is none. */
  game: unknown;
  records: RecordStore;
};

/** What a valid backup file holds, after validation. */
export type ParsedBackup = {
  game: GameState | null;
  records: RecordStore;
};

export function buildBackup(rawGame: unknown, records: RecordStore, now: number): Backup {
  return { app: BACKUP_APP, version: 1, exportedAt: now, game: rawGame ?? null, records };
}

/**
 * Validates a backup read from a file. Returns null if it isn't one of ours.
 * The game and the records are validated by the same code that reads them
 * from localStorage, so a damaged game is dropped (null) rather than loaded,
 * and damaged records are skipped one by one.
 */
export function parseBackup(raw: unknown): ParsedBackup | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<Backup>;
  if (data.app !== BACKUP_APP || data.version !== 1) return null;
  const records = parseRecordStore(data.records) ?? emptyStore();
  const game = data.game ? deserializeGame(data.game) : null;
  return { game, records };
}

/** The file name offered for download, for example "sudoku-backup-2026-10-12.json". */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `sudoku-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** This browser's game and records as backup file text. */
export function exportBackup(now = Date.now()): string {
  return JSON.stringify(buildBackup(loadGameRaw(), loadRecords(), now), null, 2);
}

/**
 * Loads backup file text into this browser: records are merged with the ones
 * already here, and the backup's game (if it has one) replaces the current
 * game. The restored game is stamped as saved now, because loading it is the
 * player's latest choice. Returns false, changing nothing, when the text
 * isn't a valid backup.
 */
export function importBackup(text: string, now = Date.now()): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return false;
  }
  const backup = parseBackup(raw);
  if (!backup) return false;
  saveRecords(mergeRecords(loadRecords(), backup.records));
  if (backup.game) writeGameRaw(backup.game, now);
  return true;
}
