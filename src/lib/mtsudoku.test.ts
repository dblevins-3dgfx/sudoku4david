import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchMtSudokuPuzzle, parseMtSudokuBoard } from "./mtsudoku";
import { createPuzzle, mulberry32 } from "./sudoku";

function pack(grid: number[][]): string {
  return grid.map((row) => row.join("")).join("");
}

describe("mt sudoku", () => {
  it("reads the requested difficulty, the givens, and the solution", () => {
    const { puzzle, solution } = createPuzzle("hard", mulberry32(19));
    const board = parseMtSudokuBoard(
      { puzzle: pack(puzzle), solution: pack(solution), difficulty: "hard", mode: "classic" },
      "hard",
    );
    assert.equal(board.difficulty, "hard");
    assert.deepEqual(board.puzzle, puzzle);
    assert.deepEqual(board.solution, solution);
  });

  it("rejects a board for a different difficulty", () => {
    const { puzzle, solution } = createPuzzle("easy", mulberry32(4));
    assert.throws(() =>
      parseMtSudokuBoard(
        { puzzle: pack(puzzle), solution: pack(solution), difficulty: "medium" },
        "easy",
      ),
    );
  });

  it("rejects a board whose givens disagree with the solution", () => {
    const { puzzle, solution } = createPuzzle("easy", mulberry32(4));
    const broken = puzzle.map((row) => row.slice());
    broken[0][0] = broken[0][0] === 1 ? 2 : 1;
    assert.throws(() =>
      parseMtSudokuBoard(
        { puzzle: pack(broken), solution: pack(solution), difficulty: "easy" },
        "easy",
      ),
    );
  });

  it("gives up on a request that never answers", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = hangingFetch;
    try {
      await assert.rejects(fetchMtSudokuPuzzle("easy", undefined, 20), { name: "TimeoutError" });
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("still stops when the caller aborts", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = hangingFetch;
    try {
      const controller = new AbortController();
      const request = fetchMtSudokuPuzzle("easy", controller.signal);
      controller.abort();
      await assert.rejects(request, { name: "AbortError" });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

function hangingFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    // A real pending request keeps Node running; AbortSignal.timeout alone does not.
    const pending = setTimeout(() => {}, 60_000);
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(pending);
      reject(init.signal?.reason);
    });
  });
}

// The spec's validation rules for a Mt. Sudoku board, one per test.
describe("mt sudoku board rules", () => {
  const { puzzle, solution } = createPuzzle("easy", mulberry32(4));
  const read = (fields: { puzzle?: unknown; solution?: unknown; difficulty?: unknown }) =>
    parseMtSudokuBoard({ puzzle: pack(puzzle), solution: pack(solution), difficulty: "easy", ...fields }, "easy");

  it("accepts '.' as well as '0' for an empty cell", () => {
    const dotted = pack(puzzle).replaceAll("0", ".");
    assert.deepEqual(read({ puzzle: dotted }).puzzle, puzzle);
  });

  it("rejects a solution with an empty cell", () => {
    assert.throws(() => read({ solution: "0" + pack(solution).slice(1) }));
    assert.throws(() => read({ solution: "." + pack(solution).slice(1) }));
  });

  it("rejects a solution that repeats a digit", () => {
    const text = pack(solution);
    const other = text[0] === "1" ? "2" : "1";
    assert.throws(() => read({ solution: other + text.slice(1) }));
  });

  it("rejects givens with more than one solution", () => {
    assert.throws(() => read({ puzzle: "0".repeat(81) }));
  });

  it("rejects text that is not 81 digits", () => {
    assert.throws(() => read({ puzzle: pack(puzzle).slice(1) }));
    assert.throws(() => read({ puzzle: "x" + pack(puzzle).slice(1) }));
    assert.throws(() => read({ puzzle: 7 }));
    assert.throws(() => parseMtSudokuBoard(null, "easy"));
  });

  it("treats an error status as no answer", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("busy", { status: 503 });
    try {
      await assert.rejects(fetchMtSudokuPuzzle("easy"));
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
