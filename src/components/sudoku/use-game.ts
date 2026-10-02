"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nextTap, type Tap } from "@/lib/entry";
import {
  createGame,
  createGameFromPuzzle,
  erase,
  hint,
  inputDigit,
  moveSelection,
  redo,
  restart,
  selectCell,
  toggleNotesMode,
  togglePause,
  undo,
  type GameState,
} from "@/lib/game";
import { fetchMtSudokuPuzzle } from "@/lib/mtsudoku";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type EntryMethod,
  type Preferences,
} from "@/lib/prefs";
import { loadGame, saveGame, THEME_STORAGE_KEY } from "@/lib/storage";
import {
  conflictCount,
  conflictGrid,
  countFilled,
  digitCounts,
  type Difficulty,
  type Digit,
} from "@/lib/sudoku";

export type Pending = { kind: "new" } | { kind: "restart" };

export function useGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [booting, setBooting] = useState(true);
  const [dealing, setDealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [chosen, setChosen] = useState<Difficulty>("medium");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const gameRef = useRef<GameState | null>(null);
  const dealingRef = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const prefsRef = useRef<Preferences>(DEFAULT_PREFERENCES);
  const prefsOpenRef = useRef(false);
  const tapRef = useRef<Tap | null>(null);
  const dealSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    prefsOpenRef.current = prefsOpen;
  }, [prefsOpen]);

  const commitPrefs = useCallback((next: Preferences) => {
    prefsRef.current = next;
    setPrefs(next);
    savePreferences(next);
  }, []);

  const applyShowConflicts = useCallback(
    (show: boolean) => {
      commitPrefs({ ...prefsRef.current, showConflicts: show });
      setGame((state) => {
        if (!state || state.showMistakes === show) return state;
        const next = { ...state, showMistakes: show };
        queueMicrotask(() => saveGame(next));
        return next;
      });
    },
    [commitPrefs],
  );

  const apply = useCallback((fn: (current: GameState) => GameState) => {
    setNotice(null);
    setGame((current) => {
      if (!current) return current;
      const next = fn(current);
      if (next !== current) queueMicrotask(() => saveGame(next));
      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!game?.timerOn) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.min(Math.max(now - last, 0), 2000);
      last = now;
      if (delta === 0) return;
      setGame((current) =>
        current && current.timerOn ? { ...current, elapsedMs: current.elapsedMs + delta } : current,
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [game?.timerOn]);

  useEffect(() => {
    if (!game?.timerOn) return;
    const id = window.setInterval(() => {
      if (gameRef.current) saveGame(gameRef.current);
    }, 5000);
    return () => window.clearInterval(id);
  }, [game?.timerOn]);

  useEffect(() => {
    const persist = () => {
      if (gameRef.current) saveGame(gameRef.current);
    };
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, []);

  const focusCell = (r: number, c: number) => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-coord="${r}-${c}"]`)?.focus();
    });
  };

  const deal = useCallback((difficulty: Difficulty) => {
    if (dealingRef.current) return;
    dealingRef.current = true;
    const seq = ++dealSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDealing(true);
    setPending(null);
    setPrefsOpen(false);
    setNotice(null);
    setError(null);
    void (async () => {
      const current = () => mountedRef.current && seq === dealSeq.current;
      try {
        let next: GameState;
        let dealtHere = false;
        try {
          const board = await fetchMtSudokuPuzzle(difficulty, controller.signal);
          next = createGameFromPuzzle(board.difficulty, board.puzzle, board.solution, "mtsudoku");
        } catch {
          if (!current() || controller.signal.aborted) return;
          try {
            next = createGame(difficulty);
            dealtHere = true;
          } catch {
            if (current()) setError("Couldn't compose a puzzle. Try once more.");
            return;
          }
        }
        if (!current()) return;
        if (next.showMistakes !== prefsRef.current.showConflicts) {
          next = { ...next, showMistakes: prefsRef.current.showConflicts };
        }
        setGame(next);
        setChosen(next.difficulty);
        saveGame(next);
        setNotice(dealtHere ? "Mt. Sudoku didn't answer, so this puzzle was dealt here." : null);
        setError(null);
      } finally {
        if (current()) {
          dealingRef.current = false;
          setDealing(false);
          setBooting(false);
        }
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const stored = loadGame();
      const loaded = loadPreferences(stored?.showMistakes ?? true);
      prefsRef.current = loaded;
      setPrefs(loaded);
      if (stored) {
        const next =
          stored.showMistakes === loaded.showConflicts
            ? stored
            : { ...stored, showMistakes: loaded.showConflicts };
        if (next !== stored) saveGame(next);
        setGame(next);
        setChosen(next.difficulty);
        setBooting(false);
        return;
      }
      deal("medium");
    }, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [deal]);

  const requestNew = useCallback(() => {
    setPrefsOpen(false);
    setPending({ kind: "new" });
  }, []);

  const requestRestart = useCallback(() => {
    const current = gameRef.current;
    if (!current || !current.started) return;
    if (current.won) {
      setPrefsOpen(false);
      apply(restart);
      return;
    }
    setPrefsOpen(false);
    setPending({ kind: "restart" });
  }, [apply]);

  const confirmPending = useCallback(() => {
    const current = pendingRef.current;
    if (!current || current.kind !== "restart") return;
    setPending(null);
    apply(restart);
  }, [apply]);

  const enterDigit = useCallback((digit: Digit) => {
    const current = gameRef.current;
    if (!current) return;
    if ((digitCounts(current.grid)[digit] ?? 0) >= 9) return;

    let asNote = current.notesMode;
    if (prefsRef.current.entry === "tap") {
      const cell = `${current.selected.r}-${current.selected.c}`;
      const result = nextTap(tapRef.current, digit, cell, Date.now());
      tapRef.current = result.tap;
      asNote = result.action === "note";
    }

    apply((state) => {
      if ((digitCounts(state.grid)[digit] ?? 0) >= 9) return state;
      return inputDigit(state, digit, asNote);
    });
  }, [apply]);

  const openPrefs = useCallback(() => {
    if (dealingRef.current || pendingRef.current || !gameRef.current) return;
    setPrefsOpen(true);
  }, []);

  const closePrefs = useCallback(() => setPrefsOpen(false), []);

  const setEntry = useCallback(
    (entry: EntryMethod) => {
      tapRef.current = null;
      commitPrefs({ ...prefsRef.current, entry });
    },
    [commitPrefs],
  );

  const cancelPending = useCallback(() => setPending(null), []);

  const toggleTheme = useCallback(() => {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = gameRef.current;
      if (!current || dealingRef.current) return;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        apply(event.shiftKey ? redo : undo);
        return;
      }
      if (meta || event.altKey) return;

      if (event.key === "Escape") {
        if (pendingRef.current) setPending(null);
        else if (prefsOpenRef.current) setPrefsOpen(false);
        else if (current.paused) apply(togglePause);
        return;
      }

      if (pendingRef.current || prefsOpenRef.current) return;

      if (current.paused) {
        if (event.key.toLowerCase() === "p") apply(togglePause);
        return;
      }

      if (current.won && event.key.toLowerCase() !== "p") return;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const r = (current.selected.r + 8) % 9;
        apply((state) => moveSelection(state, -1, 0));
        focusCell(r, current.selected.c);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const r = (current.selected.r + 1) % 9;
        apply((state) => moveSelection(state, 1, 0));
        focusCell(r, current.selected.c);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        const c = (current.selected.c + 8) % 9;
        apply((state) => moveSelection(state, 0, -1));
        focusCell(current.selected.r, c);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        const c = (current.selected.c + 1) % 9;
        apply((state) => moveSelection(state, 0, 1));
        focusCell(current.selected.r, c);
      } else if (/^[1-9]$/.test(event.key)) {
        enterDigit(Number(event.key) as Digit);
      } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
        event.preventDefault();
        apply(erase);
      } else if (event.key.toLowerCase() === "n") {
        if (prefsRef.current.entry === "button") apply(toggleNotesMode);
      } else if (event.key.toLowerCase() === "p") {
        apply(togglePause);
      } else if (event.key.toLowerCase() === "u") {
        apply(undo);
      } else if (event.key.toLowerCase() === "y") {
        apply(redo);
      } else if (event.key.toLowerCase() === "h") {
        apply(hint);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, enterDigit]);

  const check = useCallback(() => {
    const current = gameRef.current;
    if (!current) return;
    const conflicts = conflictCount(current.grid);
    const left = 81 - countFilled(current.grid);
    if (current.won) {
      setNotice("This grid is already solved.");
      return;
    }
    if (conflicts > 0) {
      if (!current.showMistakes || !prefsRef.current.showConflicts) applyShowConflicts(true);
      setNotice(conflicts === 1 ? "One digit is repeated." : `${conflicts} cells repeat a digit.`);
      return;
    }
    if (left === 0) {
      setNotice("The grid is full, but it isn't the solution.");
      return;
    }
    setNotice(
      left === 1 ? "No repeats yet. One cell is still open." : `No repeats yet. ${left} cells are still open.`,
    );
  }, [applyShowConflicts]);

  const conflicts = game ? conflictGrid(game.grid) : [];
  const counts = game ? digitCounts(game.grid) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const filled = game ? countFilled(game.grid) : 0;

  return {
    game,
    booting,
    dealing,
    error,
    notice,
    pending,
    chosen,
    prefs,
    prefsOpen,
    conflicts,
    counts,
    filled,
    setChosen,
    deal,
    requestNew,
    requestRestart,
    confirmPending,
    cancelPending,
    toggleTheme,
    openPrefs,
    closePrefs,
    setEntry,
    setShowConflicts: applyShowConflicts,
    select: (r: number, c: number) => apply((state) => selectCell(state, r, c)),
    input: enterDigit,
    eraseCell: () => apply(erase),
    undoMove: () => apply(undo),
    redoMove: () => apply(redo),
    toggleNotes: () => apply(toggleNotesMode),
    pause: () => apply(togglePause),
    giveHint: () => apply(hint),
    check,
  };
}
