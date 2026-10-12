/**
 * The decision half of sync (#32), kept free of any network or storage code
 * so it can be unit tested: given this browser's copy and the server's copy,
 * work out what each side should end up with.
 *
 * - Current game: the copy that changed most recently (by savedAt) wins. The
 *   puzzle a brand-new browser deals for itself is saved with savedAt 0, so
 *   opening the app on a new device picks up the game from the other one
 *   instead of overwriting it with that blank deal.
 * - High scores: always merged with mergeRecords, so nothing is ever lost.
 */
import type { GameState } from "./game";
import { emptyStore, mergeRecords, parseRecordStore, type RecordStore } from "./records";
import { deserializeGame, savedAtOf } from "./storage";

/** What the server holds for one player. Untyped JSON until validated. */
export type RemoteState = {
  game: unknown;
  gameSavedAt: number;
  records: unknown;
};

export type SyncPlan = {
  /** Set when the server's game should replace this browser's. */
  adoptGame: { state: GameState; savedAt: number } | null;
  /** The merged high scores, to save locally. */
  records: RecordStore;
  /** True when the merged high scores differ from this browser's. */
  recordsChanged: boolean;
  /** What to upload, or null when the server is already up to date. */
  upload: RemoteState | null;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function planSync(localRawGame: unknown, localRecords: RecordStore, remote: RemoteState | null): SyncPlan {
  const localGame = localRawGame ? deserializeGame(localRawGame) : null;
  const localAt = savedAtOf(localRawGame);
  // Anything from the server is validated like localStorage data; a damaged
  // game is ignored and damaged records are skipped.
  const remoteGame = remote?.game ? deserializeGame(remote.game) : null;
  const remoteAt = remote?.gameSavedAt ?? 0;
  const remoteRecords = parseRecordStore(remote?.records) ?? emptyStore();

  const remoteWins = remoteGame !== null && (localGame === null || remoteAt > localAt);
  const records = mergeRecords(localRecords, remoteRecords);

  const gameForServer = remoteWins ? remote!.game : localRawGame;
  const savedAtForServer = remoteWins ? remote!.gameSavedAt : localAt;
  // The server stores JSON in a form that may reorder object keys, so the
  // game is compared by its save time rather than by its text. Records are
  // comparable because parseRecordStore rebuilds them in a fixed order.
  const serverCurrent =
    remote !== null &&
    same(records, remoteRecords) &&
    (remoteWins || localGame === null || savedAtForServer === remote.gameSavedAt);

  return {
    adoptGame: remoteWins ? { state: remoteGame!, savedAt: remote!.gameSavedAt } : null,
    records,
    recordsChanged: !same(records, localRecords),
    upload: serverCurrent ? null : { game: gameForServer ?? null, gameSavedAt: savedAtForServer, records },
  };
}
