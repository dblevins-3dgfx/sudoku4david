// Unit tests for backup.ts and the savedAt stamp in storage.ts, run by
// `npm test` with Node's built-in test runner.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backupFileName, buildBackup, exportBackup, importBackup, parseBackup } from "./backup";
import { createGame, inputDigit } from "./game";
import { emptyStore, loadRecords, saveRecords, type ScoreRecord } from "./records";
import { GAME_STORAGE_KEY, loadGame, loadGameRaw, saveGame, savedAtOf } from "./storage";
import { mulberry32, type Digit } from "./sudoku";

// Node has no localStorage, so tests install a fake one backed by a Map on the
// global object and restore the original afterwards.
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

function rec(id: string, key: string, finishedAt: number): ScoreRecord {
  return {
    id,
    puzzleKey: key.repeat(81),
    finishedAt,
    difficulty: "easy",
    elapsedMs: 60_000,
    hintsUsed: 0,
    source: "generated",
    deviceId: "dev",
  };
}

function firstEmpty(game: ReturnType<typeof createGame>) {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (game.puzzle[r][c] === 0) return { r, c };
  throw new Error("no empty cell");
}

describe("savedAt", () => {
  it("moves only when the game changes", () => {
    withStorage(() => {
      const game = createGame("easy", mulberry32(5));
      saveGame(game, 1_000);
      assert.equal(savedAtOf(loadGameRaw()), 1_000);
      // Saving the same game again (page hidden or closed) keeps the time.
      saveGame(game, 2_000);
      assert.equal(savedAtOf(loadGameRaw()), 1_000);
      // So does the clock running on, as in a forgotten background tab.
      saveGame({ ...game, elapsedMs: 90_000 }, 2_500);
      assert.equal(savedAtOf(loadGameRaw()), 1_000);
      assert.equal(loadGame()?.elapsedMs, 90_000);
      const cell = firstEmpty(game);
      const moved = inputDigit({ ...game, selected: cell }, game.solution[cell.r][cell.c] as Digit);
      saveGame(moved, 3_000);
      assert.equal(savedAtOf(loadGameRaw()), 3_000);
      assert.deepEqual(loadGame()?.grid, moved.grid);
    });
  });

  it("keeps an unchanged game from before savedAt existed at 0", () => {
    withStorage((data) => {
      const game = createGame("easy", mulberry32(6));
      saveGame(game, 1_000);
      const { savedAt: _dropped, ...legacy } = JSON.parse(data.get(GAME_STORAGE_KEY)!);
      void _dropped;
      data.set(GAME_STORAGE_KEY, JSON.stringify(legacy));
      saveGame(game, 2_000);
      assert.equal(savedAtOf(loadGameRaw()), 0);
    });
  });

  it("reads a missing or bad time as 0", () => {
    assert.equal(savedAtOf(null), 0);
    assert.equal(savedAtOf({}), 0);
    assert.equal(savedAtOf({ savedAt: "soon" }), 0);
    assert.equal(savedAtOf({ savedAt: -5 }), 0);
    assert.equal(savedAtOf({ savedAt: 42 }), 42);
  });
});

describe("backup files", () => {
  it("names the file by local date", () => {
    assert.equal(backupFileName(new Date(2026, 0, 5, 23, 59)), "sudoku-backup-2026-01-05.json");
  });

  it("rejects files that are not backups", () => {
    assert.equal(parseBackup(null), null);
    assert.equal(parseBackup({ app: "other", version: 1 }), null);
    assert.equal(parseBackup({ app: "sudoku4david", version: 2 }), null);
    withStorage(() => {
      assert.equal(importBackup("not json"), false);
      assert.equal(importBackup(JSON.stringify({ hello: 1 })), false);
    });
  });

  it("drops a damaged game but keeps good records", () => {
    const parsed = parseBackup(
      buildBackup({ grid: "broken" }, { version: 1, records: [rec("a", "1", 10), { junk: true } as never] }, 0),
    );
    assert.ok(parsed);
    assert.equal(parsed.game, null);
    assert.deepEqual(parsed.records.records.map((r) => r.id), ["a"]);
  });

  it("round-trips into another browser, merging records and restoring the game", () => {
    const game = createGame("easy", mulberry32(9));
    const text = withStorage(() => {
      saveGame(game, 1_000);
      saveRecords({ version: 1, records: [rec("from-a", "1", 100)] });
      return exportBackup(5_000);
    });
    withStorage(() => {
      saveRecords({ version: 1, records: [rec("from-b", "2", 200)] });
      assert.equal(importBackup(text, 9_000), true);
      assert.deepEqual(loadRecords().records.map((r) => r.id), ["from-a", "from-b"]);
      assert.deepEqual(loadGame()?.puzzle, game.puzzle);
      assert.equal(savedAtOf(loadGameRaw()), 9_000);
    });
  });

  it("keeps the current game when the backup has none", () => {
    withStorage((data) => {
      const game = createGame("easy", mulberry32(3));
      saveGame(game, 1_000);
      const before = data.get(GAME_STORAGE_KEY);
      assert.equal(importBackup(JSON.stringify(buildBackup(null, emptyStore(), 0))), true);
      assert.equal(data.get(GAME_STORAGE_KEY), before);
    });
  });
});
