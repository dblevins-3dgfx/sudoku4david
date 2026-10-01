# Sudoku specification

This document describes the game as it is implemented. It is the baseline for later changes. A change to play, generation, or the screen should update this specification in the same branch.

The product is a browser Sudoku. Each puzzle is generated in the browser and has one solution. Progress stays in that browser.

## Board

The grid is 9 by 9, divided into nine 3 by 3 boxes. A cell is empty or holds a digit from 1 to 9.

A completed grid places each digit once in every row, every column, and every box. The puzzle is solved only when the player's grid matches the generated solution. A full grid with no repeated digits that is not that solution is not a win.

Given digits are printed with the puzzle. They are locked. The player cannot change or erase a locked cell. A hint also locks the cell it fills.

## Generating a puzzle

A puzzle is a completed grid with some digits removed. Removal keeps exactly one solution. If a removal would leave zero solutions or more than one, that removal is undone.

Clue counts, inclusive:

| Difficulty | Clues left |
| --- | --- |
| Easy | 40–46 |
| Medium | 32–36 |
| Hard | 26–30 |

The target count inside that range is chosen at random. Generation tries up to four times to land inside the range. If every try misses the range but still produces a unique puzzle, that last puzzle is used. If none can be composed, the player sees “Couldn't compose a puzzle. Try once more.”

The first visit, with nothing saved, deals a medium puzzle. The selected cell starts on the first empty cell in reading order.

Choosing Easy, Medium, or Hard does not replace the current grid. It only chooses the difficulty of the next deal. The button reads “New puzzle” when that matches the grid in play, and “New easy”, “New medium”, or “New hard” when it does not.

## Entering digits

The player selects a cell by tapping or clicking it. Arrow keys move the selection and wrap around the board.

On an unlocked cell, a digit does one of two things:

- Notes off. The digit is written in the cell. Pressing the digit that is already there clears the cell. Writing a digit removes that cell's notes, and removes that digit from the notes in the same row, column, and box.
- Notes on. The digit is toggled as a pencil mark in an empty cell. Marks on a filled cell are ignored. Marks do not have to be legal.

Erase clears the selected cell's digit and its notes. It does nothing on a locked cell, or on a cell that is already empty and unmarked.

The digit keypad shows how many of that digit are still missing from a full nine. A count above nine is shown as an error, which happens when the player has repeated a digit.

## Conflicts

A conflict is a filled cell whose digit also appears in the same row, column, or box. Empty cells are not conflicts.

Conflicts are shown by default. The player can hide them. While they are shown, conflicting cells are marked on the board, and the status line reports “1 conflict” or “N conflicts”.

Check reports:

- Already solved: “This grid is already solved.”
- Repeats, and conflicts were hidden: conflicts are turned on, then the same conflict count as the status line.
- No repeats, grid full, but not the solution: “The grid is full, but it isn't the solution.”
- No repeats, cells still open: “No repeats yet.” plus how many cells remain.

## Hints

Hint fills one unlocked cell that is empty or wrong.

It uses the selected cell when that cell qualifies. Otherwise it uses the first qualifying cell in reading order. The filled digit is the solution digit. The cell becomes locked, its notes are cleared, and that digit is cleared from notes in the same row, column, and box. The hint counts toward the hint total, and the selection moves to that cell.

Hint does nothing when the puzzle is already solved, while the grid is paused, or when every unlocked cell already matches the solution.

## Undo, redo, and clearing

Digit entry, notes, erase, and hint each record a step. Up to 100 steps are kept. A new step drops the redo stack.

Undo and redo move one step. They are unavailable while the grid is paused, and when there is no step in that direction. Returning to the original puzzle, with no notes and no hints, is treated as not started: the timer reads 0:00 and does not run.

Clear entries restores the original givens, clears notes, hints, the timer, and the history. Given digits stay.

- If the player has not started, Clear entries does nothing.
- If the puzzle is solved, it clears immediately.
- Otherwise it asks “Clear every number you wrote? The given digits stay.” The player confirms with “Clear entries” or dismisses with “Keep playing”.

## A new puzzle

New puzzle deals a grid at the chosen difficulty.

- If the player has not started, or the puzzle is already solved, it deals immediately.
- Otherwise it asks “Deal a new {difficulty} puzzle? This grid will be replaced.” The player confirms with “Deal” or dismisses with “Keep playing”.

The question is a dialog in the center of the screen, including on a phone, where the controls sit in a short scrolling panel. Escape dismisses it.

## Timer and pause

The clock starts on the first digit, note, erase, or hint. It shows minutes and seconds, and adds hours after 59:59. It stops on a win. Undo back to an unstarted grid resets it to 0:00.

Pause covers the grid and stops the clock. Resume uncovers the grid and continues the clock only if play had started. Pause is unavailable after a win. The pause control, the P key, and Escape (when no dialog is open) toggle it.

## Winning

When the grid matches the solution, the clock stops and a solved panel covers the board. It shows the elapsed time, the difficulty, and the hint count (“no hints”, “1 hint”, or “N hints”). From there the player can replay the same givens or deal another puzzle at the chosen difficulty.

## What is remembered

The game is stored in the browser under `sudoku.desk.v1`. A saved game is restored on the next visit. A saved record that is not a valid puzzle is ignored, and a new medium puzzle is dealt.

The record must have a completed, conflict-free solution. Every given must match the solution and be locked. Every locked cell in the working grid must match the solution. History and redo kept in storage are capped at 30 steps each.

The clock is written about every five seconds while it is running, and again when the page is hidden or closed. Other moves are written as they happen.

Light and dark appearance is stored separately under `sudoku.theme`. With nothing stored, the page follows the device setting.

## Screen

The page fills the browser window. From a window width of 720 pixels, the board is the largest square that fits beside the controls, which are a fixed column on the right.

Below that, the board is as wide as the screen, snapped down to a multiple of nine pixels so the cells stay even. The keypad is a square at the left of the control panel. Notes, erase, undo, redo, hint, check, and the conflict toggle fill the space to its right. From 720 pixels wide, the keypad is the largest square that fits in the control column, with those same tools underneath it. If the controls still do not fit, they scroll in the lower panel.

Pencil marks are the largest size that still places all nine digits inside a cell.

Box borders are heavier than the lines between cells inside a box. Both stay visible as the board gets smaller. The selected cell is highlighted, peers in its row, column, and box are tinted, and other cells holding the same digit are tinted more strongly. Conflicts, when shown, use their own tint and take precedence over those three.

When the selected cell holds a digit, every pencil mark of that same digit is highlighted inside its cell. That mark is added on top of the cell tint. Selecting an empty cell does not highlight notes.

The status line reports the phase and the open-cell or conflict count, with a progress reading of filled cells out of 81.

## Keyboard

These keys apply when a puzzle is on screen and a new grid is not being dealt. Command and Ctrl, other than the undo chord, are ignored.

| Key | Action |
| --- | --- |
| Arrows | Move the selection, wrapping around |
| 1–9 | Enter that digit, or toggle it as a note |
| 0, Backspace, Delete | Erase the selected cell |
| N | Toggle notes |
| P | Pause or resume |
| H | Hint |
| U, or Command/Ctrl+Z | Undo |
| Y, or Command/Ctrl+Shift+Z | Redo |
| Escape | Dismiss the confirm dialog, or resume when paused |

After a win, only P is handled among the single-key shortcuts. While paused, only P, Escape, and the undo chord are handled.

## What this version does not do

There is no account, no shared puzzle, no scoreboard, and no printed copy. Difficulty is the clue count above, not a separate rating of technique. Pencil marks are not checked for correctness on their own.
