import {
  cloneGrid,
  createPuzzle,
  firstEmpty,
  gridsEqual,
  isDigit,
  type Difficulty,
  type Digit,
  type Grid,
} from "./sudoku";

export type Coord = { r: number; c: number };

export type Notes = number[][];

export type Snapshot = {
  grid: Grid;
  notes: Notes;
  locked: boolean[][];
  hintsUsed: number;
};

export type GameSource = "mtsudoku" | "generated";

export function sourceLabel(source: GameSource): string {
  return source === "mtsudoku" ? "Mt. Sudoku" : "Generated";
}

export type GameState = {
  difficulty: Difficulty;
  source: GameSource;
  puzzle: Grid;
  solution: Grid;
  grid: Grid;
  notes: Notes;
  locked: boolean[][];
  selected: Coord;
  notesMode: boolean;
  showMistakes: boolean;
  hintsUsed: number;
  elapsedMs: number;
  timerOn: boolean;
  won: boolean;
  paused: boolean;
  started: boolean;
  history: Snapshot[];
  future: Snapshot[];
};

const HISTORY_LIMIT = 100;

export function emptyNotes(): Notes {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(0));
}

export function cloneNotes(notes: Notes): Notes {
  return notes.map((row) => row.slice());
}

function cloneLocked(locked: boolean[][]): boolean[][] {
  return locked.map((row) => row.slice());
}

function snapshot(state: GameState): Snapshot {
  return {
    grid: cloneGrid(state.grid),
    notes: cloneNotes(state.notes),
    locked: cloneLocked(state.locked),
    hintsUsed: state.hintsUsed,
  };
}

function pushHistory(state: GameState): Pick<GameState, "history" | "future"> {
  const history = [...state.history, snapshot(state)];
  if (history.length > HISTORY_LIMIT) history.shift();
  return { history, future: [] };
}

function clearDigitNotes(notes: Notes, r: number, c: number, digit: Digit) {
  const bit = 1 << digit;
  for (let i = 0; i < 9; i++) {
    notes[r][i] &= ~bit;
    notes[i][c] &= ~bit;
  }
  const br = ((r / 3) | 0) * 3;
  const bc = ((c / 3) | 0) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) notes[br + i][bc + j] &= ~bit;
  }
}

function countDigit(grid: Grid, digit: number): number {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (grid[r][c] === digit) count++;
  }
  return count;
}

function clearDigitEverywhere(notes: Notes, digit: Digit) {
  const mask = ~(1 << digit);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) notes[r][c] &= mask;
  }
}

function settleLockedDigit(grid: Grid, notes: Notes, digit: Digit) {
  if (countDigit(grid, digit) >= 9) clearDigitEverywhere(notes, digit);
}

function notesAreEmpty(notes: Notes): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (notes[r][c] !== 0) return false;
  }
  return true;
}

function lockedFromPuzzle(puzzle: Grid): boolean[][] {
  return puzzle.map((row) => row.map((value) => value !== 0));
}

export function createGameFromPuzzle(
  difficulty: Difficulty,
  puzzle: Grid,
  solution: Grid,
  source: GameSource,
): GameState {
  const grid = cloneGrid(puzzle);
  return {
    difficulty,
    source,
    puzzle: cloneGrid(puzzle),
    solution: cloneGrid(solution),
    grid,
    notes: emptyNotes(),
    locked: lockedFromPuzzle(puzzle),
    selected: firstEmpty(grid) ?? { r: 0, c: 0 },
    notesMode: false,
    showMistakes: true,
    hintsUsed: 0,
    elapsedMs: 0,
    timerOn: false,
    won: false,
    paused: false,
    started: false,
    history: [],
    future: [],
  };
}

export function createGame(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): GameState {
  const { puzzle, solution } = createPuzzle(difficulty, rng);
  return createGameFromPuzzle(difficulty, puzzle, solution, "generated");
}

export function selectCell(state: GameState, r: number, c: number): GameState {
  if (state.paused || state.won) return state;
  if (state.selected.r === r && state.selected.c === c) return state;
  return { ...state, selected: { r, c } };
}

export function moveSelection(state: GameState, dr: number, dc: number): GameState {
  if (state.paused || state.won) return state;
  const r = (state.selected.r + dr + 9) % 9;
  const c = (state.selected.c + dc + 9) % 9;
  return { ...state, selected: { r, c } };
}

export function toggleNotesMode(state: GameState): GameState {
  return { ...state, notesMode: !state.notesMode };
}

export function toggleMistakes(state: GameState): GameState {
  return { ...state, showMistakes: !state.showMistakes };
}

export function togglePause(state: GameState): GameState {
  if (state.won) return state;
  if (state.paused) {
    return { ...state, paused: false, timerOn: state.started };
  }
  return { ...state, paused: true, timerOn: false };
}

function begin(state: GameState, won: boolean): Pick<GameState, "started" | "timerOn" | "won" | "paused"> {
  return {
    started: true,
    timerOn: !won && !state.paused,
    won,
    paused: state.paused,
  };
}

export function inputDigit(state: GameState, digit: Digit): GameState {
  if (state.paused || state.won) return state;
  const { r, c } = state.selected;
  if (state.locked[r][c]) return state;

  if (state.notesMode) {
    if (state.grid[r][c] !== 0) return state;
    const nextNotes = cloneNotes(state.notes);
    nextNotes[r][c] ^= 1 << digit;
    if (nextNotes[r][c] === state.notes[r][c]) return state;
    return {
      ...state,
      ...pushHistory(state),
      ...begin(state, false),
      notes: nextNotes,
    };
  }

  const nextGrid = cloneGrid(state.grid);
  const nextNotes = cloneNotes(state.notes);
  if (nextGrid[r][c] === digit) {
    nextGrid[r][c] = 0;
  } else {
    nextGrid[r][c] = digit;
    nextNotes[r][c] = 0;
    clearDigitNotes(nextNotes, r, c, digit);
    settleLockedDigit(nextGrid, nextNotes, digit);
  }

  const won = gridsEqual(nextGrid, state.solution);
  return {
    ...state,
    ...pushHistory(state),
    ...begin(state, won),
    grid: nextGrid,
    notes: nextNotes,
  };
}

export function erase(state: GameState): GameState {
  if (state.paused || state.won) return state;
  const { r, c } = state.selected;
  if (state.locked[r][c]) return state;
  if (state.grid[r][c] === 0 && state.notes[r][c] === 0) return state;
  const nextGrid = cloneGrid(state.grid);
  const nextNotes = cloneNotes(state.notes);
  nextGrid[r][c] = 0;
  nextNotes[r][c] = 0;
  return {
    ...state,
    ...pushHistory(state),
    ...begin(state, false),
    grid: nextGrid,
    notes: nextNotes,
  };
}

function hintTarget(state: GameState): Coord | null {
  const { r, c } = state.selected;
  if (!state.locked[r][c] && state.grid[r][c] !== state.solution[r][c]) {
    return { r, c };
  }
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (!state.locked[row][col] && state.grid[row][col] !== state.solution[row][col]) {
        return { r: row, c: col };
      }
    }
  }
  return null;
}

export function hint(state: GameState): GameState {
  if (state.paused || state.won) return state;
  const target = hintTarget(state);
  if (!target) return state;
  const digit = state.solution[target.r][target.c];
  if (!isDigit(digit)) return state;
  const nextGrid = cloneGrid(state.grid);
  const nextNotes = cloneNotes(state.notes);
  const nextLocked = cloneLocked(state.locked);
  nextGrid[target.r][target.c] = digit;
  nextLocked[target.r][target.c] = true;
  nextNotes[target.r][target.c] = 0;
  clearDigitNotes(nextNotes, target.r, target.c, digit);
  settleLockedDigit(nextGrid, nextNotes, digit);
  const won = gridsEqual(nextGrid, state.solution);
  return {
    ...state,
    ...pushHistory(state),
    ...begin(state, won),
    grid: nextGrid,
    notes: nextNotes,
    locked: nextLocked,
    hintsUsed: state.hintsUsed + 1,
    selected: target,
  };
}

function restore(state: GameState, snap: Snapshot, history: Snapshot[], future: Snapshot[]): GameState {
  const won = gridsEqual(snap.grid, state.solution);
  const pristine =
    history.length === 0 &&
    snap.hintsUsed === 0 &&
    notesAreEmpty(snap.notes) &&
    gridsEqual(snap.grid, state.puzzle);
  return {
    ...state,
    grid: cloneGrid(snap.grid),
    notes: cloneNotes(snap.notes),
    locked: cloneLocked(snap.locked),
    hintsUsed: snap.hintsUsed,
    history,
    future,
    won,
    started: pristine ? false : true,
    timerOn: pristine ? false : !won && !state.paused,
    elapsedMs: pristine ? 0 : state.elapsedMs,
  };
}

export function undo(state: GameState): GameState {
  if (state.paused) return state;
  const previous = state.history[state.history.length - 1];
  if (!previous) return state;
  return restore(
    state,
    previous,
    state.history.slice(0, -1),
    [...state.future, snapshot(state)],
  );
}

export function redo(state: GameState): GameState {
  if (state.paused) return state;
  const next = state.future[state.future.length - 1];
  if (!next) return state;
  return restore(state, next, [...state.history, snapshot(state)], state.future.slice(0, -1));
}

export function restart(state: GameState): GameState {
  const grid = cloneGrid(state.puzzle);
  return {
    ...state,
    grid,
    notes: emptyNotes(),
    locked: lockedFromPuzzle(state.puzzle),
    hintsUsed: 0,
    elapsedMs: 0,
    timerOn: false,
    won: false,
    paused: false,
    started: false,
    history: [],
    future: [],
    selected: firstEmpty(grid) ?? { r: 0, c: 0 },
  };
}
