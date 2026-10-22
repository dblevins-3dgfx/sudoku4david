import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countExplanation,
  createGame,
  createGameFromPuzzle,
  erase,
  HISTORY_LIMIT,
  hint,
  inputDigit,
  redo,
  restart,
  toggleNotesMode,
  undo,
  type GameState,
} from "./game";
import { deserializeGame, loadGame, saveGame } from "./storage";
import { gridsEqual, mulberry32, type Digit } from "./sudoku";

function playSolution(state: GameState): GameState {
  let game = state;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (game.puzzle[r][c] !== 0) continue;
      game = { ...game, selected: { r, c } };
      game = inputDigit(game, game.solution[r][c] as Digit);
    }
  }
  return game;
}

describe("play", () => {
  it("locks givens, records notes, and solves", { timeout: 20_000 }, () => {
    let game = createGame("easy", mulberry32(8));
    const given = game.puzzle.flatMap((row, r) =>
      row.flatMap((value, c) => (value ? [{ r, c, value }] : [])),
    );
    assert.ok(given.length > 0);
    const locked = given[0]!;
    game = { ...game, selected: { r: locked.r, c: locked.c } };
    const ignored = inputDigit(game, locked.value === 1 ? 2 : 1);
    assert.equal(ignored.grid[locked.r][locked.c], locked.value);

    const empty = game.grid.flatMap((row, r) =>
      row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])),
    )[0]!;
    game = toggleNotesMode({ ...game, selected: empty });
    game = inputDigit(game, 4);
    assert.equal(game.notes[empty.r][empty.c] & (1 << 4), 1 << 4);
    game = undo(game);
    assert.equal(game.notes[empty.r][empty.c], 0);
    game = redo(game);
    assert.equal(game.notes[empty.r][empty.c] & (1 << 4), 1 << 4);

    game = toggleNotesMode(game);
    game = inputDigit(game, game.solution[empty.r][empty.c] as Digit);
    assert.equal(game.grid[empty.r][empty.c], game.solution[empty.r][empty.c]);
    assert.equal(game.notes[empty.r][empty.c], 0);

    const solved = playSolution(createGame("easy", mulberry32(8)));
    assert.ok(solved.won);
    assert.equal(solved.timerOn, false);
    assert.ok(gridsEqual(solved.grid, solved.solution));
  });

  it("counts an explanation as a hint that undo keeps", { timeout: 20_000 }, () => {
    let game = createGame("medium", mulberry32(21));
    game = hint(game);
    game = countExplanation(game);
    assert.equal(game.hintsUsed, 2);
    assert.equal(game.history.length, 1, "an explanation is not an undo step");
    game = undo(game);
    assert.equal(game.hintsUsed, 2, "undo takes back the fill, not the hint or the explanation");
    game = redo(game);
    assert.equal(game.hintsUsed, 2);
  });

  it("keeps a hint counted after undo takes back its digit", { timeout: 20_000 }, () => {
    const fresh = createGame("medium", mulberry32(21));
    const hinted = hint(fresh);
    const { r, c } = hinted.selected;
    assert.equal(hinted.hintsUsed, 1);
    let game = undo(hinted);
    assert.equal(game.grid[r][c], fresh.grid[r][c], "undo empties the hinted cell");
    assert.equal(game.locked[r][c], false);
    assert.equal(game.hintsUsed, 1, "undo does not give the hint back");
    assert.equal(game.started, true, "a used hint keeps the game started");
    assert.equal(fresh.hintsUsed, 0, "the earlier state is not changed");
    game = redo(game);
    assert.equal(game.grid[r][c], hinted.grid[r][c]);
    assert.equal(game.hintsUsed, 1, "redo does not count it twice");
    game = undo(hint(undo(game)));
    assert.equal(game.hintsUsed, 2, "each hint seen counts once");
  });

  it("keeps a hint counted when undo goes back past it", { timeout: 20_000 }, () => {
    let game = createGame("medium", mulberry32(21));
    game = inputDigit(game, 1, true);
    game = hint(game);
    game = undo(undo(game));
    assert.equal(game.history.length, 0);
    assert.ok(gridsEqual(game.grid, game.puzzle), "back to the original puzzle");
    assert.equal(game.hintsUsed, 1);
    assert.equal(game.started, true, "a puzzle with a hint used is not treated as unstarted");
  });

  it("starts the clock when an explanation counts", { timeout: 20_000 }, () => {
    const game = countExplanation(createGame("medium", mulberry32(21)));
    assert.equal(game.started, true);
    assert.equal(game.timerOn, true);
    assert.equal(game.hintsUsed, 1);
  });

  it("fills a cell without counting when the explanation already counted", { timeout: 20_000 }, () => {
    const game = hint(createGame("medium", mulberry32(21)), false);
    assert.equal(game.hintsUsed, 0);
    assert.equal(game.locked[game.selected.r][game.selected.c], true);
  });

  // Puts a wrong digit in the last empty cell and selects a given, so Hint has
  // to choose between that mistake and the empty cells above it.
  function wrongDigitLate(): { game: GameState; wrong: { r: number; c: number } } {
    let game = createGame("medium", mulberry32(21));
    const cells = [...Array(81).keys()].map((i) => ({ r: (i / 9) | 0, c: i % 9 }));
    const wrong = cells.filter(({ r, c }) => game.puzzle[r][c] === 0).at(-1)!;
    const given = cells.find(({ r, c }) => game.puzzle[r][c] !== 0)!;
    const digit = ((game.solution[wrong.r][wrong.c] % 9) + 1) as Digit;
    game = inputDigit({ ...game, selected: wrong }, digit, false);
    assert.equal(game.grid[wrong.r][wrong.c], digit);
    return { game: { ...game, selected: given }, wrong };
  }

  it("hints a wrong digit before an empty cell", { timeout: 20_000 }, () => {
    const { game, wrong } = wrongDigitLate();
    const hinted = hint(game);
    assert.deepEqual(hinted.selected, wrong, "the hint goes to the wrong digit");
    assert.equal(hinted.grid[wrong.r][wrong.c], game.solution[wrong.r][wrong.c]);
    assert.equal(hinted.locked[wrong.r][wrong.c], true);
  });

  it("hints the selected empty cell even when a digit elsewhere is wrong", { timeout: 20_000 }, () => {
    const { game } = wrongDigitLate();
    const fresh = createGame("medium", mulberry32(21));
    const hinted = hint({ ...game, selected: fresh.selected });
    assert.deepEqual(hinted.selected, fresh.selected);
    assert.equal(hinted.grid[fresh.selected.r][fresh.selected.c], fresh.solution[fresh.selected.r][fresh.selected.c]);
  });

  it("hints the first empty cell when nothing is wrong", { timeout: 20_000 }, () => {
    const fresh = createGame("medium", mulberry32(21));
    const { game } = wrongDigitLate();
    const clean = { ...fresh, selected: game.selected };
    assert.deepEqual(hint(clean).selected, fresh.selected, "createGame selects the first empty cell");
  });

  it("hints a cell, then restart clears entries", { timeout: 20_000 }, () => {
    let game = createGame("medium", mulberry32(21));
    const before = game.selected;
    game = hint(game);
    assert.equal(game.hintsUsed, 1);
    assert.equal(game.locked[game.selected.r][game.selected.c], true);
    assert.equal(game.grid[game.selected.r][game.selected.c], game.solution[game.selected.r][game.selected.c]);
    assert.ok(game.selected.r !== before.r || game.selected.c !== before.c || game.puzzle[before.r][before.c] === 0);

    game = inputDigit({ ...toggleNotesMode(game), selected: { r: 0, c: 0 } }, 1);
    game = restart(game);
    assert.equal(game.started, false);
    assert.equal(game.hintsUsed, 0);
    assert.ok(gridsEqual(game.grid, game.puzzle));
    assert.equal(game.history.length, 0);
  });

  it("clears a locked digit from every note and restores them on undo", () => {
    let game = createGame("easy", mulberry32(8));
    const digit = 7 as Digit;
    const empties = game.grid.flatMap((row, r) =>
      row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])),
    );
    const place = empties[0]!;
    const peers = new Set<string>();
    for (let i = 0; i < 9; i++) {
      peers.add(`${place.r}-${i}`);
      peers.add(`${i}-${place.c}`);
    }
    const br = Math.floor(place.r / 3) * 3;
    const bc = Math.floor(place.c / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) peers.add(`${r}-${c}`);
    }
    const marked = empties.find((cell) => !peers.has(`${cell.r}-${cell.c}`));
    assert.ok(marked);
    const markedPeers = new Set<string>();
    for (let i = 0; i < 9; i++) {
      markedPeers.add(`${marked.r}-${i}`);
      markedPeers.add(`${i}-${marked.c}`);
    }
    const mr = Math.floor(marked.r / 3) * 3;
    const mc = Math.floor(marked.c / 3) * 3;
    for (let r = mr; r < mr + 3; r++) {
      for (let c = mc; c < mc + 3; c++) markedPeers.add(`${r}-${c}`);
    }
    game = inputDigit({ ...toggleNotesMode({ ...game, selected: marked }), notesMode: true }, digit);
    game = inputDigit(game, 3);
    assert.equal(game.notes[marked.r][marked.c] & (1 << digit), 1 << digit);
    assert.equal(game.notes[marked.r][marked.c] & (1 << 3), 1 << 3);

    game = toggleNotesMode(game);
    const spots = empties.filter(
      (cell) =>
        (cell.r !== marked.r || cell.c !== marked.c) &&
        (cell.r !== place.r || cell.c !== place.c) &&
        !markedPeers.has(`${cell.r}-${cell.c}`),
    );
    let placed = game.grid.flat().filter((value) => value === digit).length;
    for (const cell of spots) {
      if (placed >= 8) break;
      if (game.grid[cell.r][cell.c] !== 0) continue;
      game = inputDigit({ ...game, selected: cell }, digit);
      if (game.grid[cell.r][cell.c] === digit) placed++;
    }
    assert.equal(placed, 8);
    assert.equal(game.notes[marked.r][marked.c] & (1 << digit), 1 << digit);

    game = inputDigit({ ...game, selected: place }, digit);
    assert.equal(game.grid[place.r][place.c], digit);
    assert.equal(game.grid.flat().filter((value) => value === digit).length, 9);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) assert.equal(game.notes[r][c] & (1 << digit), 0);
    }
    assert.equal(game.notes[marked.r][marked.c] & (1 << 3), 1 << 3);

    game = undo(game);
    assert.equal(game.grid[place.r][place.c], 0);
    assert.equal(game.notes[marked.r][marked.c] & (1 << digit), 1 << digit);
    assert.equal(game.notes[marked.r][marked.c] & (1 << 3), 1 << 3);

    game = redo(game);
    assert.equal(game.notes[marked.r][marked.c] & (1 << digit), 0);
    assert.equal(game.notes[marked.r][marked.c] & (1 << 3), 1 << 3);
  });

  it("marks a cell without leaving notes mode on", () => {
    let game = createGame("easy", mulberry32(8));
    const empty = game.grid.flatMap((row, r) =>
      row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])),
    )[0]!;
    game = inputDigit({ ...game, selected: empty, notesMode: false }, 4, true);
    assert.equal(game.notesMode, false);
    assert.equal(game.notes[empty.r][empty.c] & (1 << 4), 1 << 4);
    game = inputDigit(game, 5, false);
    assert.equal(game.notesMode, false);
    assert.equal(game.grid[empty.r][empty.c], 5);
    assert.equal(game.notes[empty.r][empty.c], 0);
  });

  it("erases an entry and round-trips through storage", { timeout: 20_000 }, () => {
    let game = createGame("easy", mulberry32(2));
    const empty = game.grid.flatMap((row, r) =>
      row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])),
    )[0]!;
    game = inputDigit({ ...game, selected: empty }, 9);
    assert.equal(game.grid[empty.r][empty.c], 9);
    game = erase({ ...game, selected: empty });
    assert.equal(game.grid[empty.r][empty.c], 0);

    const restored = deserializeGame(JSON.parse(JSON.stringify(game)) as unknown);
    assert.ok(restored);
    assert.deepEqual(restored.grid, game.grid);
    assert.equal(restored.difficulty, game.difficulty);
    assert.equal(restored.source, "generated");
    assert.deepEqual(restored.solution, game.solution);

    const remote = createGameFromPuzzle("expert", game.puzzle, game.solution, "mtsudoku");
    const remoteRestored = deserializeGame(JSON.parse(JSON.stringify(remote)) as unknown);
    assert.equal(remoteRestored?.source, "mtsudoku");
  });

  it("keeps the full undo history through a save and load", () => {
    let game = createGame("easy", mulberry32(2));
    const empty = game.grid.flatMap((row, r) =>
      row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])),
    )[0]!;
    game = { ...game, selected: empty };
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) game = inputDigit(game, ((i % 9) + 1) as Digit, true);
    assert.equal(game.history.length, HISTORY_LIMIT);

    const store = new Map<string, string>();
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
    try {
      saveGame(game);
      const restored = loadGame();
      assert.equal(restored?.history.length, HISTORY_LIMIT);
      assert.deepEqual(restored?.history, game.history);
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it("counts each conflicting digit while conflicts are shown", () => {
    const fresh = createGame("easy", mulberry32(8));
    assert.equal(fresh.errors, 0);

    const empty = fresh.grid.flatMap((row, r) =>
      row.flatMap((value, c) => (value === 0 ? [{ r, c }] : [])),
    )[0]!;
    const legal = inputDigit({ ...fresh, selected: empty }, fresh.solution[empty.r][empty.c] as Digit);
    assert.equal(legal.errors, 0);
    assert.equal(legal.grid[empty.r][empty.c], fresh.solution[empty.r][empty.c]);

    const noted = inputDigit({ ...fresh, selected: empty }, 4, true);
    assert.equal(noted.errors, 0);
    assert.equal(noted.grid[empty.r][empty.c], 0);

    const game = placeConflict(fresh);
    const { r, c } = game.selected;
    const digit = game.grid[r][c] as Digit;
    assert.equal(game.errors, 1);
    assert.notEqual(digit, game.solution[r][c]);

    const fixed = inputDigit(game, game.solution[r][c] as Digit);
    assert.equal(fixed.grid[r][c], game.solution[r][c]);
    assert.equal(fixed.errors, 1);

    const cleared = inputDigit(game, digit);
    assert.equal(cleared.grid[r][c], 0);
    assert.equal(cleared.errors, 1);
    assert.equal(erase(game).errors, 1);

    const undone = undo(game);
    assert.equal(undone.grid[r][c], 0);
    assert.equal(undone.errors, 1);
    const redone = redo(undone);
    assert.equal(redone.grid[r][c], digit);
    assert.equal(redone.errors, 1);
    assert.equal(placeConflict(undone).errors, 2);
    assert.equal(restart(game).errors, 0);
    assert.equal(hint(fresh).errors, 0);

    const twice = placeConflict(game);
    assert.equal(twice.errors, 2);

    const hidden = placeConflict({ ...fresh, showMistakes: false });
    assert.equal(hidden.errors, 0);
    assert.notEqual(hidden.grid[hidden.selected.r][hidden.selected.c], 0);

    const restored = deserializeGame(JSON.parse(JSON.stringify(game)) as unknown);
    assert.ok(restored);
    assert.equal(restored.errors, 1);
    assert.equal(undo(restored).errors, 1);

    const legacy = JSON.parse(JSON.stringify(game)) as {
      errors?: number;
      history: { errors?: number }[];
    };
    delete legacy.errors;
    legacy.history[0]!.errors = 4;
    const legacyRestored = deserializeGame(legacy);
    assert.equal(legacyRestored?.errors, 0);
    assert.equal(undo(legacyRestored!).errors, 0);
  });
});

function houseDigits(game: GameState, r: number, c: number): Digit[] {
  const found = new Set<number>();
  const take = (value: number, same: boolean) => {
    if (!same && value !== 0) found.add(value);
  };
  for (let i = 0; i < 9; i++) {
    take(game.grid[r][i], i === c);
    take(game.grid[i][c], i === r);
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) take(game.grid[br + i][bc + j], br + i === r && bc + j === c);
  }
  return [...found] as Digit[];
}

function placeConflict(game: GameState): GameState {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (game.locked[r][c] || game.grid[r][c] !== 0) continue;
      const digit = houseDigits(game, r, c)[0];
      if (!digit) continue;
      return inputDigit({ ...game, selected: { r, c } }, digit);
    }
  }
  throw new Error("no conflicting entry available");
}
