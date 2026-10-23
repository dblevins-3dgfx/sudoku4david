import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_PREFERENCES, loadPreferences, parsePreferences, PREFS_STORAGE_KEY } from "./prefs";

const ON = { solvingHelp: true, noteHelpers: true, highlighting: true, guessingTools: true, deadEndWarning: false, explainNotes: false, fillStyle: "plain" as const };

describe("preferences", () => {
  it("reads a complete record", () => {
    assert.deepEqual(parsePreferences({ entry: "tap", showConflicts: false, ...ON }), { entry: "tap", showConflicts: false, ...ON });
    assert.deepEqual(parsePreferences({ entry: "button", showConflicts: true, ...ON }), { entry: "button", showConflicts: true, ...ON });
  });

  it("rejects a record that is not an object", () => {
    assert.equal(parsePreferences(null), null);
    assert.equal(parsePreferences("tap"), null);
    assert.equal(parsePreferences(3), null);
  });

  it("fills a missing or invalid field from the fallback and keeps the rest", () => {
    assert.deepEqual(parsePreferences({ entry: "tap" }), { entry: "tap", showConflicts: true, ...ON });
    assert.deepEqual(parsePreferences({ showConflicts: false }), { entry: "button", showConflicts: false, ...ON });
    assert.deepEqual(parsePreferences({ entry: "pencil", showConflicts: false, ...ON }), { entry: "button", showConflicts: false, ...ON });
    assert.deepEqual(parsePreferences({ entry: "tap", showConflicts: "yes" }), { entry: "tap", showConflicts: true, ...ON });
    assert.deepEqual(parsePreferences({ entry: "tap" }, { entry: "button", showConflicts: false, ...ON }), { entry: "tap", showConflicts: false, ...ON });
  });

  it("gives a record saved before Available helpers every helper on, keeping its conflicts choice", () => {
    assert.deepEqual(parsePreferences({ entry: "tap", showConflicts: false }), {
      ...DEFAULT_PREFERENCES,
      entry: "tap",
      showConflicts: false,
    });
  });

  it("reads each helper switch, and falls back for an invalid one", () => {
    assert.deepEqual(
      parsePreferences({ entry: "button", showConflicts: true, solvingHelp: false, noteHelpers: false, highlighting: "no" }),
      { ...ON, entry: "button", showConflicts: true, solvingHelp: false, noteHelpers: false, highlighting: true },
    );
  });

  it("reads Explain uses my notes, off when missing or invalid", () => {
    assert.equal(parsePreferences({ explainNotes: true })?.explainNotes, true);
    assert.equal(parsePreferences({ entry: "tap" })?.explainNotes, false);
    assert.equal(parsePreferences({ explainNotes: "yes" })?.explainNotes, false);
  });

  it("reads the fill style, and reads a missing or unknown one as Plain", () => {
    assert.equal(parsePreferences({ fillStyle: "pointing" })?.fillStyle, "pointing");
    assert.equal(parsePreferences({ fillStyle: "plain" })?.fillStyle, "plain");
    assert.equal(parsePreferences({ entry: "tap" })?.fillStyle, "plain");
    assert.equal(parsePreferences({ fillStyle: "clever" })?.fillStyle, "plain");
  });

  it("ignores fields it does not know", () => {
    assert.deepEqual(parsePreferences({ entry: "tap", showConflicts: false, later: 1 }), { entry: "tap", showConflicts: false, ...ON });
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
    withStorage({}, () => assert.deepEqual(loadPreferences(), { entry: "button", showConflicts: true, ...ON }));
  });

  it("keep a saved game's conflict setting on a first visit with no preferences", () => {
    withStorage({}, () => assert.equal(loadPreferences(false).showConflicts, false));
  });

  it("take a field missing from stored preferences from the saved game's setting", () => {
    const stored = JSON.stringify({ entry: "tap" });
    withStorage({ [PREFS_STORAGE_KEY]: stored }, () =>
      assert.deepEqual(loadPreferences(false), { entry: "tap", showConflicts: false, ...ON }),
    );
  });

  it("use stored preferences over the saved game's setting", () => {
    const stored = JSON.stringify({ entry: "tap", showConflicts: true, ...ON });
    withStorage({ [PREFS_STORAGE_KEY]: stored }, () =>
      assert.deepEqual(loadPreferences(false), { entry: "tap", showConflicts: true, ...ON }),
    );
  });
});
