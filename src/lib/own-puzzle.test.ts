import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkGivens, editKey, setGiven } from "./own-puzzle";
import { countClues, createPuzzle, mulberry32, type Cell, type Grid } from "./sudoku";

// The puzzle in the sample photo. As printed it has six solutions.
const SAMPLE = "970000021052000470008207600000356000000198000001402900025000360430000087100000002";

function grid(text: string): Grid {
  return Array.from({ length: 9 }, (_, r) => Array.from(text.slice(r * 9, r * 9 + 9), (ch) => Number(ch) as Cell));
}

const replace = (text: string, index: number, ch: string) => text.slice(0, index) + ch + text.slice(index + 1);

describe("Setting up a puzzle from a photo: checking the givens", () => {
  it("accepts givens with one solution and returns that solution", () => {
    const { puzzle, solution } = createPuzzle("medium", mulberry32(5));
    const check = checkGivens(puzzle);
    assert.ok(check.ok);
    assert.deepEqual(check.solution, solution);
    assert.equal(check.message, `${countClues(puzzle)} givens and one solution. Ready to play.`);
  });

  it("refuses an empty grid", () => {
    const check = checkGivens(grid("0".repeat(81)));
    assert.equal(check.ok, false);
    assert.equal(check.message, "No digits yet. Enter the givens, or try another photo.");
  });

  it("refuses a digit repeated in a row, column, or box", () => {
    // A second 9 in the top row.
    const check = checkGivens(grid(replace(SAMPLE, 2, "9")));
    assert.equal(check.ok, false);
    assert.equal(check.message, "A digit repeats in a row, column, or box. Check the cells shown in red.");
  });

  it("refuses givens with more than one solution, such as the sample photo's", () => {
    const check = checkGivens(grid(SAMPLE));
    assert.equal(check.ok, false);
    assert.equal(check.message, "These digits allow more than one solution. A given may be missing.");
  });

  it("refuses givens with no solution", () => {
    // The top row holds 1 to 8, so its first cell must be 9, but column 1
    // already has a 9 further down. No digit repeats, yet nothing fits.
    const text = "012345678" + "0".repeat(27) + "9" + "0".repeat(44);
    const check = checkGivens(grid(text));
    assert.equal(check.ok, false);
    assert.equal(check.message, "These digits have no solution. A given may be misread.");
  });
});

describe("Setting up a puzzle from a photo: correcting the digits", () => {
  it("maps keys to writing, clearing, and moving", () => {
    assert.deepEqual(editKey("7"), { kind: "digit", digit: 7 });
    assert.deepEqual(editKey("0"), { kind: "digit", digit: 0 });
    assert.deepEqual(editKey("Backspace"), { kind: "digit", digit: 0 });
    assert.deepEqual(editKey("Delete"), { kind: "digit", digit: 0 });
    assert.deepEqual(editKey("ArrowLeft"), { kind: "move", dr: 0, dc: -1 });
    assert.deepEqual(editKey("ArrowDown"), { kind: "move", dr: 1, dc: 0 });
    assert.equal(editKey("n"), null);
  });

  it("changes one cell and leaves the original grid alone", () => {
    const before = grid(SAMPLE);
    const after = setGiven(before, 0, 2, 4);
    assert.equal(after[0]![2], 4);
    assert.equal(before[0]![2], 0);
    assert.equal(after[1], before[1]);
  });
});
