# Sudoku

A paper-and-ink Sudoku you can play in the browser. A new puzzle comes from [Mt. Sudoku](https://mtsudoku.com/en/api) at the difficulty you choose, and has exactly one solution. If Mt. Sudoku does not answer, the generator in this page deals the same difficulty.

## Play

- Choose **Easy**, **Medium**, **Hard**, **Expert**, **Master**, or **Extreme**, then deal a new puzzle. Mt. Sudoku deals that difficulty. The phase line reads **Mt. Sudoku** or **Generated**.
- Select a cell and enter **1–9** from the keypad or the keyboard.
- **Notes** toggles pencil marks. Placing a digit clears that note from the row, column, and box. Selecting a filled cell highlights that digit wherever it appears in the notes.
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

## GitHub Pages

`main` is published by GitHub Actions. The workflow builds a static export into `out/` and deploys that folder. On a project site the build sets `BASE_PATH` to `/<repository>` so scripts and fonts load from the repository path.

```bash
npm run build
```

The exported site is in `out/`. To preview the project-page paths locally, build with `BASE_PATH=/sudoku4david`.
