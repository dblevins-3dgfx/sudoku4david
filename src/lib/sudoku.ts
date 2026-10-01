export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Cell = 0 | Digit;
export type Grid = Cell[][];
export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: readonly {
  id: Difficulty;
  label: string;
  detail: string;
}[] = [
  { id: "easy", label: "Easy", detail: "More numbers already inked in" },
  { id: "medium", label: "Medium", detail: "A fair number of empty cells" },
  { id: "hard", label: "Hard", detail: "Sparse clues, still one solution" },
];

export const CLUE_RANGES: Record<Difficulty, readonly [number, number]> = {
  easy: [40, 46],
  medium: [32, 36],
  hard: [26, 30],
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const ALL_MASK = 0x3fe;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array<Cell>(9).fill(0));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice()) as Grid;
}

export function isDigit(value: number): value is Digit {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

export function countClues(grid: Grid): number {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) count++;
    }
  }
  return count;
}

export function countFilled(grid: Grid): number {
  return countClues(grid);
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function sameGroup(r1: number, c1: number, r2: number, c2: number): boolean {
  return (
    r1 === r2 ||
    c1 === c2 ||
    ((r1 / 3) | 0) === ((r2 / 3) | 0) && ((c1 / 3) | 0) === ((c2 / 3) | 0)
  );
}

export function firstEmpty(grid: Grid): { r: number; c: number } | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return { r, c };
    }
  }
  return null;
}

export function digitCounts(grid: Grid): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) counts[grid[r][c]]++;
  }
  return counts;
}

export function conflictGrid(grid: Grid): boolean[][] {
  const bad = Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));

  const mark = (cells: readonly { r: number; c: number }[]) => {
    const seen = new Map<number, { r: number; c: number }[]>();
    for (const cell of cells) {
      const value = grid[cell.r][cell.c];
      if (value === 0) continue;
      const list = seen.get(value);
      if (list) list.push(cell);
      else seen.set(value, [cell]);
    }
    for (const list of seen.values()) {
      if (list.length < 2) continue;
      for (const cell of list) bad[cell.r][cell.c] = true;
    }
  };

  for (let r = 0; r < 9; r++) {
    mark(Array.from({ length: 9 }, (_, c) => ({ r, c })));
  }
  for (let c = 0; c < 9; c++) {
    mark(Array.from({ length: 9 }, (_, r) => ({ r, c })));
  }
  for (let box = 0; box < 9; box++) {
    const br = ((box / 3) | 0) * 3;
    const bc = (box % 3) * 3;
    const cells: { r: number; c: number }[] = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) cells.push({ r: br + i, c: bc + j });
    }
    mark(cells);
  }

  return bad;
}

export function conflictCount(grid: Grid): number {
  const bad = conflictGrid(grid);
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (bad[r][c]) count++;
  }
  return count;
}

export function isValidComplete(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return false;
    }
  }
  return conflictCount(grid) === 0;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
  return arr;
}

export function countSolutions(grid: Grid, limit = 2): number {
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  const empties: number[] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const value = grid[r][c];
      if (value === 0) {
        empties.push(r * 9 + c);
        continue;
      }
      const bit = 1 << value;
      const box = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      if ((rows[r] & bit) !== 0 || (cols[c] & bit) !== 0 || (boxes[box] & bit) !== 0) {
        return 0;
      }
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[box] |= bit;
    }
  }

  let count = 0;

  const search = (index: number): void => {
    if (count >= limit) return;
    if (index === empties.length) {
      count++;
      return;
    }

    let best = index;
    let bestCount = 10;
    let bestMask = 0;

    for (let k = index; k < empties.length; k++) {
      const pos = empties[k]!;
      const r = (pos / 9) | 0;
      const c = pos % 9;
      const box = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      const mask = ALL_MASK & ~(rows[r] | cols[c] | boxes[box]);
      let bits = mask;
      let candidates = 0;
      while (bits) {
        candidates++;
        bits &= bits - 1;
      }
      if (candidates < bestCount) {
        best = k;
        bestCount = candidates;
        bestMask = mask;
        if (candidates < 2) break;
      }
    }

    if (bestCount === 0) return;

    const swapped = empties[index]!;
    empties[index] = empties[best]!;
    empties[best] = swapped;

    const pos = empties[index]!;
    const r = (pos / 9) | 0;
    const c = pos % 9;
    const box = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    let mask = bestMask;

    while (mask) {
      const bit = mask & -mask;
      mask ^= bit;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[box] |= bit;
      search(index + 1);
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[box] ^= bit;
      if (count >= limit) return;
    }
  };

  search(0);
  return count;
}

function generateSolution(rng: () => number): Grid {
  const grid = emptyGrid();
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);

  const write = (r: number, c: number, digit: number) => {
    grid[r][c] = digit as Cell;
    const bit = 1 << digit;
    const box = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[box] |= bit;
  };

  for (const box of [0, 4, 8]) {
    const br = ((box / 3) | 0) * 3;
    const bc = (box % 3) * 3;
    const digits = shuffle(DIGITS, rng);
    let cursor = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) write(br + i, bc + j, digits[cursor++]!);
    }
  }

  const open: number[] = [];
  for (let pos = 0; pos < 81; pos++) {
    const r = (pos / 9) | 0;
    const c = pos % 9;
    if (grid[r][c] === 0) open.push(pos);
  }

  const fill = (index: number): boolean => {
    if (index === open.length) return true;
    const pos = open[index]!;
    const r = (pos / 9) | 0;
    const c = pos % 9;
    const box = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    const used = rows[r] | cols[c] | boxes[box];
    const digits = shuffle(DIGITS, rng);
    for (const digit of digits) {
      const bit = 1 << digit;
      if ((used & bit) !== 0) continue;
      grid[r][c] = digit as Cell;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[box] |= bit;
      if (fill(index + 1)) return true;
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[box] ^= bit;
      grid[r][c] = 0;
    }
    return false;
  };

  if (!fill(0)) throw new Error("Failed to generate a completed grid");
  return grid;
}

function carve(puzzle: Grid, difficulty: Difficulty, rng: () => number): Grid {
  const [minClues, maxClues] = CLUE_RANGES[difficulty];
  const target = minClues + Math.floor(rng() * (maxClues - minClues + 1));
  let clues = 81;

  const tryRemove = (positions: readonly number[]): boolean => {
    const saved: Cell[] = [];
    for (const pos of positions) {
      const r = (pos / 9) | 0;
      const c = pos % 9;
      saved.push(puzzle[r][c]);
      puzzle[r][c] = 0;
    }
    if (countSolutions(puzzle, 2) === 1) {
      clues -= positions.length;
      return true;
    }
    positions.forEach((pos, index) => {
      puzzle[(pos / 9) | 0][pos % 9] = saved[index]!;
    });
    return false;
  };

  const pairs: number[][] = [[40]];
  for (let i = 0; i < 40; i++) pairs.push([i, 80 - i]);

  for (const pair of shuffle(pairs, rng)) {
    if (clues <= target) break;
    const cells = pair.filter((pos) => puzzle[(pos / 9) | 0][pos % 9] !== 0);
    if (cells.length === 0) continue;
    if (clues - cells.length >= target) {
      tryRemove(cells);
      continue;
    }
    for (const pos of shuffle(cells, rng)) {
      if (clues <= target) break;
      tryRemove([pos]);
    }
  }

  if (clues > target) {
    const order = shuffle(
      Array.from({ length: 81 }, (_, index) => index),
      rng,
    );
    for (const pos of order) {
      if (clues <= target) break;
      if (puzzle[(pos / 9) | 0][pos % 9] === 0) continue;
      tryRemove([pos]);
    }
  }

  return puzzle;
}

export function createPuzzle(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): { puzzle: Grid; solution: Grid } {
  let last: { puzzle: Grid; solution: Grid } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const solution = generateSolution(rng);
      const puzzle = carve(cloneGrid(solution), difficulty, rng);
      last = { puzzle, solution };
      const clues = countClues(puzzle);
      const [minClues, maxClues] = CLUE_RANGES[difficulty];
      if (clues >= minClues && clues <= maxClues) return last;
    } catch {
      continue;
    }
  }
  if (!last) throw new Error("Could not compose a puzzle");
  return last;
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}` : clock;
}
