import {
  countSolutions,
  isDigit,
  isValidComplete,
  type Cell,
  type Difficulty,
  type Grid,
} from "./sudoku";

export type RemotePuzzle = {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
};

const ENDPOINT = "https://api.mtsudoku.com/v1/generate";

export function parseMtSudokuBoard(payload: unknown, requested: Difficulty): RemotePuzzle {
  if (!payload || typeof payload !== "object") throw new Error("Mt. Sudoku sent an empty board");
  const record = payload as { puzzle?: unknown; solution?: unknown; difficulty?: unknown };
  if (record.difficulty !== requested) throw new Error("Mt. Sudoku sent a different difficulty");
  const puzzle = asGrid(record.puzzle, true);
  const solution = asGrid(record.solution, false);
  if (!puzzle || !solution) throw new Error("Mt. Sudoku sent a board this game cannot play");
  if (!isValidComplete(solution)) throw new Error("Mt. Sudoku sent a board this game cannot play");
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const given = puzzle[r][c];
      if (given !== 0 && given !== solution[r][c]) throw new Error("Mt. Sudoku sent a board this game cannot play");
    }
  }
  if (countSolutions(puzzle, 2) !== 1) throw new Error("Mt. Sudoku sent a board this game cannot play");
  return { puzzle, solution, difficulty: requested };
}

export async function fetchMtSudokuPuzzle(
  difficulty: Difficulty,
  signal?: AbortSignal,
): Promise<RemotePuzzle> {
  const url = `${ENDPOINT}?mode=classic&difficulty=${difficulty}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Mt. Sudoku didn't answer");
  return parseMtSudokuBoard(await response.json(), difficulty);
}

function asGrid(value: unknown, allowEmpty: boolean): Grid | null {
  if (typeof value !== "string" || value.length !== 81) return null;
  const grid: Cell[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < 9; c++) {
      const char = value[r * 9 + c];
      if (char === "0" || char === ".") {
        if (!allowEmpty) return null;
        row.push(0);
        continue;
      }
      const digit = Number(char);
      if (!isDigit(digit)) return null;
      row.push(digit);
    }
    grid.push(row);
  }
  return grid as Grid;
}
