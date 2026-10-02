import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGame,
  createGameFromPuzzle,
  erase,
  hint,
  inputDigit,
  redo,
  restart,
  toggleNotesMode,
  undo,
  type GameState,
} from "./game";
import { deserializeGame } from "./storage";
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
});
