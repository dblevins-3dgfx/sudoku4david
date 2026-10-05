# Sudoku specification

This document describes the game as it is implemented. It is the baseline for later changes. A change to play, generation, or the screen should update this specification in the same branch.

The product is a browser Sudoku. A new puzzle comes from Mt. Sudoku at the difficulty the player chooses. Each puzzle has one solution. Progress stays in that browser.

## Board

The grid is 9 by 9, divided into nine 3 by 3 boxes. A cell is empty or holds a digit from 1 to 9.

A completed grid places each digit once in every row, every column, and every box. The puzzle is solved only when the player's grid matches the generated solution. A full grid with no repeated digits that is not that solution is not a win.

Given digits are printed with the puzzle. They are locked. The player cannot change or erase a locked cell. A hint also locks the cell it fills.

## Generating a puzzle

A new puzzle is requested from Mt. Sudoku at the chosen difficulty:

`https://api.mtsudoku.com/v1/generate?mode=classic&difficulty=easy`

`difficulty` is `easy`, `medium`, `hard`, `expert`, `master`, or `extreme`. The response is an 81-character puzzle and an 81-character solution. Empty cells are `0`.

The board is played when the returned difficulty matches the request, the solution is complete and legal, every given matches that solution, and the givens have exactly one solution. Anything else is treated as Mt. Sudoku not answering.

If Mt. Sudoku does not answer, the built-in generator deals a puzzle at the same difficulty, and the player sees “Mt. Sudoku didn't answer, so this puzzle was dealt here.” The built-in generator builds a completed grid and removes digits while keeping exactly one solution. If a removal would leave zero solutions or more than one, that removal is undone.

Clue counts for the built-in generator, inclusive:

| Difficulty | Clues left |
| --- | --- |
| Easy | 40–46 |
| Medium | 32–36 |
| Hard | 26–30 |
| Expert | 23–25 |
| Master | 22–25 |
| Extreme | 22–26 |

The target count inside that range is chosen at random. Generation tries up to four times to land inside the range. If every try misses the range but still produces a unique puzzle, that last puzzle is used. Expert, Master, and Extreme sit close together: removal stops when another clue would leave a second solution. If the built-in generator also fails, the player sees “Couldn't compose a puzzle. Try once more.”

The first visit, with nothing saved, asks Mt. Sudoku for a medium puzzle. The selected cell starts on the first empty cell in reading order.

The six difficulties are not on the board while a puzzle is in play. New puzzle opens them. The choice deals from Mt. Sudoku, or from the built-in generator if Mt. Sudoku does not answer.

## Entering digits

The player selects a cell by tapping or clicking it. Arrow keys move the selection and wrap around the board.

Preferences choose how a digit is entered. The default is the notes button.

- Notes button. The pencil switches the keypad between marks and numbers. With notes off, the digit is written in the cell. Pressing the digit that is already there clears the cell, unless nine of that digit are already on the board. With notes on, the digit is toggled as a pencil mark in an empty cell. Marks on a filled cell are ignored.
- One tap, two taps. The pencil is hidden. The first tap or keypress of a digit marks an empty cell. A second tap or keypress of that same digit on the same cell, within a short moment, writes the digit. On a filled cell the first press does nothing, and the second writes the digit, or clears the cell when it already holds that digit and fewer than nine copies are on the board. Each of those presses is its own undo step, so one undo after a fill returns the mark.

Writing a digit removes that cell's notes, and removes that digit from the notes in the same row, column, and box. When that placement leaves nine of the digit on the board, the digit is removed from every pencil mark. Undo puts those marks back. Marks do not have to be legal. A digit that already has nine copies on the board is ignored, so it cannot be added to a mark.

Erase clears the selected cell's digit and its notes. It does nothing on a locked cell, or on a cell that is already empty and unmarked.

The digit keypad shows how many of that digit are still missing from a full nine. The badge stops at 0. If more than nine copies are on the board, that 0 is shown as an error. When none are missing, the key is gray. The keypad and the number keys both ignore that digit, including in notes mode, until the count drops. Erase still clears the selected cell.

## Conflicts

A conflict is a filled cell whose digit also appears in the same row, column, or box. Empty cells are not conflicts.

Conflicts are shown by default. Preferences can hide them. While they are shown, conflicting cells are marked on the board, and the status line reports “1 conflict” or “N conflicts”.

While conflicts are shown, the game keeps an error count and shows it on the phase line as “0 errors”, “1 error”, or “N errors”. The count starts at 0. It increases by one when a digit is entered and that cell then conflicts. A digit that does not conflict leaves the count unchanged. Notes, erase, hint, and a press that clears the cell do not increase it. Replacing a conflicting digit with one that does not conflict does not lower it. Undo and redo leave the count unchanged, including when undo returns the grid to the original puzzle. While conflicts are hidden, the count is not shown and does not increase. Showing them again shows the count already kept. Check turns conflicts on and does not add existing repeats to the count. Clear entries sets the count to 0. A new puzzle starts at 0.

Check reports:

- Already solved: “This grid is already solved.”
- Repeats: “One digit is repeated.” or “N cells repeat a digit.” Check says this whether conflicts were already shown or hidden. If they were hidden, Check turns them on and stores that choice. The status line then reports “1 conflict” or “N conflicts” for those same cells.
- No repeats, grid full, but not the solution: “The grid is full, but it isn't the solution.”
- No repeats, cells still open: “No repeats yet. One cell is still open.” or “No repeats yet. N cells are still open.”

## Hints

Hint fills one unlocked cell that is empty or wrong.

It uses the selected cell when that cell qualifies. Otherwise it uses the first qualifying cell in reading order. The filled digit is the solution digit. The cell becomes locked, its notes are cleared, and that digit is cleared from notes in the same row, column, and box. If the hint leaves nine of that digit on the board, the digit is removed from every pencil mark. Undo puts those marks back. The hint counts toward the hint total, and the selection moves to that cell.

Hint does nothing when the puzzle is already solved, while the grid is paused, or when every unlocked cell already matches the solution.

## Undo, redo, and clearing

Digit entry, notes, erase, and hint each record a step. Up to 100 steps are kept. A new step drops the redo stack.

Undo and redo move one step and leave the error count unchanged. They are unavailable while the grid is paused, and when there is no step in that direction. Returning to the original puzzle, with no notes and no hints, is treated as not started: the timer reads 0:00 and does not run.

Clear entries restores the original givens, clears notes, hints, the error count, the timer, and the history. Given digits stay.

- If the player has not started, Clear entries does nothing.
- If the puzzle is solved, it clears immediately.
- Otherwise it asks “Clear every number you wrote? The given digits stay.” The player confirms with “Clear entries” or dismisses with “Keep playing”.

## A new puzzle

New puzzle opens a dialog in the center of the screen, including on a phone. The dialog offers Easy, Medium, Hard, Expert, Master, and Extreme. Choosing one deals that difficulty. The current puzzle’s difficulty is shown pressed.

If play has started and the puzzle is not solved, the dialog says “Deal a new puzzle? This grid will be replaced.” Otherwise it says “Choose a difficulty.” “Keep playing” dismisses it, and so does Escape.

## Timer and pause

The clock starts on the first digit, note, erase, or hint. It shows minutes and seconds, and adds hours after 59:59. It stops on a win. Undo back to an unstarted grid resets it to 0:00.

Pause covers the grid and stops the clock. Resume uncovers the grid and continues the clock only if play had started. Pause is unavailable after a win. The pause control, the P key, and Escape (when no dialog is open) toggle it.

## Winning

When the grid matches the solution, the clock stops and a solved panel covers the board. It shows the elapsed time, the difficulty, and the hint count (“no hints”, “1 hint”, or “N hints”). From there the player can replay the same givens or open the new-puzzle dialog and choose a difficulty.

## What is remembered

The game is stored in the browser under `sudoku.desk.v1`. A saved game is restored on the next visit, including whether it came from Mt. Sudoku or was generated here. A saved record with no source is treated as generated. A saved record that is not a valid puzzle is ignored, and the next visit asks Mt. Sudoku for a medium puzzle.

The record must have a completed, conflict-free solution. Every given must match the solution and be locked. Every locked cell in the working grid must match the solution. The error count is part of the saved game. A saved game with no error count is treated as 0. History and redo kept in storage are capped at 30 steps each. An error count stored on an older history step is ignored.

The clock is written about every five seconds while it is running, and again when the page is hidden or closed. Other moves are written as they happen.

Light and dark appearance is stored separately under `sudoku.theme`. With nothing stored, the page follows the device setting.

How digits are entered, and whether conflicts are shown, are stored under `sudoku.prefs.v1`. The default entry method is the notes button, and conflicts are shown. On a first visit that has a saved game and no preferences yet, the saved game’s conflict setting is kept. Changing either preference applies immediately and does not reset the puzzle. Hiding or showing conflicts is not an undo step.

## Screen

The page fills the browser window. From a window width of 720 pixels, the board is the largest square that fits beside the controls, which are a fixed column on the right.

The clock, pause, the color theme, preferences, and new puzzle sit in the header. Preferences and new puzzle are icons. Preferences opens a dialog for the entry method and for showing or hiding conflicts. New puzzle opens the difficulty dialog. Escape closes either dialog.

Below a window width of 720 pixels, the board is as wide as the screen, snapped down to a multiple of nine pixels so the cells stay even. The keypad is a square at the left of the control panel. With the notes button selected, notes, erase, undo, redo, hint, check, and clear entries are icons filling the space to its right. With one tap, two taps selected, the notes icon is hidden and the other six remain. From 720 pixels wide, the keypad is a square the width of the control column, and those same icons sit in one row under it. The keypad keeps that size when the window gets shorter. A second tap on a digit writes it without the pad waiting on a zoom gesture. Difficulty and conflicts are chosen in dialogs, not in this column.

Pencil marks are the largest size that still places all nine digits inside a cell. They are set in a handwritten face so they stay distinct from the printed digits.

Box borders are heavier than the lines between cells inside a box. Both stay visible as the board gets smaller. The selected cell is highlighted, peers in its row, column, and box are tinted, and other cells holding the same digit are tinted more strongly. Conflicts, when shown, use their own tint and take precedence over those three.

When the selected cell holds a digit, every pencil mark of that same digit is highlighted inside its cell. That mark is added on top of the cell tint. Selecting an empty cell does not highlight notes.

The status line reports the phase and the open-cell or conflict count, with a progress reading of filled cells out of 81. Under that, the phase line names the phase, the difficulty, and the source: “Mt. Sudoku” or “Generated”. When conflicts are shown, that line also names the error count.

## Keyboard

These keys apply when a puzzle is on screen and a new grid is not being dealt. Command and Ctrl, other than the undo chord, are ignored. While a dialog is open, only Escape and the undo chord apply. Escape dismisses the dialog. The undo chord still changes the board behind it.

| Key | Action |
| --- | --- |
| Arrows | Move the selection, wrapping around |
| 1–9 | With the notes button, enter that digit or toggle it as a note. With one tap, two taps, the first press marks the cell and a second press of the same digit on the same cell writes it. A digit with nine copies already on the board is ignored |
| 0, Backspace, Delete | Erase the selected cell |
| N | Toggle notes when the notes button is selected. Does nothing in one tap, two taps |
| P | Pause or resume |
| H | Hint |
| U, or Command/Ctrl+Z | Undo |
| Y, or Command/Ctrl+Shift+Z | Redo |
| Escape | Dismiss the open dialog, or resume when paused |

After a win, only P is handled among the single-key shortcuts. P does not pause a solved grid. The undo chord still undoes. While paused, only P, Escape, and the undo chord are recognized. The undo chord does not change the board until the grid is resumed.

## What this version does not do

There is no account, no shared puzzle, no scoreboard, and no printed copy. Mt. Sudoku deals the difficulty the player chose. The built-in generator’s difficulty is the clue count above. Pencil marks are not checked for correctness on their own.
