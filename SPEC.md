# Sudoku specification

This document describes the game as it is implemented. It is the baseline for later changes. Any change the player can see or that changes what is stored (play, generation, the screen, high scores, backup, or sync) must update this specification in the same pull request.

The product is a browser Sudoku. A new puzzle comes from Mt. Sudoku at the difficulty the player chooses. Each puzzle has one solution. Progress is kept in that browser. A player who signs in can keep the current game and high scores the same on all their devices.

## Board

The grid is 9 by 9, divided into nine 3 by 3 boxes. A cell is empty or holds a digit from 1 to 9.

A completed grid places each digit once in every row, every column, and every box. The puzzle is solved only when the player's grid matches the generated solution. A full grid with no repeated digits that is not that solution is not a win.

Given digits are printed with the puzzle. They are locked. The player cannot change or erase a locked cell. A hint also locks the cell it fills.

## Generating a puzzle

A new puzzle is requested from Mt. Sudoku at the chosen difficulty:

`https://api.mtsudoku.com/v1/generate?mode=classic&difficulty=easy`

`difficulty` is `easy`, `medium`, `hard`, `expert`, `master`, or `extreme`. The response is an 81-character puzzle and an 81-character solution. Empty cells are `0` (a `.` is also accepted).

The board is played when the returned difficulty matches the request, the solution is complete and legal, every given matches that solution, and the givens have exactly one solution. Anything else is treated as Mt. Sudoku not answering, and so is no answer within 8 seconds.

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

Conflicts are shown by default. Preferences can hide them. While they are shown, conflicting cells are marked on the board, and the status line reports “N conflicting cells”. A repeat always involves at least two cells, so there is no singular form.

While conflicts are shown, the game keeps an error count and shows it on the phase line as “0 errors”, “1 error”, or “N errors”. The count starts at 0. It increases by one when a digit is entered and that cell then conflicts. A digit that does not conflict leaves the count unchanged. Notes, erase, hint, and a press that clears the cell do not increase it. Replacing a conflicting digit with one that does not conflict does not lower it. Undo and redo leave the count unchanged, including when undo returns the grid to the original puzzle. While conflicts are hidden, the count is not shown and does not increase. Showing them again shows the count already kept. Check turns conflicts on and does not add existing repeats to the count. Clear entries sets the count to 0. A new puzzle starts at 0.

Check reports:

- Already solved: “This grid is already solved.”
- Repeats: “N cells repeat a digit.” Check says this whether conflicts were already shown or hidden. If they were hidden, Check turns them on and stores that choice. The status line then reports “N conflicting cells” for those same cells.
- No repeats, grid full, but not the solution: “The grid is full, but it isn't the solution.”
- No repeats, cells still open: “No repeats yet. One cell is still open.” or “No repeats yet. N cells are still open.”

## Hints

Hint fills one unlocked cell that is empty or wrong.

It uses the selected cell when that cell qualifies. Otherwise it fixes the first wrong digit in reading order, and only when no digit is wrong does it fill the first empty cell in reading order. The filled digit is the solution digit. The cell becomes locked, its notes are cleared, and that digit is cleared from notes in the same row, column, and box. If the hint leaves nine of that digit on the board, the digit is removed from every pencil mark. Undo puts those marks back. The hint counts toward the hint total, and the selection moves to that cell. Undo takes back the digit a hint filled, but not the hint: the hint total stays the same.

Hint does nothing when the puzzle is already solved, while the grid is paused, or when every unlocked cell already matches the solution.

After Hint fills a cell, the status line says which: “Hint: 7 in row 3, column 5.”, or “Hint: fixed row 6, column 2 from 4 to 9.” when it replaced a wrong digit. Screen readers announce it. It stays until the next key, tap, or selection on the board. The filled cell also pulses twice, unless the device asks for reduced motion. Fill it in, from an explanation, shows neither, because the player already chose that cell.

## Explaining the next step

Explain works out the next logical step from the digits on the board and says why in plain words. It ignores pencil marks, which may be incomplete. It does not change the board. An explanation counts as a hint and starts the clock, unless Explain finds nothing it can explain. Asking again about the same board does not count again, and undo does not take the hint back.

If an unlocked digit on the board is wrong, Explain names that cell first and offers to select it. Otherwise it looks for a hidden single, then a naked single. When neither is visible, it takes candidates out with pointing, claiming, naked and hidden pairs, naked and hidden triples, then X-Wing, Swordfish, and XY-Wing, and looks again. An X-Wing is a digit that, in two rows, fits only in the same two columns (or in two columns, only in the same two rows), so no other cell in those columns can hold it. A Swordfish is the same with three rows and three columns. An XY-Wing is a cell that can only be x or y, seeing one cell that can only be x or z and another that can only be y or z, so no cell that sees both of those can be z. The explanation lists only the steps the placement depends on, in order, with Back and Next between them, and ends with the digit to place. Fill it in places that digit the same way Hint does, without counting a second hint. If none of these techniques finds a placement, Explain says so.

While an explanation is shown, it replaces the status card and the board tints only the cells it talks about: the cell to fill, the cells that make the pattern, the cells losing a candidate (outlined), and the rest of the row, column, or box. X-Wing, Swordfish, and XY-Wing span several rows and columns, so they tint only their own cells and the cells losing a candidate. Any change to the board, pausing, or a win closes it. Pressing Explain again also closes it.

## Undo, redo, and clearing

Digit entry, notes, erase, and hint each record a step. Up to 100 steps are kept. A new step drops the redo stack.

Undo and redo move one step and leave the error count and the hint total unchanged. They are unavailable while the grid is paused, and when there is no step in that direction. Returning to the original puzzle, with no notes and no hints, is treated as not started: the timer reads 0:00 and does not run.

Clear entries restores the original givens, clears notes, hints, the error count, the timer, and the history. Given digits stay.

- If the player has not started, Clear entries does nothing.
- If the puzzle is solved, it clears immediately.
- Otherwise it asks “Clear every number you wrote? The given digits stay.” The player confirms with “Clear entries” or dismisses with “Keep playing”.

## A new puzzle

New puzzle opens a dialog in the center of the screen, including on a phone. The dialog offers Easy, Medium, Hard, Expert, Master, and Extreme. Choosing one deals that difficulty. The current puzzle’s difficulty is shown pressed.

If play has started and the puzzle is not solved, the dialog says “Deal a new puzzle? This grid will be replaced.” Otherwise it says “Choose a difficulty.” “Keep playing” dismisses it, and so does Escape.

## Timer and pause

The clock starts on the first digit, note, erase, or hint. It shows minutes and seconds, and adds hours after 59:59. It stops on a win. Undo back to an unstarted grid resets it to 0:00.

Pause covers the grid and stops the clock. Resume uncovers the grid and continues the clock only if play had started. Pause is unavailable after a win. The pause control and the P key toggle it. Escape, when no dialog is open, resumes a paused grid; it does not pause.

## Winning

When the grid matches the solution, the clock stops and a solved panel covers the board. It shows the elapsed time, the difficulty, and the hint count (“no hints”, “1 hint”, or “N hints”). Under that, a line says where the game placed in the high scores (see High scores), or “Replayed puzzle, so it doesn't count toward records.” That line shows only for the win just played, not after a reload. From the panel the player can open High scores, replay the same givens (“Same puzzle”), or open the new-puzzle dialog and choose a difficulty.

## What is remembered

The game is stored in the browser under `sudoku.desk.v1`. A saved game is restored on the next visit, including whether it came from Mt. Sudoku or was generated here. A saved record with no source is treated as generated. A saved record that is not a valid puzzle is ignored, and the next visit asks Mt. Sudoku for a medium puzzle.

The record must have a completed, conflict-free solution. Every given must match the solution and be locked. Every locked cell in the working grid must match the solution. The error count is part of the saved game. A saved game with no error count is treated as 0. History and redo kept in storage are capped at 100 steps each, the same as in play, so undo works the same after a refresh. An error count stored on an older history step is ignored.

The clock is written about every five seconds while it is running, and again when the page is hidden or closed. Other moves are written as they happen.

Each saved game carries `savedAt`, the time the player last changed it. Writes that change only the clock keep the old time, so a game left open does not become “newer”. A game a browser deals for itself on a first visit is saved with `savedAt` 0. Sync uses this time to choose between copies.

High scores are stored under `sudoku.scores.v1`, and a random id for this browser under `sudoku.device`. While a sign-in email is waiting, its address is kept for an hour under `sudoku.signin-pending`.

The color theme is stored separately under `sudoku.theme`, as the theme's id. With nothing stored, the page uses Paper or Lamplight to follow the device's light or dark setting. The older values `light` and `dark` map to those two.

How digits are entered, and whether conflicts are shown, are stored under `sudoku.prefs.v1`. The default entry method is the notes button, and conflicts are shown. On a first visit that has a saved game and no preferences yet, the saved game’s conflict setting is kept. Changing either preference applies immediately and does not reset the puzzle. Hiding or showing conflicts is not an undo step.

## Screen

The page fills the browser window. From a window width of 720 pixels, the board is the largest square that fits beside the controls, which are a fixed column on the right.

The clock, pause, preferences, high scores, and new puzzle sit in the header, in that order. Preferences, high scores, and new puzzle are icons. Preferences opens a dialog for the entry method, for showing or hiding conflicts, for the color theme, for resetting high scores, for backup files, and for sync. Each theme is one file in `src/themes`, listed in `src/themes/index.ts`. High scores opens the high-score tables. New puzzle opens the difficulty dialog. Escape closes any of these dialogs.

Below a window width of 720 pixels, the board is as wide as the screen, snapped down to a multiple of nine pixels so the cells stay even. The keypad is a square at the left of the control panel. With the notes button selected, notes, erase, undo, redo, hint, explain, check, and clear entries are icons filling the space to its right. With one tap, two taps selected, the notes icon is hidden and the other seven remain. From 720 pixels wide, the keypad is a square the width of the control column, and those same icons sit in one row under it. The keypad keeps that size when the window gets shorter. A second tap on a digit writes it without the pad waiting on a zoom gesture. Difficulty and conflicts are chosen in dialogs, not in this column. From 720 pixels wide, a line under the board lists the main keys for the chosen entry method.

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

## High scores

Each solved puzzle is recorded once, the first time it is solved. A record keeps the puzzle's givens, when it was finished, the difficulty, the elapsed time, the hint count, the source, and the browser it was solved in. Replaying the same givens, or reloading a game that is already solved, does not add a record. Records are never edited after they are written.

The High scores dialog shows the ten fastest records for one difficulty, with Weekly, Monthly, and All time tabs. It opens on the current puzzle's difficulty. Weeks start on Monday, and weeks and months follow the device's local time. Games solved with hints are ranked with the rest, marked with a lightbulb and their hint count. Each row shows the rank, the time, and the finish date, with the year on the All time tab. The game just won is highlighted.

After a win, the solved panel names the best placing it earned. A first place names the longest period it leads: “Your first record on easy” (the only record at that difficulty), “New all-time best on hard”, “New monthly best on hard”, or “New weekly best on hard”. Otherwise it names the longest period in which the game made the top ten, such as “#3 all time on hard”, “#3 this month on hard”, or “#3 this week on hard”, and failing that “Outside this week's top 10 on hard”.

Reset records in Preferences asks “Clear every high score? This can't be undone.” The player confirms with “Reset records” or keeps them with “Keep them”. A reset drops every record finished before that moment, on every device that syncs.

## Backup files

Preferences can download a backup file, `sudoku-backup-YYYY-MM-DD.json`, holding the current game and every high-score record. Loading one asks “Replace the current game with the one in the backup? High scores are combined, not replaced.” On “Load backup”, the backup's game, if it has one, replaces the current game and counts as changed just now, and its records are merged with the ones already here. A file that is not a valid backup changes nothing and reports “That file isn't a Sudoku backup.” A damaged game inside a backup is skipped, and damaged records are skipped one by one.

## Sync

A player can sign in with an email address to keep the current game and high scores the same on every device. Sync is offered only when a server is configured; otherwise the Sync row is hidden and nothing changes.

Signing in sends an email. Tapping its link in the same browser signs in. Because a home-screen app on a phone keeps its own storage, the player can instead paste the link, or type the code, from the email into the Sync row. A link or code works once and expires. Signed in, the row shows the address, the sync status (“Syncing…”, “Synced at …”, “Can't reach the server. It will try again.”, or “Waiting to sync.”), and Sign out.

Each sync compares this browser's copy with the server's:

- Current game: the copy with the later `savedAt` wins and replaces the other. A brand-new browser's first deal never replaces a game from another device. A game that arrives already solved does not add a high score here.
- High scores: the two lists are merged. Nothing is lost, only the first finish of each puzzle is kept, and the later reset wins.

Sync runs on sign-in, when the page is shown or hidden, when the network comes back, every 30 seconds while the page is visible, and after a win, a records reset, or loading a backup. Play never waits on it. When the server can't be reached, the game carries on from this browser and the next sync catches up.

## What this version does not do

There is no shared puzzle, no public scoreboard, and no printed copy. High scores are the player's own, and sign-in exists only for sync. Mt. Sudoku deals the difficulty the player chose. The built-in generator’s difficulty is the clue count above. Pencil marks are not checked for correctness on their own.
