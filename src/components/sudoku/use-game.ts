"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chooseEntry, type Tap } from "@/lib/entry";
import {
  countExplanation,
  createGame,
  createGameFromPuzzle,
  erase,
  fillNotes,
  hint,
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
import { loadRecords, placementText, puzzleKey, recordWin, resetStoredRecords } from "@/lib/records";
import { importBackup } from "@/lib/backup";
import { withHelper, type SwitchedGroup } from "@/lib/helpers";
import { hintNotice } from "@/lib/labels";
import type { Pending } from "@/lib/pending";
import {
  checkResult,
  clearEntriesAction,
  digitAllowed,
  explanationCounts,
  isNewWin,
  keyCommand,
  pressDigit,
} from "@/lib/play";
import { loadGame, saveGame } from "@/lib/storage";
import { nextStep, type Advice } from "@/lib/steps";
import { useSync } from "./use-sync";
import {
  conflictCount,
  conflictGrid,
  countClues,
  digitCounts,
  type Difficulty,
  type Digit,
  type Grid,
} from "@/lib/sudoku";

export type { Pending } from "@/lib/pending";

/**
 * An explanation from the step finder, tied to the grid it was worked out
 * for. Every move builds a new grid array, so comparing references (like
 * comparing two pointers in C++) tells whether the board has changed since.
 */
type Explained = { grid: Grid; advice: Advice; index: number };

/**
 * What the Solved screen says about records for the game just won: where it
 * placed, or that it was a replay (`placement` is null) and does not count.
 */
export type LastWin = { puzzle: string; recordId: string | null; placement: string | null; hinted: boolean };

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
  const [scoresOpen, setScoresOpen] = useState(false);
  const [lastWin, setLastWin] = useState<LastWin | null>(null);
  const [explained, setExplained] = useState<Explained | null>(null);
  // The cell the last Hint filled, which the board pulses; null once it ends.
  const [hintFlash, setHintFlash] = useState<{ r: number; c: number } | null>(null);

  const gameRef = useRef<GameState | null>(null);
  const dealingRef = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const prefsRef = useRef<Preferences>(DEFAULT_PREFERENCES);
  const prefsOpenRef = useRef(false);
  const scoresOpenRef = useRef(false);
  // Whether the current game was already won at the last render. Starts as
  // null so a game loaded already won (a reload) is not recorded again.
  const wasWonRef = useRef<boolean | null>(null);
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

  useEffect(() => {
    scoresOpenRef.current = scoresOpen;
  }, [scoresOpen]);

  // Shows a game that replaced this one: from the server, or from a backup.
  const adoptGame = useCallback((state: GameState) => {
    // A game that arrives already won must not count as a new win here.
    wasWonRef.current = null;
    setLastWin(null);
    setGame(state);
    setChosen(state.difficulty);
  }, []);

  const sync = useSync({
    ready: !booting && game !== null,
    getGame: () => gameRef.current,
    adoptGame,
  });
  const { syncNow } = sync;

  // useEffect runs after React has updated the page, here whenever `game`
  // changes. A record is written only on a true not-won to won step within
  // play; recordWin also refuses a puzzle that already has a record, which
  // covers "Same puzzle" replays.
  useEffect(() => {
    const won = game ? game.won : null;
    if (game && isNewWin(wasWonRef.current, game.won)) {
      const record = recordWin(game);
      // Setting state from an effect costs one extra render; that is fine
      // here because it happens once per win.
      setLastWin({
        puzzle: puzzleKey(game.puzzle),
        recordId: record?.id ?? null,
        placement: record ? placementText(loadRecords(), record, new Date()) : null,
        hinted: game.hintsUsed > 0,
      });
      if (record) void syncNow();
    }
    wasWonRef.current = won;
  }, [game, syncNow]);

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

  // One switch in Available helpers. Error checking also changes the game,
  // which keeps its own copy of whether conflicts are shown (see
  // applyShowConflicts); the other groups only change the preferences.
  const setHelper = useCallback(
    (group: SwitchedGroup, on: boolean) => {
      if (group === "checking") applyShowConflicts(on);
      else commitPrefs(withHelper(prefsRef.current, group, on));
      // Switching Solving help off closes an open explanation for good, so
      // switching it back on does not bring the old one back.
      if (group === "solving" && !on) setExplained(null);
    },
    [applyShowConflicts, commitPrefs],
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

  // `firstDeal` marks the puzzle a browser deals for itself when it has no
  // saved game. It is saved with savedAt 0, so sync treats it as older than
  // any game from another device and replaces it (see sync.ts).
  const deal = useCallback((difficulty: Difficulty, firstDeal = false) => {
    if (dealingRef.current) return;
    dealingRef.current = true;
    const seq = ++dealSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDealing(true);
    setPending(null);
    setPrefsOpen(false);
    setScoresOpen(false);
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
        saveGame(next, firstDeal ? 0 : undefined);
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
      deal("medium", true);
    }, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [deal]);

  const requestNew = useCallback(() => {
    setPrefsOpen(false);
    setScoresOpen(false);
    setPending({ kind: "new" });
  }, []);

  const requestRestart = useCallback(() => {
    const current = gameRef.current;
    if (!current) return;
    const action = clearEntriesAction(current);
    if (action === "none") return;
    setPrefsOpen(false);
    if (action === "now") apply(restart);
    else setPending({ kind: "restart" });
  }, [apply]);

  const confirmPending = useCallback(() => {
    const current = pendingRef.current;
    if (!current || current.kind !== "restart") return;
    setPending(null);
    apply(restart);
  }, [apply]);

  const enterDigit = useCallback((digit: Digit) => {
    const current = gameRef.current;
    if (!current || !digitAllowed(current.grid, digit)) return;

    const cell = `${current.selected.r}-${current.selected.c}`;
    const { asNote, tap } = chooseEntry(prefsRef.current.entry, current.notesMode, tapRef.current, digit, cell, Date.now());
    tapRef.current = tap;

    // The guard runs again inside apply: React may run this update later,
    // against a newer state than `current`.
    apply((state) => pressDigit(state, digit, asNote, prefsRef.current.noteHelpers));
  }, [apply]);

  // Hint, plus the notice and pulse that show which cell it filled. hint() is
  // run once here on the current state only to word the notice; apply() then
  // runs it again inside React's state update, which is the copy that counts.
  // apply() clears the notice first, and the later setNotice wins because
  // React applies queued state updates in order.
  const giveHint = useCallback(() => {
    const current = gameRef.current;
    if (!current || !prefsRef.current.solvingHelp) return;
    const tidy = prefsRef.current.noteHelpers;
    const next = hint(current, true, tidy);
    apply((state) => hint(state, true, tidy));
    const text = hintNotice(current, next);
    if (text) {
      setNotice(text);
      setHintFlash({ ...next.selected });
    }
  }, [apply]);

  const openPrefs = useCallback(() => {
    if (dealingRef.current || pendingRef.current || !gameRef.current) return;
    setPrefsOpen(true);
  }, []);

  const closePrefs = useCallback(() => setPrefsOpen(false), []);

  const openScores = useCallback(() => {
    if (pendingRef.current) return;
    setPrefsOpen(false);
    setScoresOpen(true);
  }, []);

  const closeScores = useCallback(() => setScoresOpen(false), []);

  // Loads a backup file's text. On success the restored game replaces the one
  // in memory too; otherwise the next save would write the old game back.
  const restoreBackup = useCallback((text: string): boolean => {
    if (!importBackup(text)) return false;
    const restored = loadGame();
    setLastWin(null);
    if (restored) adoptGame(restored);
    void syncNow();
    return true;
  }, [adoptGame, syncNow]);

  const resetRecords = useCallback(() => {
    resetStoredRecords();
    setLastWin(null);
    void syncNow();
  }, [syncNow]);

  const setEntry = useCallback(
    (entry: EntryMethod) => {
      tapRef.current = null;
      commitPrefs({ ...prefsRef.current, entry });
    },
    [commitPrefs],
  );

  const cancelPending = useCallback(() => setPending(null), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = gameRef.current;
      if (!current || dealingRef.current) return;
      const command = keyCommand(event, {
        dialogOpen: Boolean(pendingRef.current || prefsOpenRef.current || scoresOpenRef.current),
        paused: current.paused,
        won: current.won,
        entry: prefsRef.current.entry,
        solvingHelp: prefsRef.current.solvingHelp,
        noteHelpers: prefsRef.current.noteHelpers,
      });
      if (!command) return;
      // preventDefault stops the browser's own use of the key: scrolling for
      // arrows, "back" for Backspace in some browsers, its own undo for ⌘Z.
      // The only chord that gets this far is the undo chord.
      if (command.kind === "move" || command.kind === "erase" || event.metaKey || event.ctrlKey) {
        event.preventDefault();
      }
      switch (command.kind) {
        case "dismiss":
          if (pendingRef.current) setPending(null);
          else if (prefsOpenRef.current) setPrefsOpen(false);
          else setScoresOpen(false);
          break;
        case "move": {
          const { r, c } = moveSelection(current, command.dr, command.dc).selected;
          apply((state) => moveSelection(state, command.dr, command.dc));
          focusCell(r, c);
          break;
        }
        case "digit":
          enterDigit(command.digit);
          break;
        case "erase":
          apply(erase);
          break;
        case "notes":
          apply(toggleNotesMode);
          break;
        case "pause":
          apply(togglePause);
          break;
        case "undo":
          apply(undo);
          break;
        case "redo":
          apply(redo);
          break;
        case "hint":
          giveHint();
          break;
        case "fill":
          apply(fillNotes);
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, enterDigit, giveHint]);

  const check = useCallback(() => {
    const current = gameRef.current;
    if (!current) return;
    const result = checkResult(current.grid, current.won);
    if (result.revealConflicts && (!current.showMistakes || !prefsRef.current.showConflicts)) {
      applyShowConflicts(true);
    }
    setNotice(result.text);
  }, [applyShowConflicts]);

  // Works out the next step for the board as it stands, without changing it.
  // An explanation counts as a hint unless the finder found nothing it could
  // explain. Asking again about the same board does not count again.
  const countedGridRef = useRef<Grid | null>(null);
  const explain = useCallback(() => {
    const current = gameRef.current;
    if (!current || current.paused || current.won || !prefsRef.current.solvingHelp) return;
    const advice = nextStep(current.grid, current.solution, current.locked);
    setExplained({ grid: current.grid, advice, index: 0 });
    if (explanationCounts(advice, countedGridRef.current === current.grid)) {
      countedGridRef.current = current.grid;
      apply(countExplanation);
    } else {
      setNotice(null);
    }
  }, [apply]);

  // The explanation shows only while the board is the one it was made for.
  // Any move, undo, or new game makes a new grid, and the panel goes away by
  // itself, with no clean-up code needed.
  // Switching Solving help off hides it too (see setHelper).
  const advice =
    explained && game && explained.grid === game.grid && !game.paused && !game.won && prefs.solvingHelp
      ? explained
      : null;

  const conflicts = game ? conflictGrid(game.grid) : [];
  const counts = game ? digitCounts(game.grid) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const conflictTotal = game ? conflictCount(game.grid) : 0;
  const filled = game ? countClues(game.grid) : 0;

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
    scoresOpen,
    lastWin,
    conflicts,
    conflictTotal,
    counts,
    filled,
    setChosen,
    deal,
    requestNew,
    requestRestart,
    confirmPending,
    cancelPending,
    openPrefs,
    closePrefs,
    openScores,
    closeScores,
    resetRecords,
    restoreBackup,
    sync,
    setEntry,
    setHelper,
    select: (r: number, c: number) => apply((state) => selectCell(state, r, c)),
    input: enterDigit,
    eraseCell: () => apply(erase),
    fillAllNotes: () => apply(fillNotes),
    undoMove: () => apply(undo),
    redoMove: () => apply(redo),
    toggleNotes: () => apply(toggleNotesMode),
    pause: () => apply(togglePause),
    giveHint,
    hintFlash,
    clearHintFlash: () => setHintFlash(null),
    advice,
    explain,
    closeAdvice: () => setExplained(null),
    showAdviceStep: (index: number) => setExplained((current) => (current ? { ...current, index } : current)),
    // hint() fills the selected cell when it qualifies, so selecting the
    // step's cell first makes Hint fill exactly that one. The explanation
    // already counted as a hint, so the fill does not count again.
    fillCell: (r: number, c: number) =>
      apply((state) => hint(selectCell(state, r, c), false, prefsRef.current.noteHelpers)),
    check,
  };
}
