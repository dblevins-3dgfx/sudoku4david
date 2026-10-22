// Checkpoints for guessing (bifurcation): the player saves the board before
// trying a guess and restores it if the guess leads nowhere. They form a
// stack, so a guess inside a guess can be backed out one level at a time.
// The stack is kept apart from the undo history, so trimming that history to
// its 100 steps never loses a checkpoint. The moves that use it, saveCheckpoint
// and restoreCheckpoint, live in game.ts beside undo and redo.

import { cloneNotes, notesEqual, type Notes } from "./notes";
import { cloneGrid, gridsEqual, type Grid } from "./sudoku";

/** A saved board: digits, pencil marks, and which cells are locked. */
export type Checkpoint = {
  grid: Grid;
  notes: Notes;
  locked: boolean[][];
};

/** The most checkpoints kept at once; Save does nothing beyond it. */
export const CHECKPOINT_LIMIT = 20;

export function copyCheckpoint(cp: Checkpoint): Checkpoint {
  return { grid: cloneGrid(cp.grid), notes: cloneNotes(cp.notes), locked: cp.locked.map((row) => row.slice()) };
}

export function checkpointsEqual(a: Checkpoint, b: Checkpoint): boolean {
  if (!gridsEqual(a.grid, b.grid) || !notesEqual(a.notes, b.notes)) return false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) if (a.locked[r][c] !== b.locked[r][c]) return false;
  }
  return true;
}

/**
 * The stack without its topmost checkpoint equal to `cp`; the same array when
 * there is none. Redo uses it to take back off the checkpoint that undo put
 * back on, even if a newer one was saved on top in between.
 */
export function withoutLast(stack: readonly Checkpoint[], cp: Checkpoint): Checkpoint[] {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (checkpointsEqual(stack[i], cp)) return [...stack.slice(0, i), ...stack.slice(i + 1)];
  }
  return stack as Checkpoint[];
}
