import {
  isValidComplete,
  type Cell,
  type Difficulty,
  type Grid,
} from "./sudoku";
import {
  cloneNotes,
  emptyNotes,
  type GameState,
  type Notes,
  type Snapshot,
} from "./game";

export const GAME_STORAGE_KEY = "sudoku.desk.v1";
export const THEME_STORAGE_KEY = "sudoku.theme";

function isGrid(value: unknown): value is Grid {
  if (!Array.isArray(value) || value.length !== 9) return false;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 9 &&
      row.every(
        (cell) => typeof cell === "number" && Number.isInteger(cell) && cell >= 0 && cell <= 9,
      ),
  );
}

function isNotes(value: unknown): value is Notes {
  if (!Array.isArray(value) || value.length !== 9) return false;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 9 &&
      row.every(
        (cell) =>
          typeof cell === "number" && Number.isInteger(cell) && cell >= 0 && cell <= 0x3fe,
      ),
  );
}

function isLocked(value: unknown): value is boolean[][] {
  if (!Array.isArray(value) || value.length !== 9) return false;
  return value.every(
    (row) => Array.isArray(row) && row.length === 9 && row.every((cell) => typeof cell === "boolean"),
  );
}

function isDifficulty(value: unknown): value is Difficulty {
  return (
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "expert" ||
    value === "master" ||
    value === "extreme"
  );
}

function readErrors(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as Snapshot;
  return (
    isGrid(snap.grid) &&
    isNotes(snap.notes) &&
    isLocked(snap.locked) &&
    typeof snap.hintsUsed === "number" &&
    Number.isInteger(snap.hintsUsed) &&
    snap.hintsUsed >= 0 &&
    snap.hintsUsed <= 81
  );
}

function copySnapshot(snap: Snapshot): Snapshot {
  return {
    grid: snap.grid.map((row) => row.slice()) as Grid,
    notes: cloneNotes(snap.notes),
    locked: snap.locked.map((row) => row.slice()),
    hintsUsed: snap.hintsUsed,
  };
}

export function deserializeGame(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<GameState>;
  if (!isDifficulty(data.difficulty)) return null;
  if (!isGrid(data.puzzle) || !isGrid(data.solution) || !isGrid(data.grid)) return null;
  if (!isNotes(data.notes) || !isLocked(data.locked)) return null;
  if (!isValidComplete(data.solution)) return null;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const given = data.puzzle[r][c] as Cell;
      if (given !== 0 && given !== data.solution[r][c]) return null;
      if (given !== 0 && !data.locked[r][c]) return null;
      if (data.locked[r][c] && data.grid[r][c] !== data.solution[r][c]) return null;
    }
  }

  if (
    !data.selected ||
    !Number.isInteger(data.selected.r) ||
    !Number.isInteger(data.selected.c) ||
    data.selected.r < 0 ||
    data.selected.r > 8 ||
    data.selected.c < 0 ||
    data.selected.c > 8
  ) {
    return null;
  }

  if (
    typeof data.hintsUsed !== "number" ||
    !Number.isInteger(data.hintsUsed) ||
    data.hintsUsed < 0 ||
    data.hintsUsed > 81
  ) {
    return null;
  }

  if (typeof data.elapsedMs !== "number" || !Number.isFinite(data.elapsedMs) || data.elapsedMs < 0) {
    return null;
  }

  const history = Array.isArray(data.history) ? data.history.filter(isSnapshot).slice(-100).map(copySnapshot) : [];
  const future = Array.isArray(data.future) ? data.future.filter(isSnapshot).slice(-100).map(copySnapshot) : [];

  return {
    difficulty: data.difficulty,
    source: data.source === "mtsudoku" ? "mtsudoku" : "generated",
    puzzle: data.puzzle.map((row) => row.slice()) as Grid,
    solution: data.solution.map((row) => row.slice()) as Grid,
    grid: data.grid.map((row) => row.slice()) as Grid,
    notes: cloneNotes(data.notes),
    locked: data.locked.map((row) => row.slice()),
    selected: { r: data.selected.r, c: data.selected.c },
    notesMode: Boolean(data.notesMode),
    showMistakes: data.showMistakes !== false,
    errors: readErrors(data.errors),
    hintsUsed: data.hintsUsed,
    elapsedMs: data.elapsedMs,
    timerOn: Boolean(data.timerOn) && !data.won && !data.paused,
    won: Boolean(data.won),
    paused: Boolean(data.paused) && !data.won,
    started: Boolean(data.started),
    history,
    future,
  };
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return null;
    return deserializeGame(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveGame(state: GameState) {
  try {
    const payload: GameState = {
      ...state,
      notes: state.notes ?? emptyNotes(),
      history: state.history.slice(-30),
      future: state.future.slice(-30),
    };
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode and quota failures should not interrupt play.
  }
}
