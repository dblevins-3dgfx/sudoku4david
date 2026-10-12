import {
  isValidComplete,
  type Cell,
  type Difficulty,
  type Grid,
} from "./sudoku";
import {
  cloneNotes,
  emptyNotes,
  HISTORY_LIMIT,
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

export function isDifficulty(value: unknown): value is Difficulty {
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

  const history = Array.isArray(data.history) ? data.history.filter(isSnapshot).slice(-HISTORY_LIMIT).map(copySnapshot) : [];
  const future = Array.isArray(data.future) ? data.future.filter(isSnapshot).slice(-HISTORY_LIMIT).map(copySnapshot) : [];

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

/**
 * When a stored game last changed, in UTC epoch ms, or 0 when unknown (no
 * game, or one saved before this field existed). Sync (#32) keeps whichever
 * copy of the current game changed most recently.
 */
export function savedAtOf(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const value = (raw as { savedAt?: unknown }).savedAt;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** The stored game exactly as saved (parsed JSON, savedAt included), or null. */
export function loadGameRaw(): unknown {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/**
 * True when two saved games differ at most in elapsed time and savedAt.
 * Spreading into a new object keeps each key in its original position, so
 * the JSON text of equal games is equal. (`undefined` values are left out
 * of JSON entirely.)
 */
function sameIgnoringClock(a: object, b: object): boolean {
  const strip = (game: object) => JSON.stringify({ ...game, elapsedMs: 0, savedAt: undefined });
  return strip(a) === strip(b);
}

export function saveGame(state: GameState, now = Date.now()) {
  try {
    const payload: GameState = {
      ...state,
      notes: state.notes ?? emptyNotes(),
      history: state.history.slice(-HISTORY_LIMIT),
      future: state.future.slice(-HISTORY_LIMIT),
    };
    // savedAt is when the player last changed the game, not when it was last
    // written: the game is also saved when the page is hidden or closed, and
    // every few seconds while the clock runs. Otherwise merely opening an old
    // game, or leaving its clock running in a background tab, would make it
    // "newest" for sync. So compare with what is stored, ignoring the clock
    // and savedAt itself, and keep the old time when nothing else differs
    // (0 for a game saved before savedAt existed).
    const previous = loadGameRaw();
    let savedAt = now;
    if (previous && typeof previous === "object" && sameIgnoringClock(previous, payload)) {
      savedAt = savedAtOf(previous);
    }
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ ...payload, savedAt }));
  } catch {
    // Private mode and quota failures should not interrupt play.
  }
}

/** Replaces the stored game with an already validated one, keeping its time. */
export function writeGameRaw(state: GameState, savedAt: number) {
  try {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ ...state, savedAt }));
  } catch {
    // As above.
  }
}
