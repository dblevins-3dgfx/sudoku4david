import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadPreferences, parsePreferences, PREFS_STORAGE_KEY } from "./prefs";

describe("preferences", () => {
  it("reads a complete record", () => {
    assert.deepEqual(parsePreferences({ entry: "tap", showConflicts: false }), {
      entry: "tap",
      showConflicts: false,
    });
    assert.deepEqual(parsePreferences({ entry: "button", showConflicts: true }), {
      entry: "button",
      showConflicts: true,
    });
  });

  it("rejects a record that is not an object", () => {
    assert.equal(parsePreferences(null), null);
    assert.equal(parsePreferences("tap"), null);
    assert.equal(parsePreferences(3), null);
  });

  it("fills a missing or invalid field from the fallback and keeps the rest", () => {
    assert.deepEqual(parsePreferences({ entry: "tap" }), { entry: "tap", showConflicts: true });
    assert.deepEqual(parsePreferences({ showConflicts: false }), { entry: "button", showConflicts: false });
    assert.deepEqual(parsePreferences({ entry: "pencil", showConflicts: false }), {
      entry: "button",
      showConflicts: false,
    });
    assert.deepEqual(parsePreferences({ entry: "tap", showConflicts: "yes" }), { entry: "tap", showConflicts: true });
    assert.deepEqual(parsePreferences({ entry: "tap" }, { entry: "button", showConflicts: false }), {
      entry: "tap",
      showConflicts: false,
    });
  });

  it("ignores fields it does not know", () => {
    assert.deepEqual(parsePreferences({ entry: "tap", showConflicts: false, later: 1 }), {
      entry: "tap",
      showConflicts: false,
    });
  });
});

describe("stored preferences", () => {
  // A stand-in for the browser's localStorage, which Node does not have.
  function withStorage(entries: Record<string, string>, run: () => void) {
    const store = new Map(Object.entries(entries));
    const g = globalThis as { window?: unknown; localStorage?: unknown };
    const saved = { window: g.window, localStorage: g.localStorage };
    g.window = globalThis;
    g.localStorage = { getItem: (key: string) => store.get(key) ?? null };
    try {
      run();
    } finally {
      g.window = saved.window;
      g.localStorage = saved.localStorage;
      if (saved.window === undefined) delete g.window;
      if (saved.localStorage === undefined) delete g.localStorage;
    }
  }

  it("default to the notes button with conflicts shown", () => {
    withStorage({}, () => assert.deepEqual(loadPreferences(), { entry: "button", showConflicts: true }));
  });

  it("keep a saved game's conflict setting on a first visit with no preferences", () => {
    withStorage({}, () => assert.equal(loadPreferences(false).showConflicts, false));
  });

  it("take a field missing from stored preferences from the saved game's setting", () => {
    const stored = JSON.stringify({ entry: "tap" });
    withStorage({ [PREFS_STORAGE_KEY]: stored }, () =>
      assert.deepEqual(loadPreferences(false), { entry: "tap", showConflicts: false }),
    );
  });

  it("use stored preferences over the saved game's setting", () => {
    const stored = JSON.stringify({ entry: "tap", showConflicts: true });
    withStorage({ [PREFS_STORAGE_KEY]: stored }, () =>
      assert.deepEqual(loadPreferences(false), { entry: "tap", showConflicts: true }),
    );
  });
});
