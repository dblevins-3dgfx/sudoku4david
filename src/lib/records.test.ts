import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGame, type GameState } from "./game";
import {
  addRecord,
  emptyStore,
  loadRecords,
  mergeRecords,
  parseRecordStore,
  periodStart,
  puzzleKey,
  rankRecords,
  recordWin,
  resetRecords,
  resetStoredRecords,
  RECORDS_STORAGE_KEY,
  topRecords,
  type RecordStore,
  type ScoreRecord,
} from "./records";
import { mulberry32 } from "./sudoku";

const KEY_A = "1".repeat(81);
const KEY_B = "2".repeat(81);
const KEY_C = "3".repeat(81);

function rec(overrides: Partial<ScoreRecord> & Pick<ScoreRecord, "id">): ScoreRecord {
  return {
    puzzleKey: KEY_A,
    finishedAt: 1_000,
    difficulty: "hard",
    elapsedMs: 60_000,
    hintsUsed: 0,
    source: "generated",
    deviceId: "dev-1",
    ...overrides,
  };
}

function store(records: ScoreRecord[], clearedBefore?: number): RecordStore {
  return clearedBefore === undefined
    ? { version: 1, records }
    : { version: 1, clearedBefore, records };
}

function withStorage<T>(fn: (data: Map<string, string>) => T): T {
  const data = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    },
  });
  try {
    return fn(data);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

describe("records store", () => {
  it("keys a puzzle by its 81 givens", () => {
    const game = createGame("easy", mulberry32(3));
    const key = puzzleKey(game.puzzle);
    assert.match(key, /^[0-9]{81}$/);
    assert.equal(key, game.puzzle.flat().join(""));
  });

  it("adds only the first finish of a puzzle", () => {
    const first = addRecord(emptyStore(), rec({ id: "a" }));
    assert.equal(first.added, true);
    const replay = addRecord(first.store, rec({ id: "b", finishedAt: 2_000, elapsedMs: 1 }));
    assert.equal(replay.added, false);
    assert.deepEqual(replay.store.records.map((r) => r.id), ["a"]);
    const other = addRecord(replay.store, rec({ id: "c", puzzleKey: KEY_B, finishedAt: 3_000 }));
    assert.equal(other.added, true);
    assert.deepEqual(other.store.records.map((r) => r.id), ["a", "c"]);
  });

  it("parses stored data and skips invalid records", () => {
    assert.equal(parseRecordStore(null), null);
    assert.equal(parseRecordStore({ version: 2, records: [] }), null);
    assert.equal(parseRecordStore({ version: 1 }), null);
    const parsed = parseRecordStore({
      version: 1,
      clearedBefore: 500,
      records: [
        rec({ id: "ok" }),
        rec({ id: "early", puzzleKey: KEY_B, finishedAt: 100 }),
        { ...rec({ id: "bad-key" }), puzzleKey: "123" },
        { ...rec({ id: "bad-diff" }), difficulty: "impossible" },
        { ...rec({ id: "bad-hints" }), hintsUsed: -1 },
        "junk",
      ],
    });
    assert.deepEqual(parsed, store([rec({ id: "ok" })], 500));
  });
});

describe("mergeRecords", () => {
  const a1 = rec({ id: "a1", puzzleKey: KEY_A, finishedAt: 1_000 });
  const b1 = rec({ id: "b1", puzzleKey: KEY_B, finishedAt: 2_000, deviceId: "dev-2" });
  const a2 = rec({ id: "a2", puzzleKey: KEY_A, finishedAt: 3_000, elapsedMs: 1, deviceId: "dev-2" });
  const c1 = rec({ id: "c1", puzzleKey: KEY_C, finishedAt: 4_000 });

  it("unions by ID without duplicates", () => {
    const merged = mergeRecords(store([a1, c1]), store([a1, b1]));
    assert.deepEqual(merged.records.map((r) => r.id), ["a1", "b1", "c1"]);
  });

  it("keeps the earliest finish per puzzle", () => {
    assert.deepEqual(mergeRecords(store([a2]), store([a1])).records, [a1]);
    assert.deepEqual(mergeRecords(store([a1]), store([a2])).records, [a1]);
  });

  it("applies the later reset from either side", () => {
    const merged = mergeRecords(store([a1, b1, c1]), store([], 2_500));
    assert.equal(merged.clearedBefore, 2_500);
    assert.deepEqual(merged.records.map((r) => r.id), ["c1"]);
    assert.equal(mergeRecords(store([], 100), store([], 2_500)).clearedBefore, 2_500);
  });

  it("lets a puzzle count again after its record is reset", () => {
    const merged = mergeRecords(store([a1], 2_000), store([a2]));
    assert.deepEqual(merged.records.map((r) => r.id), ["a2"]);
  });

  it("is order independent and idempotent", () => {
    const x = store([a1, c1], 500);
    const y = store([a2, b1]);
    const xy = mergeRecords(x, y);
    assert.deepEqual(mergeRecords(y, x), xy);
    assert.deepEqual(mergeRecords(xy, xy), xy);
    assert.deepEqual(mergeRecords(xy, x), xy);
  });
});

describe("resetRecords", () => {
  it("clears everything finished before now and never moves the reset back", () => {
    const cleared = resetRecords(store([rec({ id: "a" })]), 5_000);
    assert.deepEqual(cleared, store([], 5_000));
    assert.equal(resetRecords(cleared, 1_000).clearedBefore, 5_000);
    const later = addRecord(cleared, rec({ id: "b", finishedAt: 6_000 }));
    assert.equal(later.added, true);
    assert.equal(addRecord(cleared, rec({ id: "c", finishedAt: 4_000 })).added, false);
  });
});

describe("periods", () => {
  it("starts weeks on Monday at local midnight", () => {
    // Wednesday 14 October 2026, mid-afternoon local time.
    const wed = new Date(2026, 9, 14, 15, 30);
    assert.equal(periodStart("week", wed), new Date(2026, 9, 12).getTime());
    const monday = new Date(2026, 9, 12, 0, 0);
    assert.equal(periodStart("week", monday), monday.getTime());
    const sunday = new Date(2026, 9, 18, 23, 59);
    assert.equal(periodStart("week", sunday), new Date(2026, 9, 12).getTime());
  });

  it("crosses month and year boundaries", () => {
    // Thursday 1 January 2026: its week began Monday 29 December 2025.
    const newYear = new Date(2026, 0, 1, 9);
    assert.equal(periodStart("week", newYear), new Date(2025, 11, 29).getTime());
    assert.equal(periodStart("month", newYear), new Date(2026, 0, 1).getTime());
    assert.equal(periodStart("month", new Date(2026, 1, 28, 23)), new Date(2026, 1, 1).getTime());
    assert.equal(periodStart("all", newYear), null);
  });
});

describe("ranking", () => {
  const now = new Date(2026, 9, 14, 12); // Wednesday
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 10).getTime();
  const records = [
    rec({ id: "this-week", puzzleKey: "4".repeat(81), finishedAt: at(2026, 9, 13), elapsedMs: 300_000 }),
    rec({ id: "last-week", puzzleKey: "5".repeat(81), finishedAt: at(2026, 9, 11), elapsedMs: 200_000 }),
    rec({
      id: "hinted",
      puzzleKey: "6".repeat(81),
      finishedAt: at(2026, 9, 12),
      elapsedMs: 250_000,
      hintsUsed: 2,
    }),
    rec({ id: "last-month", puzzleKey: "7".repeat(81), finishedAt: at(2026, 8, 30), elapsedMs: 100_000 }),
    rec({ id: "easy", puzzleKey: "8".repeat(81), finishedAt: at(2026, 9, 13), difficulty: "easy", elapsedMs: 1 }),
  ];
  const all = store(records);

  it("ranks fastest first per difficulty, hinted games included", () => {
    const ids = (period: "week" | "month" | "all") =>
      rankRecords(all, "hard", period, now).map((r) => r.id);
    assert.deepEqual(ids("week"), ["hinted", "this-week"]);
    assert.deepEqual(ids("month"), ["last-week", "hinted", "this-week"]);
    assert.deepEqual(ids("all"), ["last-month", "last-week", "hinted", "this-week"]);
    assert.deepEqual(rankRecords(all, "easy", "all", now).map((r) => r.id), ["easy"]);
  });

  it("breaks ties by finish time and limits the list", () => {
    const tied = store([
      rec({ id: "later", puzzleKey: KEY_B, finishedAt: 2_000 }),
      rec({ id: "sooner", puzzleKey: KEY_A, finishedAt: 1_000 }),
      rec({ id: "slow", puzzleKey: KEY_C, finishedAt: 500, elapsedMs: 90_000 }),
    ]);
    assert.deepEqual(topRecords(tied, "hard", "all", now, 2).map((r) => r.id), ["sooner", "later"]);
  });
});

describe("stored records", () => {
  function wonGame(): GameState {
    return { ...createGame("easy", mulberry32(11)), won: true, elapsedMs: 123_000, hintsUsed: 1 };
  }

  it("records a win once and survives a reload", () => {
    withStorage(() => {
      const game = wonGame();
      const record = recordWin(game, 10_000);
      assert.ok(record);
      assert.equal(record.puzzleKey, puzzleKey(game.puzzle));
      assert.equal(record.elapsedMs, 123_000);
      assert.equal(record.hintsUsed, 1);
      assert.ok(record.id.length > 0);
      assert.ok(record.deviceId.length > 0);
      assert.equal(recordWin(game, 20_000), null);
      assert.deepEqual(loadRecords().records, [record]);
    });
  });

  it("ignores unfinished games, corrupt data, and resets", () => {
    withStorage((data) => {
      assert.equal(recordWin({ ...wonGame(), won: false }), null);
      data.set(RECORDS_STORAGE_KEY, "{not json");
      assert.deepEqual(loadRecords(), emptyStore());
      const game = wonGame();
      assert.ok(recordWin(game, 10_000));
      resetStoredRecords(15_000);
      assert.deepEqual(loadRecords(), store([], 15_000));
      assert.ok(recordWin(game, 20_000));
    });
  });
});
