import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HELPER_SWITCHES, helperOn, withHelper } from "./helpers";
import { DEFAULT_PREFERENCES } from "./prefs";

describe("Available helpers", () => {
  it("has every group on by default", () => {
    for (const { group } of HELPER_SWITCHES) assert.equal(helperOn(DEFAULT_PREFERENCES, group), true, group);
  });

  it("lists the four switches in order", () => {
    assert.deepEqual(
      HELPER_SWITCHES.map((entry) => entry.label),
      ["Solving help", "Error checking", "Note helpers", "Board highlighting"],
    );
  });

  it("switches one group without touching the others", () => {
    const prefs = withHelper(DEFAULT_PREFERENCES, "notes", false);
    assert.equal(helperOn(prefs, "notes"), false);
    assert.equal(prefs.noteHelpers, false);
    for (const group of ["solving", "checking", "highlighting"] as const) assert.equal(helperOn(prefs, group), true);
    assert.equal(prefs.entry, DEFAULT_PREFERENCES.entry);
  });

  it("keeps Error checking in the conflicts setting", () => {
    assert.equal(withHelper(DEFAULT_PREFERENCES, "checking", false).showConflicts, false);
    assert.equal(helperOn({ ...DEFAULT_PREFERENCES, showConflicts: false }, "checking"), false);
  });

  it("does not change the preferences it is given", () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    withHelper(prefs, "solving", false);
    assert.equal(prefs.solvingHelp, true);
  });
});
