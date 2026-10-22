import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deskColumns, visibleControls } from "./controls";
import { DEFAULT_PREFERENCES } from "./prefs";

const ids = (prefs: Partial<typeof DEFAULT_PREFERENCES>) =>
  visibleControls({ ...DEFAULT_PREFERENCES, ...prefs }).map((control) => control.id);

describe("control panel", () => {
  it("shows eleven controls in order with the notes button", () => {
    assert.deepEqual(
      ids({ entry: "button" }),
      ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "check", "save", "restore", "clear"],
    );
  });

  it("hides only the notes control with one tap, two taps", () => {
    assert.deepEqual(
      ids({ entry: "tap" }),
      ["fill", "erase", "undo", "redo", "hint", "explain", "check", "save", "restore", "clear"],
    );
  });

  it("hides Hint and Explain with Solving help off", () => {
    assert.deepEqual(ids({ solvingHelp: false }), ["notes", "fill", "erase", "undo", "redo", "check", "save", "restore", "clear"]);
  });

  it("hides Check with Error checking off", () => {
    assert.deepEqual(ids({ showConflicts: false }), ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "save", "restore", "clear"]);
  });

  it("keeps the basic controls with every helper off", () => {
    const off = { showConflicts: false, solvingHelp: false, noteHelpers: false, highlighting: false, guessingTools: false };
    assert.deepEqual(ids({ ...off, entry: "tap" }), ["erase", "undo", "redo", "clear"]);
    assert.deepEqual(ids({ ...off, noteHelpers: true, highlighting: true }), ["notes", "fill", "erase", "undo", "redo", "clear"]);
    assert.deepEqual(ids({ ...off, highlighting: true }), ["notes", "erase", "undo", "redo", "clear"]);
  });

  it("hides Save and Restore checkpoint with Guessing tools off", () => {
    assert.deepEqual(ids({ guessingTools: false }), ["notes", "fill", "erase", "undo", "redo", "hint", "explain", "check", "clear"]);
  });

  it("puts up to nine controls in one desktop row and splits more over two", () => {
    assert.equal(deskColumns(7), 7);
    assert.equal(deskColumns(9), 9);
    assert.equal(deskColumns(10), 5);
    assert.equal(deskColumns(11), 6);
  });
});
