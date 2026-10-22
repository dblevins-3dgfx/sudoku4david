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
import {
  candidateNotes,
  cloneNotes,
  emptyNotes,
  notesAfterPlacing,
  notesAreEmpty,
  notesEqual,
  type Notes,
} from "./notes";

import { CHECKPOINT_LIMIT, checkpointsEqual, withoutLast, type Checkpoint } from "./checkpoints";

export type Coord = { r: number; c: number };

export type Snapshot = {
  grid: Grid;
  notes: Notes;
  locked: boolean[][];
  hintsUsed: number;
  /**
   * Set when the step between this snapshot and its neighbour was Restore
   * checkpoint: the checkpoint it took off the stack. In `history` that step
   * leads away from this snapshot; in `future` it leads to it. Undo puts the
   * checkpoint back on the stack and redo takes it off again, so undoing a
   * restore loses nothing. `?:` makes the field optional; most steps have none.
   */
  popped?: Checkpoint;
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
  errors: number;
  hintsUsed: number;
  elapsedMs: number;
  timerOn: boolean;
  won: boolean;
  paused: boolean;
  started: boolean;
  history: Snapshot[];
  future: Snapshot[];
  /** Saved checkpoints, oldest first; the last is the one Restore uses. */
  checkpoints: Checkpoint[];
};

/** Undo and redo steps kept in play, in saves, and on load. */
export const HISTORY_LIMIT = 100;

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

function withPopped(snap: Snapshot, popped: Checkpoint | undefined): Snapshot {
  return popped ? { ...snap, popped } : snap;
}

/** One more hint on a saved undo or redo step; see countHint. */
function addHint(snap: Snapshot): Snapshot {
  return { ...snap, hintsUsed: snap.hintsUsed + 1 };
}

/**
 * Counts one hint so that no undo or redo can take it back: the live count and
 * every saved step get it. Once a player has seen an answer, undoing the move
 * that showed it must not hand back the hint. `.map` builds a new array, so the
 * old state's steps are left as they were.
 */
function countHint(fields: Pick<GameState, "hintsUsed" | "history" | "future">) {
  return {
    hintsUsed: fields.hintsUsed + 1,
    history: fields.history.map(addHint),
    future: fields.future.map(addHint),
  };
}

function cellConflicts(grid: Grid, r: number, c: number): boolean {
  const value = grid[r][c];
  if (value === 0) return false;
  for (let i = 0; i < 9; i++) {
    if (i !== c && grid[r][i] === value) return true;
    if (i !== r && grid[i][c] === value) return true;
  }
  const br = ((r / 3) | 0) * 3;
  const bc = ((c / 3) | 0) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if ((br + i !== r || bc + j !== c) && grid[br + i][bc + j] === value) return true;
    }
  }
  return false;
}

function pushHistory(state: GameState, popped?: Checkpoint): Pick<GameState, "history" | "future"> {
  const history = [...state.history, withPopped(snapshot(state), popped)];
  if (history.length > HISTORY_LIMIT) history.shift();
  return { history, future: [] };
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
    errors: 0,
    hintsUsed: 0,
    elapsedMs: 0,
    timerOn: false,
    won: false,
    paused: false,
    started: false,
    history: [],
    future: [],
    checkpoints: [],
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

/**
 * Enters `digit` in the selected cell, as a pencil mark when `asNote`.
 * `tidyNotes` is the Note helpers switch: when false, placing a digit clears
 * only that cell's own marks (see notesAfterPlacing).
 */
export function inputDigit(state: GameState, digit: Digit, asNote = state.notesMode, tidyNotes = true): GameState {
  if (state.paused || state.won) return state;
  const { r, c } = state.selected;
  if (state.locked[r][c]) return state;

  if (asNote) {
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
    notesAfterPlacing(nextGrid, nextNotes, r, c, digit, tidyNotes);
  }

  const won = gridsEqual(nextGrid, state.solution);
  const errors = state.errors + (state.showMistakes && cellConflicts(nextGrid, r, c) ? 1 : 0);
  return {
    ...state,
    ...pushHistory(state),
    ...begin(state, won),
    grid: nextGrid,
    notes: nextNotes,
    errors,
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

/**
 * Fill all notes: replaces the marks in every empty cell with that cell's
 * candidates (see candidateNotes), as one undo step. It is not a hint and
 * does not touch the error count. Returns the same state, recording no step,
 * when paused, after a win, or when the marks already match.
 */
export function fillNotes(state: GameState): GameState {
  if (state.paused || state.won) return state;
  const notes = candidateNotes(state.grid);
  if (notesEqual(notes, state.notes)) return state;
  return {
    ...state,
    ...pushHistory(state),
    ...begin(state, false),
    notes,
  };
}

/**
 * Picks the cell Hint fills. The selected cell wins when it is unlocked and
 * empty or wrong. Otherwise a wrong digit comes before an empty cell, because
 * every move built on a wrong digit is unreliable; the step finder's
 * nextStep() names a wrong digit first for the same reason. Within each kind
 * the first cell in reading order (row by row, left to right) is used.
 */
function hintTarget(state: GameState): Coord | null {
  const unsolved = (r: number, c: number) =>
    !state.locked[r][c] && state.grid[r][c] !== state.solution[r][c];
  const { r, c } = state.selected;
  if (unsolved(r, c)) return { r, c };
  let emptyCell: Coord | null = null;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (!unsolved(row, col)) continue;
      if (state.grid[row][col] !== 0) return { r: row, c: col };
      emptyCell ??= { r: row, c: col }; // `??=` assigns only while it is still null
    }
  }
  return emptyCell;
}

/**
 * Hint fills one cell with its solution digit. `counted` is false when an
 * explanation already counted this help (see countExplanation), so placing its
 * digit does not count twice. Undo takes back the digit but not the count, the
 * same as for an explanation, so Hint then Undo can't peek at a cell for free.
 * `tidyNotes` is the Note helpers switch, as for inputDigit.
 */
export function hint(state: GameState, counted = true, tidyNotes = true): GameState {
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
  notesAfterPlacing(nextGrid, nextNotes, target.r, target.c, digit, tidyNotes);
  const won = gridsEqual(nextGrid, state.solution);
  // The step saved here holds the board before the fill. When the hint counts,
  // countHint adds it to that step too, so undoing the fill keeps the count.
  const steps = { hintsUsed: state.hintsUsed, ...pushHistory(state) };
  return {
    ...state,
    ...(counted ? countHint(steps) : steps),
    ...begin(state, won),
    grid: nextGrid,
    notes: nextNotes,
    locked: nextLocked,
    selected: target,
  };
}

/**
 * Counts an explanation from the step finder as a hint. The board does not
 * change, so this is not an undo step. Every saved undo and redo step gets the
 * extra hint too, so undoing an earlier move can't take it back: what was
 * learned stays learned.
 */
export function countExplanation(state: GameState): GameState {
  if (state.paused || state.won) return state;
  return {
    ...state,
    ...begin(state, false),
    ...countHint(state),
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
  const back = restore(
    state,
    previous,
    state.history.slice(0, -1),
    [...state.future, withPopped(snapshot(state), previous.popped)],
  );
  // Undoing a restore puts its checkpoint back on the stack.
  return previous.popped ? { ...back, checkpoints: [...state.checkpoints, previous.popped] } : back;
}

export function redo(state: GameState): GameState {
  if (state.paused) return state;
  const next = state.future[state.future.length - 1];
  if (!next) return state;
  const forward = restore(
    state,
    next,
    [...state.history, withPopped(snapshot(state), next.popped)],
    state.future.slice(0, -1),
  );
  return next.popped ? { ...forward, checkpoints: withoutLast(state.checkpoints, next.popped) } : forward;
}

function checkpointOf(state: GameState): Checkpoint {
  return { grid: cloneGrid(state.grid), notes: cloneNotes(state.notes), locked: cloneLocked(state.locked) };
}

/**
 * Save checkpoint: pushes the board onto the checkpoint stack. It changes
 * nothing on the board, so it is not an undo step and does not start the
 * clock. It does nothing while paused, after a win, when the stack is full,
 * or when the board already matches the top checkpoint.
 */
export function saveCheckpoint(state: GameState): GameState {
  if (state.paused || state.won || state.checkpoints.length >= CHECKPOINT_LIMIT) return state;
  const cp = checkpointOf(state);
  const top = state.checkpoints[state.checkpoints.length - 1];
  if (top && checkpointsEqual(top, cp)) return state;
  return { ...state, checkpoints: [...state.checkpoints, cp] };
}

/**
 * Restore checkpoint: takes the top checkpoint off the stack and puts its
 * board back, as one undo step (undo returns both the board and the
 * checkpoint). Like undo, it keeps the clock running and leaves the error
 * count and hint total alone; a cell that a later hint locked unlocks again.
 */
export function restoreCheckpoint(state: GameState): GameState {
  if (state.paused || state.won) return state;
  const top = state.checkpoints[state.checkpoints.length - 1];
  if (!top) return state;
  const won = gridsEqual(top.grid, state.solution);
  return {
    ...state,
    ...pushHistory(state, top),
    ...begin(state, won),
    grid: cloneGrid(top.grid),
    notes: cloneNotes(top.notes),
    locked: cloneLocked(top.locked),
    checkpoints: state.checkpoints.slice(0, -1),
  };
}

export function restart(state: GameState): GameState {
  const grid = cloneGrid(state.puzzle);
  return {
    ...state,
    grid,
    notes: emptyNotes(),
    locked: lockedFromPuzzle(state.puzzle),
    hintsUsed: 0,
    errors: 0,
    elapsedMs: 0,
    timerOn: false,
    won: false,
    paused: false,
    started: false,
    history: [],
    future: [],
    checkpoints: [],
    selected: firstEmpty(grid) ?? { r: 0, c: 0 },
  };
}
