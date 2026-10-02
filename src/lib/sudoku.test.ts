import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLUE_RANGES,
  conflictCount,
  countClues,
  countSolutions,
  createPuzzle,
  emptyGrid,
  formatTime,
  isValidComplete,
  mulberry32,
} from "./sudoku";

describe("sudoku generator", () => {
  for (const difficulty of ["easy", "medium", "hard", "expert", "master", "extreme"] as const) {
    it(`deals a unique ${difficulty} puzzle`, { timeout: 30_000 }, () => {
      const { puzzle, solution } = createPuzzle(difficulty, mulberry32(difficulty.length * 17 + 3));
      const clues = countClues(puzzle);
      const [minClues, maxClues] = CLUE_RANGES[difficulty];
      assert.ok(isValidComplete(solution), "solution should be complete");
      assert.equal(countSolutions(puzzle, 2), 1);
      assert.ok(clues >= minClues && clues <= maxClues, `${difficulty} clues ${clues} outside ${minClues}-${maxClues}`);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (puzzle[r][c] !== 0) assert.equal(puzzle[r][c], solution[r][c]);
        }
      }
    });
  }

  it("is deterministic for a seed", { timeout: 30_000 }, () => {
    const first = createPuzzle("medium", mulberry32(11));
    const second = createPuzzle("medium", mulberry32(11));
    assert.deepEqual(first, second);
  });
});

describe("conflicts and time", () => {
  it("flags repeated digits in a row, column, and box", () => {
    const grid = emptyGrid();
    grid[0][0] = 5;
    grid[0][8] = 5;
    assert.equal(conflictCount(grid), 2);
    grid[8][0] = 5;
    assert.equal(conflictCount(grid), 3);
    grid[1][1] = 5;
    assert.equal(conflictCount(grid), 4);
  });

  it("formats a clock", () => {
    assert.equal(formatTime(0), "0:00");
    assert.equal(formatTime(61_000), "1:01");
    assert.equal(formatTime(3_661_000), "1:01:01");
  });
});
