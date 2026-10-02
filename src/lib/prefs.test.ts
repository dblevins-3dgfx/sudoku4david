import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePreferences } from "./prefs";

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

  it("rejects a partial or unknown record", () => {
    assert.equal(parsePreferences(null), null);
    assert.equal(parsePreferences({ entry: "tap" }), null);
    assert.equal(parsePreferences({ showConflicts: true }), null);
    assert.equal(parsePreferences({ entry: "pencil", showConflicts: true }), null);
    assert.equal(parsePreferences({ entry: "button", showConflicts: "yes" }), null);
  });
});
