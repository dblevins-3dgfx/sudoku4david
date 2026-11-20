import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HELPER_SWITCHES, helperOn, switchValue, withHelper } from "./helpers";
import { DEFAULT_PREFERENCES } from "./prefs";

describe("Available helpers", () => {
  it("has every group on by default, and the dead-end warning, Explain uses my notes, and Commentary off", () => {
    const offByDefault = ["deadEnds", "explainNotes", "commentary"];
    for (const { key } of HELPER_SWITCHES) {
      assert.equal(helperOn(DEFAULT_PREFERENCES, key), !offByDefault.includes(key), key);
    }
  });

  it("lists the switches in order", () => {
    assert.deepEqual(
      HELPER_SWITCHES.map((entry) => entry.label),
      ["Solving help", "Explain uses my notes", "Error checking", "Note helpers", "Board highlighting", "Guessing tools", "Dead-end warning", "Commentary"],
    );
  });

  it("keeps Commentary a switch of its own, inside no group", () => {
    const on = withHelper(DEFAULT_PREFERENCES, "commentary", true);
    assert.equal(on.commentary, true);
    assert.equal(helperOn(on, "commentary"), true);
    assert.equal(HELPER_SWITCHES.find((entry) => entry.key === "commentary")?.parent, undefined);
  });

  it("keeps the dead-end warning inside Guessing tools", () => {
    const warned = withHelper(DEFAULT_PREFERENCES, "deadEnds", true);
    assert.equal(helperOn(warned, "deadEnds"), true);
    const noGuessing = withHelper(warned, "guessing", false);
    assert.equal(helperOn(noGuessing, "deadEnds"), false);
    assert.equal(switchValue(noGuessing, "deadEnds"), true, "its own setting is kept for when Guessing tools comes back");
    assert.equal(HELPER_SWITCHES.find((entry) => entry.key === "deadEnds")?.parent, "guessing");
  });

  it("keeps Explain uses my notes inside Solving help", () => {
    const on = withHelper(DEFAULT_PREFERENCES, "explainNotes", true);
    assert.equal(on.explainNotes, true);
    assert.equal(helperOn(on, "explainNotes"), true);
    const noSolving = withHelper(on, "solving", false);
    assert.equal(helperOn(noSolving, "explainNotes"), false);
    assert.equal(switchValue(noSolving, "explainNotes"), true, "its own setting is kept for when Solving help comes back");
    assert.equal(HELPER_SWITCHES.find((entry) => entry.key === "explainNotes")?.parent, "solving");
  });

  it("switches one group without touching the others", () => {
    const prefs = withHelper(DEFAULT_PREFERENCES, "notes", false);
    assert.equal(helperOn(prefs, "notes"), false);
    assert.equal(prefs.noteHelpers, false);
    for (const group of ["solving", "checking", "highlighting", "guessing"] as const) assert.equal(helperOn(prefs, group), true);
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
