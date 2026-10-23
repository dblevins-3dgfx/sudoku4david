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

Writing a digit removes that cell's notes. With Note helpers on (see Available helpers), it also removes that digit from the notes in the same row, column, and box, and when that placement leaves nine of the digit on the board, the digit is removed from every pencil mark. Undo puts those marks back. With Note helpers off, other cells' notes are left as they are. Marks do not have to be legal. A digit that already has nine copies on the board is ignored, so it cannot be added to a mark.

Erase clears the selected cell's digit and its notes. It does nothing on a locked cell, or on a cell that is already empty and unmarked.

Fill all notes replaces the marks in every empty cell with that cell's candidates: each digit not already in its row, column, or box. It works from the digits on the board alone and never looks at the solution, so a wrong digit on the board makes the filled marks wrong too. A digit with nine copies on the board is left out of every mark. Filled cells keep no marks. The whole fill is one undo step, so one undo puts back the marks the player had. It starts the clock, counts as no hint, and does not change the error count. It adds one second of penalty time (see Timer and pause) for each mark it adds or removes in an empty cell; a mark the player already had that is one of the cell's candidates costs nothing. The status line then says “Fill all notes: +N s.” until the next key, tap, or selection on the board. Undo, redo, and Restore checkpoint do not give the time back. It does nothing while paused, after a win, or when every mark already matches. It is offered while Note helpers is on.

The Fill style preference, inside Note helpers, chooses how Fill all notes fills. Plain, the default, fills as described above. With pointing trusts the player's marks and then works as the player would by hand:

1. Each empty cell starts from its candidates, as Plain gives them.
2. The player's marks are read one box and one digit at a time. If the player has marked a digit anywhere in a box, that digit stays only in the cells of the box where it is marked. A box with no mark of a digit is left alone. A single cell's marks are never read as its full list, so a cell marked only 3 still gets its other candidates. A mark where the digit can't go (it is already in the cell's row, column, or box) is dropped, so a box's claim can be left with no cells, and the digit then has no place in that box. The marks are trusted as they are and never checked against the solution, so a wrong mark carries into the fill.
3. Pointing and claiming then repeat until neither removes anything. Pointing: when a box's places for a digit all lie in one row or column, that digit leaves the rest of that row or column. Claiming: when a row's or column's places for a digit all lie in one box, that digit leaves the rest of that box.

With pointing charges the same second per mark added or removed, plus one second for each candidate that pointing or claiming removed in step 3. What the player's own marks rule out in step 2 costs nothing extra. The notice gives the total only. Everything else is as for Plain.

With Board highlighting on, the digit keypad shows how many of that digit are still missing from a full nine. The badge stops at 0. If more than nine copies are on the board, that 0 is shown as an error. With Board highlighting off, there are no counts. Either way, when none are missing, the key is gray. The keypad and the number keys both ignore that digit, including in notes mode, until the count drops. Erase still clears the selected cell.

## Conflicts

A conflict is a filled cell whose digit also appears in the same row, column, or box. Empty cells are not conflicts.

Conflicts are shown by default. They belong to Error checking (see Available helpers), and switching that off hides them. While they are shown, conflicting cells are marked on the board, and the status line reports “N conflicting cells”. A repeat always involves at least two cells, so there is no singular form.

While conflicts are shown, the game keeps an error count and shows it on the phase line as “0 errors”, “1 error”, or “N errors”. The count starts at 0. It increases by one when a digit is entered and that cell then conflicts. A digit that does not conflict leaves the count unchanged. Notes, erase, hint, and a press that clears the cell do not increase it. Replacing a conflicting digit with one that does not conflict does not lower it. Undo and redo leave the count unchanged, including when undo returns the grid to the original puzzle. While conflicts are hidden, the count is not shown and does not increase. Showing them again shows the count already kept. Check does not add existing repeats to the count. Clear entries sets the count to 0. A new puzzle starts at 0.

Check is part of Error checking too, so it is offered only while conflicts are shown. Check reports:

- Already solved: “This grid is already solved.”
- Repeats: “N cells repeat a digit.” The status line then reports “N conflicting cells” for those same cells.
- No repeats, grid full, but not the solution: “The grid is full, but it isn't the solution.”
- No repeats, cells still open: “No repeats yet. One cell is still open.” or “No repeats yet. N cells are still open.”

## Available helpers

Preferences has an Available helpers section with one on/off switch for each group of helpers. Every group is on by default. Two switches sit inside a group and are off by default: Explain uses my notes inside Solving help, and the dead-end warning inside Guessing tools. Switching one applies at once, does not reset the puzzle, and is not an undo step. It does not change the hint total, the error count already kept, or high scores.

| Switch | What it covers | When it is off |
| --- | --- | --- |
| Solving help | Hint and Explain | Their icons are hidden, H does nothing, and an open explanation closes |
| Explain uses my notes (inside Solving help, off by default) | Explain reading the pencil marks (see Explaining the next step) | Explain works from the board alone. While Solving help is off, this switch is grayed out and keeps its setting |
| Error checking | Conflicts, the error count, and Check | Conflicts are hidden, the error count is neither shown nor increased, and the Check icon is hidden |
| Note helpers | Clearing a placed digit from other cells' notes, by digit entry or Hint, Fill all notes, and its Fill style | Placing a digit clears only that cell's own notes, the Fill all notes icon is hidden, F does nothing, and the Fill style select is grayed out but keeps its choice |
| Board highlighting | Peer and same-digit tints, highlighted pencil marks, and the keypad's counts | Only the selected cell, conflicts, and an explanation's cells are tinted; the keypad shows no counts, but a digit with nine copies still grays out and is ignored |
| Guessing tools | Save and Restore checkpoint, and the dead-end warning switch | Their icons are hidden, S and R do nothing, and the dead-end warning is off; saved checkpoints are kept for when it is switched back on |
| Dead-end warning (inside Guessing tools, off by default) | Flagging a board that can no longer be finished | No dead ends are flagged. While Guessing tools is off, this switch is grayed out and keeps its setting |

Undo and redo restore the board as it was saved, whichever switches were on when each step was recorded.

## Checkpoints and the dead-end warning

Checkpoints support guessing: the player saves the board before trying a digit and goes back if the guess fails. They form a stack, so a guess inside a guess backs out one level at a time.

Save checkpoint puts the board, meaning its digits, pencil marks, and locked cells, on top of the stack. It does not change the board, is not an undo step, and does not start the clock. It does nothing while paused, after a win, when the board matches the checkpoint already on top, or when 20 checkpoints are saved. Restore checkpoint takes the top checkpoint off the stack and puts its board back. A restore is one undo step: undo returns the board as it was and puts the checkpoint back on the stack, and redo restores it again. Like undo, a restore keeps the clock running and leaves the error count and the hint total unchanged. A cell that a hint locked after the checkpoint was saved goes back to empty and unlocked. Restore does nothing while paused, after a win, or with no checkpoint saved. The Restore icon shows how many checkpoints are saved. Clear entries, Same puzzle, and a new puzzle empty the stack.

The dead-end warning works from the digits on the board alone, never the solution. A dead end is an empty cell where no digit can go, or a digit missing from a row, column, or box that has no empty cell left there to take it. A row, column, or box with no empty cell is left to Error checking. While a dead end exists, the status line names the first one: “Dead end: row 4, column 7 has no candidates.”, or “Dead end: 5 has no place in row 3.” (“in column 2”, “in the top-left box”). Dead cells come first in reading order, then units: boxes, then rows, then columns. The cells it names are tinted, either the dead cell, or the empty cells of that row, column, or box. It does not change the error count, and it shows nothing after a win.

## Hints

Hint fills one unlocked cell that is empty or wrong. It is offered while Solving help is on (see Available helpers).

It uses the selected cell when that cell qualifies. Otherwise it fixes the first wrong digit in reading order, and only when no digit is wrong does it fill the first empty cell in reading order. The filled digit is the solution digit. The cell becomes locked and its notes are cleared. With Note helpers on, that digit is also cleared from notes in the same row, column, and box, and if the hint leaves nine of that digit on the board, the digit is removed from every pencil mark. Undo puts those marks back. The hint counts toward the hint total, and the selection moves to that cell. Undo takes back the digit a hint filled, but not the hint: the hint total stays the same.

Hint does nothing when the puzzle is already solved, while the grid is paused, or when every unlocked cell already matches the solution.

After Hint fills a cell, the status line says which: “Hint: 7 in row 3, column 5.”, or “Hint: fixed row 6, column 2 from 4 to 9.” when it replaced a wrong digit. Screen readers announce it. It stays until the next key, tap, or selection on the board. The filled cell also pulses twice, unless the device asks for reduced motion. Fill it in, from an explanation, shows neither, because the player already chose that cell.

## Explaining the next step

Explain works out the next logical step from the digits on the board and says why in plain words. Like Hint, it is offered while Solving help is on. Unless Explain uses my notes is on (below), it ignores pencil marks, which may be incomplete. It does not change the board. An explanation counts as a hint and starts the clock, unless Explain finds nothing it can explain. Asking again about the same board does not count again, and undo does not take the hint back.

If an unlocked digit on the board is wrong, Explain names that cell first and offers to select it. Otherwise it works down the table below and uses the first technique that finds something. The two singles place a digit. The others take candidates out, and after each one Explain starts again from the singles. A candidate is a digit that can still go in a cell, worked out from the digits on the board.

| Order | Heading | What it finds |
| --- | --- | --- |
| 1 | Hidden single | A digit with only one place left in a row, column, or box. It is placed. |
| 2 | Naked single | A cell with only one candidate left. It is placed. |
| 3 | Pointing | A box where a digit's places all sit on one row or column, so the rest of that line can't hold it. |
| 4 | Claiming | A row or column where a digit's places all sit in one box, so the rest of that box can't hold it. |
| 5 | Naked pair | Two cells of a unit that can only hold the same two digits, so no other cell there can. |
| 6 | Hidden pair | Two digits that fit only in the same two cells of a unit, so those cells can't hold anything else. |
| 7 | Naked triple, Hidden triple | The same with three cells and three digits. |
| 8 | X-Wing | A digit that, in two rows, fits only in the same two columns (or in two columns, only in the same two rows), so no other cell in those columns can hold it. |
| 9 | Swordfish | The same with three rows and three columns. |
| 10 | XY-Wing | A cell that can only be x or y, seeing one cell that can only be x or z and another that can only be y or z, so no cell that sees both of those can be z. |
| 11 | X-chain | A chain for one digit, described below. |
| 12 | XY-chain, W-Wing, Chain (AIC) | A chain across digits (an alternating inference chain), described below. |

Chains are built from pairs where at least one must be true, joined by links where at most one can be true:

- **X-chain.** Each pair is a row, column, or box where the digit has only two places left. Between pairs, a cell rules the digit out of a cell it sees. The chain starts and ends on a pair, so one of its two end cells holds the digit, and no cell that sees both ends can.
- **AIC.** The same idea for candidates of any digit. A pair is either the two places for a digit in a unit, or a cell with only two candidates. Between pairs, a candidate rules out one that clashes with it: the same digit in a cell it sees, or another digit in the same cell. One of the two end candidates is true, so any candidate that clashes with both is removed.
- **Headings.** An AIC whose pairs are all two-candidate cells is headed XY-chain. Two cells holding the same two digits, joined through a unit where one of those digits has only two places, is headed W-Wing. Any other AIC is headed Chain (AIC).
- **Which chain.** Explain uses the shortest chain that takes a candidate out, tries AICs only after X-chains, and words a chain link by link.

The explanation lists only the steps the placement depends on, in order, with Back and Next between them, and ends with the digit to place. Fill it in places that digit the same way Hint does, without counting a second hint. If none of these techniques finds a placement, Explain says so.

### Explain uses my notes

Explain uses my notes is a switch inside Solving help, off by default. While it is on, Explain also reads the pencil marks, the same way the With pointing fill does: one box and one digit at a time. If the player has marked a digit anywhere in a box, Explain treats that digit as possible only in the cells of the box where it is marked. A box with no mark of a digit keeps all its candidates for it. A single cell's marks are never read as its full list. A mark where the digit can't go (it is already in the cell's row, column, or box) is ignored, and a box whose marks of a digit are all like that is treated as having none.

Before trusting them, Explain checks those marks against the solution, after the check for a wrong digit on the board. A box and digit whose marks leave out the cell where the digit really goes are wrong notes. Explain reports the first in box order, then digit order, under the heading “Notes to check”: “Your 5s in the top-left box leave out the cell where 5 goes. Fix those notes, or explain without them.” It names the box and the digit, never the cell, and the board tints the whole box. It offers **Explain without my notes**, which explains from the board alone, as if the switch were off. Wrong notes count as a hint, like a wrong digit; asking again without the notes on the same board does not count again.

When the notes are right, the candidates Explain starts from are the board's candidates narrowed by the notes. A deduction the notes already hold is not repeated as a step, and the notes can take Explain further than its techniques alone. A step that relies on a candidate the notes took out says so at the end, naming each box and digit it used: “This relies on your 5s in the top-left box.” The line under the explanation then reads “Worked out from the digits on the board and your notes.” With the switch off, it reads “Worked out from the digits on the board, not your notes.”, as it does for a wrong digit. An explanation worked out from the notes also closes when the notes change.

While an explanation is shown, it replaces the status card and the board tints only the cells it talks about: the cell to fill, the cells that make the pattern, the cells losing a candidate (outlined), and the rest of the row, column, or box. X-Wing, Swordfish, XY-Wing, and the chains span several rows and columns, so they tint only their own cells and the cells losing a candidate. Any change to the board, pausing, or a win closes it. Pressing Explain again also closes it.

## Undo, redo, and clearing

Digit entry, notes, Fill all notes, erase, hint, and Restore checkpoint each record a step. Up to 100 steps are kept. A new step drops the redo stack.

Undo and redo move one step and leave the error count and the hint total unchanged. They are unavailable while the grid is paused, and when there is no step in that direction. Returning to the original puzzle, with no notes and no hints, is treated as not started: the timer reads 0:00 and does not run.

Clear entries restores the original givens, clears notes, hints, the error count, the timer, and the history. Given digits stay.

- If the player has not started, Clear entries does nothing.
- If the puzzle is solved, it clears immediately.
- Otherwise it asks “Clear every number you wrote? The given digits stay.” The player confirms with “Clear entries” or dismisses with “Keep playing”.

## A new puzzle

New puzzle opens a dialog in the center of the screen, including on a phone. The dialog offers Easy, Medium, Hard, Expert, Master, and Extreme. Choosing one deals that difficulty. The current puzzle’s difficulty is shown pressed.

If play has started and the puzzle is not solved, the dialog says “Deal a new puzzle? This grid will be replaced.” Otherwise it says “Choose a difficulty.” “Keep playing” dismisses it, and so does Escape.

## Timer and pause

The clock starts on the first digit, note, Fill all notes, erase, or hint. It shows minutes and seconds, and adds hours after 59:59. It stops on a win. Undo back to an unstarted grid resets it to 0:00.

Penalty time is kept apart from play time. Only Fill all notes adds to it (see Entering digits). The clock shows play time; once there is a penalty, it is shown beside the clock in smaller type, such as “+ 2:02”: under the clock below 720 pixels wide, and to its right from 720 pixels. The time that counts on a win and in high scores is play time plus penalty time. Clear entries and undo back to an unstarted grid reset the penalty to 0 along with the clock; nothing else takes it back.

Pause covers the grid and stops the clock. Resume uncovers the grid and continues the clock only if play had started. Pause is unavailable after a win. The pause control and the P key toggle it. Escape, when no dialog is open, resumes a paused grid; it does not pause.

## Winning

When the grid matches the solution, the clock stops and a solved panel covers the board. It shows the time, the difficulty, and the hint count (“no hints”, “1 hint”, or “N hints”). With no penalty the time is the play time, as in “4:05 on hard, 1 hint.” With a penalty it is the total, then play time plus penalty: “14:36 (12:34 + 2:02 penalty) on medium, no hints.” Under that, a line says where the game placed in the high scores (see High scores), or “Replayed puzzle, so it doesn't count toward records.” That line shows only for the win just played, not after a reload. From the panel the player can open High scores, replay the same givens (“Same puzzle”), or open the new-puzzle dialog and choose a difficulty.

## What is remembered

The game is stored in the browser under `sudoku.desk.v1`. A saved game is restored on the next visit, including whether it came from Mt. Sudoku or was generated here. A saved record with no source is treated as generated. A saved record that is not a valid puzzle is ignored, and the next visit asks Mt. Sudoku for a medium puzzle.

The record must have a completed, conflict-free solution. Every given must match the solution and be locked. Every locked cell in the working grid must match the solution. The saved game includes its checkpoints, so backup files and sync carry them too. A stored checkpoint is used only when it is a well-formed board whose locked cells match the solution; a damaged one is dropped on its own, and a game saved before checkpoints existed has none. A restore step in the history keeps the checkpoint it took, so undo still puts it back after a refresh. The error count and the penalty time are part of the saved game. A saved game with no penalty time, or an invalid one, reads as no penalty. A saved game with no error count is treated as 0. History and redo kept in storage are capped at 100 steps each, the same as in play, so undo works the same after a refresh. An error count stored on an older history step is ignored.

The clock is written about every five seconds while it is running, and again when the page is hidden or closed. Other moves are written as they happen.

Each saved game carries `savedAt`, the time the player last changed it. Writes that change only the clock keep the old time, so a game left open does not become “newer”. A game a browser deals for itself on a first visit is saved with `savedAt` 0. Sync uses this time to choose between copies.

High scores are stored under `sudoku.scores.v1`, and a random id for this browser under `sudoku.device`. While a sign-in email is waiting, its address is kept for an hour under `sudoku.signin-pending`.

The color theme is stored separately under `sudoku.theme`, as the theme's id. With nothing stored, the page uses Paper or Lamplight to follow the device's light or dark setting. The older values `light` and `dark` map to those two.

How digits are entered, the Available helpers switches, and the Fill style are stored under `sudoku.prefs.v1`. Error checking is stored as `showConflicts`, the name it had before Available helpers, so an older record keeps its choice; the other switches are `solvingHelp`, `explainNotes`, `noteHelpers`, `highlighting`, `guessingTools`, and `deadEndWarning`. The Fill style is stored as `fillStyle`, either `plain` or `pointing`. The default entry method is the notes button, every helper is on except the dead-end warning and Explain uses my notes, and the Fill style is Plain. Each stored field is read on its own: a missing or invalid one takes its default and the others are kept. On a first visit that has a saved game and no preferences yet, the saved game’s conflict setting is kept. Changing any preference applies immediately and does not reset the puzzle. Preferences stay in this browser; sync does not carry them. Changing a preference is not an undo step.

## Screen

The page fills the browser window. From a window width of 720 pixels, the board is the largest square that fits beside the controls, which are a fixed column on the right.

The clock, pause, preferences, high scores, and new puzzle sit in the header, in that order. Preferences, high scores, and new puzzle are icons. Preferences opens a dialog for the entry method, for Available helpers, for the color theme, for resetting high scores, for backup files, and for sync. Each theme is one file in `src/themes`, listed in `src/themes/index.ts`. High scores opens the high-score tables. New puzzle opens the difficulty dialog. Escape closes any of these dialogs.

Below a window width of 720 pixels, the board is as wide as the screen, snapped down to a multiple of nine pixels so the cells stay even. The keypad is a square at the left of the control panel. With the notes button selected, notes, fill all notes, erase, undo, redo, hint, explain, check, save checkpoint, restore checkpoint, and clear entries are icons filling the space to its right. With one tap, two taps selected, the notes icon is hidden and the other ten remain. Fill all notes is hidden while Note helpers is off, hint and explain while Solving help is off, check while Error checking is off, and the two checkpoint icons while Guessing tools is off; the icons left fill the same space. From 720 pixels wide, the keypad is a square the width of the control column, and those same icons sit under it: in one row when there are nine or fewer, otherwise split over two rows. The keypad keeps that size when the window gets shorter. A second tap on a digit writes it without the pad waiting on a zoom gesture. Difficulty and helpers are chosen in dialogs, not in this column. From 720 pixels wide, a line under the board lists the main keys for the chosen entry method.

Pencil marks are the largest size that still places all nine digits inside a cell. They are set in a handwritten face so they stay distinct from the printed digits.

Box borders are heavier than the lines between cells inside a box. Both stay visible as the board gets smaller. The selected cell is highlighted. With Board highlighting on, peers in its row, column, and box are tinted, and other cells holding the same digit are tinted more strongly. Conflicts, when shown, use their own tint and take precedence over those three. Cells the dead-end warning names use the conflict tint with a dotted outline, after conflicts and before everything else.

With Board highlighting on, when the selected cell holds a digit, every pencil mark of that same digit is highlighted inside its cell. That mark is added on top of the cell tint. Selecting an empty cell does not highlight notes. With Board highlighting off, only the selected cell, conflicts, and an explanation's cells are tinted, and no marks are highlighted.

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
| H | Hint. Does nothing while Solving help is off |
| F | Fill all notes. Does nothing while Note helpers is off |
| S | Save checkpoint. Does nothing while Guessing tools is off |
| R | Restore checkpoint. Does nothing while Guessing tools is off |
| U, or Command/Ctrl+Z | Undo |
| Y, or Command/Ctrl+Shift+Z | Redo |
| Escape | Dismiss the open dialog, or resume when paused |

After a win, only P is handled among the single-key shortcuts. P does not pause a solved grid. The undo chord still undoes. While paused, only P, Escape, and the undo chord are recognized. The undo chord does not change the board until the grid is resumed.

## High scores

Each solved puzzle is recorded once, the first time it is solved. A record keeps the puzzle's givens, when it was finished, the difficulty, the time (play time plus penalty), the penalty part of that time, the hint count, the source, and the browser it was solved in. Replaying the same givens, or reloading a game that is already solved, does not add a record. Records are never edited after they are written. A record saved before penalties were kept apart reads as having none; any penalty it had is already in its time.

The High scores dialog shows the ten fastest records for one difficulty, with Weekly, Monthly, and All time tabs. It opens on the current puzzle's difficulty. Weeks start on Monday, and weeks and months follow the device's local time. Games solved with hints are ranked with the rest, marked with a lightbulb and their hint count. Records rank on the full time. Each row shows the rank, the time, any penalty in smaller type (“incl. 2:02 penalty”), and the finish date, with the year on the All time tab. The game just won is highlighted.

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
