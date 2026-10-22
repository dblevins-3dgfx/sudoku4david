import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visibleControls } from "./controls";
import { DEFAULT_PREFERENCES } from "./prefs";

const ids = (prefs: Partial<typeof DEFAULT_PREFERENCES>) =>
  visibleControls({ ...DEFAULT_PREFERENCES, ...prefs }).map((control) => control.id);

describe("control panel", () => {
  it("shows nine controls in order with the notes button", () => {
    assert.deepEqual(
      ids({ entry: "button" }),
      ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "check", "clear"],
    );
  });

  it("hides only the notes control with one tap, two taps", () => {
    assert.deepEqual(
      ids({ entry: "tap" }),
      ["fill", "erase", "undo", "redo", "hint", "explain", "check", "clear"],
    );
  });

  it("hides Hint and Explain with Solving help off", () => {
    assert.deepEqual(ids({ solvingHelp: false }), ["notes", "fill", "erase", "undo", "redo", "check", "clear"]);
  });

  it("hides Check with Error checking off", () => {
    assert.deepEqual(ids({ showConflicts: false }), ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "clear"]);
  });

  it("keeps the basic controls with every helper off", () => {
    const off = { showConflicts: false, solvingHelp: false, noteHelpers: false, highlighting: false };
    assert.deepEqual(ids({ ...off, entry: "tap" }), ["erase", "undo", "redo", "clear"]);
    assert.deepEqual(ids({ ...off, noteHelpers: true, highlighting: true }), ["notes", "fill", "erase", "undo", "redo", "clear"]);
    assert.deepEqual(ids({ ...off, highlighting: true }), ["notes", "erase", "undo", "redo", "clear"]);
  });
});
