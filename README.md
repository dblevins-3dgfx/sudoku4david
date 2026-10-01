# Sudoku

A paper-and-ink Sudoku you can play in the browser. Each puzzle is generated on the spot and has exactly one solution.

## Play

- Choose **Easy**, **Medium**, or **Hard**, then deal a new puzzle.
- Select a cell and enter **1–9** from the keypad or the keyboard.
- **Notes** toggles pencil marks. Placing a digit clears that note from the row, column, and box.
- Conflicts light up as you go. Hide them, or press **Check** for a status line.
- **Hint** fills the selected empty or wrong cell and locks it.
- **Undo**, **Redo**, and **Clear entries** are there when a line of thinking doesn't hold.
- The timer starts on the first mark. Pause covers the grid.
- The game is saved in this browser, so a refresh keeps the same puzzle.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed in the terminal. `npm test` checks the generator and the rules of play. `npm run lint` runs ESLint.
