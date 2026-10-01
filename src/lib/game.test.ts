import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGame,
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
    assert.deepEqual(restored.solution, game.solution);
  });
});
