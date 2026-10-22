# SPEC.md rules without unit tests

Every rule in `SPEC.md` should have a unit test in `src/lib/*.test.ts` that fails if the rule breaks. This file lists the rules that don't, and why. Keep it current: a pull request that adds or changes a spec rule either tests it or adds a row here, and one that adds a test for a rule listed here removes its row.

The tests only reach plain functions in `src/lib`. Code inside a React hook (such as `src/components/sudoku/use-game.ts`, which React re-runs on every screen update) or a component needs a browser to run, so a rule that lives there is untested. The fix is usually to move the decision into a function in `src/lib` and have the hook call it, as `src/lib/play.ts` and `src/lib/labels.ts` do.

## Untested rules

| Spec section | Rule | Where it lives | Why it isn't tested |
| --- | --- | --- | --- |
| Generating a puzzle | Falling back to the built-in generator, with "Mt. Sudoku didn't answer, so this puzzle was dealt here."; "Couldn't compose a puzzle. Try once more." when that fails too; the first visit deals medium | `deal()` and the first-load effect in `use-game.ts` | Network and start-up wiring in the hook. The choice could move into `src/lib`. |
| Generating a puzzle | Up to four tries, then keeping the last unique puzzle even outside the clue range | `createPuzzle` in `src/lib/sudoku.ts` | Testable now, but needs a random-number source rigged to miss the range. Not written yet. |
| Explaining the next step | The panel closes on any board change, pause, or win, and when Explain is pressed again; "the same board" is not counted twice | `advice` and `countedGridRef` in `use-game.ts` | Hook state. The same-board check also has a bug: [#51](https://github.com/dblevins-3dgfx/sudoku4david/issues/51). |
| Conflicts | Hiding or showing conflicts takes effect at once, is stored, and is not an undo step; Check stores "shown" | `applyShowConflicts()` in `use-game.ts` | Hook state and storage wiring. |
| Timer and pause | The clock ticks while running; the game is written every five seconds and when the page is hidden or closed | effects in `use-game.ts` | Timers and page events. Needs a browser test. |
| Sync | When sync runs: sign-in, page shown or hidden, back online, every 30 seconds, after a win, a reset, or a backup load | `use-sync.ts` | Timers, page events, and the network. What a sync decides (`planSync`) is tested. |
| Hints | The notice shows after Hint and clears on the next action; the filled cell pulses twice, not at all with reduced motion; Fill it in shows neither | `giveHint` in `use-game.ts`, the `flash` prop in `board.tsx`, `.hint-flash` in `globals.css` | Hook state and a CSS animation. The wording (`hintNotice`) is tested. |
| Screen | Layout and sizes, cell tints and their precedence, note highlighting, the handwritten pencil marks | CSS and the components | Visual. Screenshots are the practical check. |
