import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardCandidates, cellsName, describeFound, finders, nextStep, type Step } from "./steps";
import { cloneGrid, createPuzzle, emptyGrid, mulberry32, type Grid } from "./sudoku";

const ALL = 0b11_1111_1110;

function bits(...digits: number[]): number {
  return digits.reduce((mask, d) => mask | (1 << d), 0);
}

function parse(rows: string): Grid {
  return rows
    .trim()
    .split("\n")
    .map((line) => [...line.trim()].map((ch) => (ch === "." ? 0 : Number(ch)))) as Grid;
}

function lockedFrom(grid: Grid): boolean[][] {
  return grid.map((row) => row.map((value) => value !== 0));
}

// A widely published easy puzzle and its solution.
const PUZZLE = parse(`
  53..7....
  6..195...
  .98....6.
  8...6...3
  4..8.3..1
  7...2...6
  .6....28.
  ...419..5
  ....8..79
`);
const SOLUTION = parse(`
  534678912
  672195348
  198342567
  859761423
  426853791
  713924856
  961537284
  287419635
  345286179
`);

/** Every open cell, all digits possible: a blank slate for the pattern tests. */
function openBoard() {
  return { grid: emptyGrid(), cand: emptyGrid().map((row) => row.map(() => ALL)) };
}

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

describe("pattern finders", () => {
  it("hidden single: a digit with one place in a box", () => {
    const { grid, cand } = openBoard();
    for (const [r, c] of [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0], [2, 1], [2, 2]]) cand[r][c] &= ~bits(4);
    const found = finders.hiddenSingle(grid, cand);
    assert.ok(found);
    assert.deepEqual(found.place, { r: 1, c: 2, digit: 4 });
    assert.equal(found.unit?.kind, "box");
  });

  it("naked single: a cell with one candidate", () => {
    const { grid, cand } = openBoard();
    cand[5][6] = bits(8);
    const found = finders.nakedSingle(grid, cand);
    assert.deepEqual(found?.place, { r: 5, c: 6, digit: 8 });
  });

  it("pointing: a box's 5s on one row clear the rest of that row", () => {
    const { grid, cand } = openBoard();
    for (let r = 1; r < 3; r++) for (let c = 0; c < 3; c++) cand[r][c] &= ~bits(5);
    const found = finders.pointing(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "pointing");
    assert.deepEqual(found.digits, [5]);
    assert.deepEqual(
      found.removals.map(({ r, c }) => [r, c]),
      [3, 4, 5, 6, 7, 8].map((c) => [0, c]),
    );
  });

  it("claiming: a row's 6s inside one box clear the rest of that box", () => {
    const { grid, cand } = openBoard();
    for (let c = 3; c < 9; c++) cand[4][c] &= ~bits(6);
    const found = finders.claiming(grid, cand);
    assert.ok(found);
    assert.equal(found.unit?.kind, "row");
    assert.equal(found.unit?.index, 4);
    assert.ok(found.removals.every(({ r, c, digit }) => digit === 6 && r !== 4 && r >= 3 && r < 6 && c < 3));
    assert.equal(found.removals.length, 6);
  });

  it("naked pair: two cells holding only 2 and 7 clear them from their row", () => {
    const { grid, cand } = openBoard();
    cand[8][0] = bits(2, 7);
    cand[8][4] = bits(2, 7);
    const found = finders.nakedSubset(grid, cand, 2);
    assert.ok(found);
    assert.equal(found.technique, "naked-pair");
    assert.equal(found.unit?.kind, "row");
    assert.deepEqual(found.digits, [2, 7]);
    assert.equal(found.removals.length, 14);
  });

  it("naked triple: three cells sharing 1, 3, and 9", () => {
    const { grid, cand } = openBoard();
    cand[0][8] = bits(1, 3);
    cand[4][8] = bits(3, 9);
    cand[7][8] = bits(1, 9);
    const found = finders.nakedSubset(grid, cand, 3);
    assert.ok(found);
    assert.equal(found.technique, "naked-triple");
    assert.equal(found.unit?.kind, "column");
    assert.deepEqual(found.digits, [1, 3, 9]);
  });

  it("hidden pair: 4 and 8 fit only in two cells of a column", () => {
    const { grid, cand } = openBoard();
    for (let r = 0; r < 9; r++) if (r !== 2 && r !== 6) cand[r][3] &= ~bits(4, 8);
    const found = finders.hiddenSubset(grid, cand, 2);
    assert.ok(found);
    assert.equal(found.technique, "hidden-pair");
    assert.deepEqual(found.cells, [{ r: 2, c: 3 }, { r: 6, c: 3 }]);
    assert.equal(found.removals.length, 14);
  });

  it("hidden triple: 1, 2, and 3 fit only in three cells of a box", () => {
    const { grid, cand } = openBoard();
    for (let r = 7; r < 9; r++) for (let c = 6; c < 9; c++) cand[r][c] &= ~bits(1, 2, 3);
    const found = finders.hiddenSubset(grid, cand, 3);
    assert.ok(found);
    assert.equal(found.technique, "hidden-triple");
    assert.deepEqual(found.digits, [1, 2, 3]);
  });
});

describe("fish and wings", () => {
  it("X-Wing: 4 only in columns 3 and 8 of rows 1 and 6 clears those columns", () => {
    const { grid, cand } = openBoard();
    for (const r of [0, 5]) for (let c = 0; c < 9; c++) if (c !== 2 && c !== 7) cand[r][c] &= ~bits(4);
    const found = finders.fish(grid, cand, 2);
    assert.ok(found);
    assert.equal(found.technique, "x-wing");
    assert.equal(found.unit, null);
    assert.deepEqual(found.digits, [4]);
    assert.deepEqual(found.cells, [{ r: 0, c: 2 }, { r: 0, c: 7 }, { r: 5, c: 2 }, { r: 5, c: 7 }]);
    assert.equal(found.removals.length, 14);
    assert.ok(found.removals.every(({ r, c, digit }) => digit === 4 && (c === 2 || c === 7) && r !== 0 && r !== 5));
    assert.equal(found.relies.length, 14, "the other seven cells of each row must be free of 4");
    assert.equal(
      describeFound(found, false).split(":")[0],
      "In rows 1 and 6, 4 can only go in columns 3 and 8. Those two rows need their 4s in those two columns, so columns 3 and 8 get their 4s in rows 1 and 6. No other cell in columns 3 and 8 can be 4",
    );
  });

  it("X-Wing works with rows and columns swapped", () => {
    const { grid, cand } = openBoard();
    for (const c of [0, 8]) for (let r = 0; r < 9; r++) if (r !== 1 && r !== 7) cand[r][c] &= ~bits(9);
    const found = finders.fish(grid, cand, 2);
    assert.ok(found);
    assert.ok(found.removals.every(({ r, c, digit }) => digit === 9 && (r === 1 || r === 7) && c !== 0 && c !== 8));
    assert.equal(found.removals.length, 14);
    assert.match(describeFound(found, false), /^In columns 1 and 9, 9 can only go in rows 2 and 8\. /);
  });

  it("Swordfish: three rows whose 5s share three columns clear those columns", () => {
    const { grid, cand } = openBoard();
    const keep: Record<number, number[]> = { 0: [0, 4], 4: [4, 8], 8: [0, 8] };
    for (const [r, cols] of Object.entries(keep)) {
      for (let c = 0; c < 9; c++) if (!cols.includes(c)) cand[Number(r)][c] &= ~bits(5);
    }
    assert.equal(finders.fish(grid, cand, 2), null, "no two of those rows make an X-Wing");
    const found = finders.fish(grid, cand, 3);
    assert.ok(found);
    assert.equal(found.technique, "swordfish");
    assert.equal(found.cells.length, 6);
    assert.equal(found.removals.length, 18);
    assert.ok(found.removals.every(({ r, c }) => [0, 4, 8].includes(c) && ![0, 4, 8].includes(r)));
    assert.match(describeFound(found, false), /^In rows 1, 5, and 9, 5 can only go in columns 1, 5, and 9\. Those three rows/);
  });

  it("XY-Wing: a 1/2 pivot with 1/3 and 2/3 pincers clears 3 where both pincers see", () => {
    const { grid, cand } = openBoard();
    cand[0][0] = bits(1, 2); // pivot
    cand[0][5] = bits(1, 3); // pincer in the pivot's row
    cand[5][0] = bits(2, 3); // pincer in the pivot's column
    const found = finders.xyWing(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "xy-wing");
    assert.deepEqual(found.cells, [{ r: 0, c: 0 }, { r: 0, c: 5 }, { r: 5, c: 0 }]);
    assert.deepEqual(found.digits, [1, 2, 3]);
    assert.deepEqual(found.removals, [{ r: 5, c: 5, digit: 3 }], "only row 6, column 6 sees both pincers");
    assert.equal(found.relies.length, 21, "each of the three cells must be down to its two digits");
    assert.equal(
      describeFound(found, false),
      "Row 1, column 1 can only be 1 or 2. It sees row 1, column 6, which can only be 1 or 3, and row 6, column 1, which can only be 2 or 3. If row 1, column 1 is 1, row 1, column 6 must be 3; if it is 2, row 6, column 1 must be 3. Either way one of those two is 3, so no cell that sees both of them can be 3: remove 3 from row 6, column 6.",
    );
  });

  it("XY-Wing needs the pincers to share the third digit", () => {
    const { grid, cand } = openBoard();
    cand[0][0] = bits(1, 2);
    cand[0][5] = bits(1, 3);
    cand[5][0] = bits(2, 4);
    assert.equal(finders.xyWing(grid, cand), null);
  });
});

/** Leaves `digit` in only the given columns of row `r`. */
function onlyIn(cand: number[][], r: number, digit: number, columns: number[]) {
  for (let c = 0; c < 9; c++) if (!columns.includes(c)) cand[r][c] &= ~bits(digit);
}

describe("X-chains", () => {
  it("three links: one of the two ends is 4, so cells seeing both lose 4", () => {
    const { grid, cand } = openBoard();
    onlyIn(cand, 0, 4, [1, 4]);
    onlyIn(cand, 6, 4, [1, 3]);
    const found = finders.xChain(grid, cand);
    assert.ok(found);
    assert.equal(found.technique, "x-chain");
    assert.equal(found.unit, null);
    assert.deepEqual(found.digits, [4]);
    assert.deepEqual(found.cells, [{ r: 0, c: 4 }, { r: 0, c: 1 }, { r: 6, c: 1 }, { r: 6, c: 3 }]);
    assert.deepEqual(
      found.links?.map((unit) => `${unit.kind} ${unit.index}`),
      ["row 0", "row 6"],
    );
    assert.deepEqual(found.removals, [
      { r: 1, c: 3, digit: 4 },
      { r: 2, c: 3, digit: 4 },
      { r: 7, c: 4, digit: 4 },
      { r: 8, c: 4, digit: 4 },
    ]);
    assert.equal(found.relies.length, 14, "the other seven cells of rows 1 and 7 must be free of 4");
    assert.equal(
      describeFound(found, false).split(":")[0],
      "If row 1, column 5 isn't 4, row 1, column 2 must be, as the only other place for 4 in row 1. Then row 7, column 2, which sees row 1, column 2, isn't 4, so row 7, column 4 must be, as the only other place for 4 in row 7. So either row 1, column 5 or row 7, column 4 is 4, and no cell that sees both can be 4",
    );
  });

  it("five links when no shorter chain removes anything", () => {
    const { grid, cand } = openBoard();
    onlyIn(cand, 0, 7, [0, 4]);
    onlyIn(cand, 3, 7, [4, 7]);
    onlyIn(cand, 6, 7, [2, 7]);
    const found = finders.xChain(grid, cand);
    assert.ok(found);
    assert.deepEqual(found.cells, [
      { r: 0, c: 0 },
      { r: 0, c: 4 },
      { r: 3, c: 4 },
      { r: 3, c: 7 },
      { r: 6, c: 7 },
      { r: 6, c: 2 },
    ]);
    assert.deepEqual(found.removals, [
      { r: 1, c: 2, digit: 7 },
      { r: 2, c: 2, digit: 7 },
      { r: 7, c: 0, digit: 7 },
      { r: 8, c: 0, digit: 7 },
    ]);
  });

  it("finds nothing when the ends share no cell with the digit", () => {
    const { grid, cand } = openBoard();
    // Rows 1 and 7 hold 4 only in columns 2/6 and 2/8: the ends, row 1
    // column 6 and row 7 column 8, are seen together only by cells in those
    // two rows, which can't be 4.
    onlyIn(cand, 0, 4, [1, 5]);
    onlyIn(cand, 6, 4, [1, 7]);
    assert.equal(finders.xChain(grid, cand), null);
  });
});

describe("cellsName", () => {
  it("groups cells that share a row or column", () => {
    assert.equal(cellsName([{ r: 1, c: 4 }, { r: 1, c: 7 }]), "row 2, columns 5 and 8");
    assert.equal(cellsName([{ r: 0, c: 2 }, { r: 3, c: 2 }, { r: 5, c: 2 }]), "column 3, rows 1, 4, and 6");
    assert.equal(cellsName([{ r: 0, c: 0 }, { r: 1, c: 1 }]), "row 1, column 1; row 2, column 2");
  });
});

/** Rebuilds the candidates from the board plus only the chain's own removals. */
function replay(grid: Grid, steps: Step[]): number[][] {
  const cand = boardCandidates(grid);
  for (const step of steps.slice(0, -1)) {
    for (const { r, c, digit } of step.removals) cand[r][c] &= ~(1 << digit);
  }
  return cand;
}

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
