// Unit tests for sync.ts and remote-config.ts, run by `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGame, type GameState } from "./game";
import { emptyStore, type RecordStore, type ScoreRecord } from "./records";
import { syncOrigin } from "./remote-config";
import { planSync, type RemoteState } from "./sync";
import { mulberry32 } from "./sudoku";

function rec(id: string, key: string, finishedAt: number): ScoreRecord {
  return {
    id,
    puzzleKey: key.repeat(81),
    finishedAt,
    difficulty: "easy",
    elapsedMs: 60_000,
    penaltyMs: 0,
    hintsUsed: 0,
    source: "generated",
    deviceId: "dev",
  };
}

const store = (...records: ScoreRecord[]): RecordStore => ({ version: 1, records });

/** A stored game as saveGame writes it: the state plus its save time. */
function saved(seed: number, savedAt: number): GameState & { savedAt: number } {
  return { ...createGame("easy", mulberry32(seed)), savedAt };
}

const remote = (game: unknown, gameSavedAt: number, records: unknown = emptyStore()): RemoteState => ({
  game,
  gameSavedAt,
  records,
});

describe("planSync: current game", () => {
  it("adopts the server's game when it changed more recently", () => {
    const plan = planSync(saved(1, 1_000), emptyStore(), remote(saved(2, 2_000), 2_000));
    assert.ok(plan.adoptGame);
    assert.equal(plan.adoptGame.savedAt, 2_000);
    assert.deepEqual(plan.adoptGame.state.puzzle, saved(2, 0).puzzle);
    assert.equal(plan.upload, null);
  });

  it("uploads this browser's game when it is newer", () => {
    const local = saved(1, 3_000);
    const plan = planSync(local, emptyStore(), remote(saved(2, 2_000), 2_000));
    assert.equal(plan.adoptGame, null);
    assert.ok(plan.upload);
    assert.equal(plan.upload.game, local);
    assert.equal(plan.upload.gameSavedAt, 3_000);
  });

  it("lets any saved game beat a new browser's first deal (savedAt 0)", () => {
    const plan = planSync(saved(1, 0), emptyStore(), remote(saved(2, 2_000), 2_000));
    assert.ok(plan.adoptGame);
  });

  it("keeps this browser's game on a tie, and ignores a damaged server game", () => {
    assert.equal(planSync(saved(1, 2_000), emptyStore(), remote(saved(2, 2_000), 2_000)).adoptGame, null);
    const damaged = planSync(saved(1, 1_000), emptyStore(), remote({ grid: "junk" }, 5_000));
    assert.equal(damaged.adoptGame, null);
    assert.ok(damaged.upload);
  });

  it("uploads everything to an empty server, and nothing when already in step", () => {
    const local = saved(1, 1_000);
    const records = store(rec("a", "1", 10));
    const first = planSync(local, records, null);
    assert.ok(first.upload);
    assert.deepEqual(first.upload.records, records);
    const again = planSync(local, records, remote(local, 1_000, records));
    assert.equal(again.upload, null);
    assert.equal(again.recordsChanged, false);
  });
});

describe("planSync: high scores", () => {
  it("merges both sides and reports what changed", () => {
    const plan = planSync(null, store(rec("a", "1", 10)), remote(null, 0, store(rec("b", "2", 20))));
    assert.deepEqual(plan.records.records.map((r) => r.id), ["a", "b"]);
    assert.equal(plan.recordsChanged, true);
    assert.ok(plan.upload);
    assert.deepEqual(plan.upload.records, plan.records);
  });

  it("applies a reset made on the other device", () => {
    const plan = planSync(null, store(rec("a", "1", 10)), remote(null, 0, { version: 1, clearedBefore: 50, records: [] }));
    assert.deepEqual(plan.records, { version: 1, clearedBefore: 50, records: [] });
    assert.equal(plan.upload, null);
  });

  it("skips damaged server records", () => {
    const plan = planSync(null, emptyStore(), remote(null, 0, { version: 1, records: [{ bad: 1 }, rec("b", "2", 20)] }));
    assert.deepEqual(plan.records.records.map((r) => r.id), ["b"]);
  });
});

describe("syncOrigin", () => {
  it("reduces the project URL to its origin, and is empty when sync is off", () => {
    assert.equal(syncOrigin("https://abc.supabase.co/"), "https://abc.supabase.co");
    assert.equal(syncOrigin(""), "");
    assert.equal(syncOrigin("not a url"), "");
  });
});
