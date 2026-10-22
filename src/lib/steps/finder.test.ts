import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextStep, type Step } from ".";
import { cloneGrid, createPuzzle, emptyGrid, mulberry32 } from "../sudoku";
import { lockedFrom, PUZZLE, replay, SOLUTION } from "./test-helpers";

describe("nextStep", () => {
  it("names a wrong digit before anything else", () => {
    const grid = cloneGrid(PUZZLE);
    grid[0][2] = 1; // the solution has 4 here
    const advice = nextStep(grid, SOLUTION, lockedFrom(PUZZLE));
    assert.equal(advice.kind, "mistake");
    if (advice.kind !== "mistake") return;
    assert.deepEqual(advice.cell, { r: 0, c: 2 });
    assert.match(advice.text, /The 1 in row 1, column 3 is wrong/);
  });

  it("does not question locked cells", () => {
    const advice = nextStep(PUZZLE, SOLUTION, lockedFrom(PUZZLE));
    assert.equal(advice.kind, "steps");
  });

  it("reports a solved grid", () => {
    assert.deepEqual(nextStep(SOLUTION, SOLUTION, lockedFrom(PUZZLE)), { kind: "solved" });
  });

  it("finds a single on an easy puzzle and explains it", () => {
    const advice = nextStep(PUZZLE, SOLUTION, lockedFrom(PUZZLE));
    assert.equal(advice.kind, "steps");
    if (advice.kind !== "steps") return;
    assert.equal(advice.steps.length, 1);
    const [step] = advice.steps;
    assert.equal(step.technique, "hidden-single");
    assert.ok(step.place);
    assert.equal(step.place.digit, SOLUTION[step.place.r][step.place.c]);
    assert.match(step.text, /can only go in/);
  });

  it("gives up honestly when nothing it knows applies", () => {
    const advice = nextStep(emptyGrid(), SOLUTION, emptyGrid().map((row) => row.map(() => false)));
    assert.equal(advice.kind, "stuck");
  });
});

describe("solving whole puzzles step by step", () => {
  for (const difficulty of ["easy", "medium", "hard", "expert", "master", "extreme"] as const) {
    it(`never contradicts the solution on ${difficulty} puzzles`, { timeout: 60_000 }, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const { puzzle, solution } = createPuzzle(difficulty, mulberry32(seed * 101 + difficulty.length));
        const locked = lockedFrom(puzzle);
        const grid = cloneGrid(puzzle);
        for (let move = 0; move < 81; move++) {
          const advice = nextStep(grid, solution, locked);
          if (advice.kind !== "steps") {
            assert.notEqual(advice.kind, "mistake");
            break;
          }
          for (const step of advice.steps) {
            for (const { r, c, digit } of step.removals) assert.notEqual(digit, solution[r][c], step.text);
          }
          const last = advice.steps[advice.steps.length - 1];
          assert.ok(last.place, "a chain ends in a placement");
          const { r, c, digit } = last.place;
          assert.equal(digit, solution[r][c], last.text);

          // The trimmed chain alone must be enough to see the placement.
          const cand = replay(grid, advice.steps);
          if (last.technique === "naked-single") {
            assert.equal(cand[r][c], 1 << digit, last.text);
          } else {
            const others = last.unit!.cells.filter(
              (cell) => grid[cell.r][cell.c] === 0 && (cell.r !== r || cell.c !== c),
            );
            assert.ok(others.every((cell) => (cand[cell.r][cell.c] & (1 << digit)) === 0), last.text);
          }
          grid[r][c] = digit;
        }
      }
    });
  }
});

describe("X-chains in a real game", () => {
  it("the first expert test puzzle needs one, and it leads to a correct placement", () => {
    // The same puzzle as seed 1 of the expert run above.
    const { puzzle, solution } = createPuzzle("expert", mulberry32(101 + "expert".length));
    const locked = lockedFrom(puzzle);
    const grid = cloneGrid(puzzle);
    let chain: Step[] | null = null;
    for (let move = 0; move < 81 && !chain; move++) {
      const advice = nextStep(grid, solution, locked);
      assert.equal(advice.kind, "steps");
      if (advice.kind !== "steps") return;
      if (advice.steps.some((step) => step.technique === "x-chain")) chain = advice.steps;
      const { r, c, digit } = advice.steps[advice.steps.length - 1].place!;
      grid[r][c] = digit;
    }
    assert.ok(chain, "an X-chain step appears before the puzzle is solved");
    const xChain = chain.find((step) => step.technique === "x-chain")!;
    assert.match(xChain.text, /^If row \d, column \d isn't \d, /);
    assert.equal(xChain.links?.length, xChain.cells.length / 2);
  });
});
