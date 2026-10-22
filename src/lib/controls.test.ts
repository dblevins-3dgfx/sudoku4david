import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visibleControls } from "./controls";

describe("control panel", () => {
  it("shows eight controls in order with the notes button", () => {
    assert.deepEqual(
      visibleControls("button").map((control) => control.id),
      ["notes", "erase", "undo", "redo", "hint", "explain", "check", "clear"],
    );
  });

  it("hides only the notes control with one tap, two taps", () => {
    assert.deepEqual(
      visibleControls("tap").map((control) => control.id),
      ["erase", "undo", "redo", "hint", "explain", "check", "clear"],
    );
  });
});
