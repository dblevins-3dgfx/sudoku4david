# Development notes

What a newcomer can't learn from the other files. Read these first: [README.md](README.md) (play, run, Pages build), [SPEC.md](SPEC.md) (the game as built), [CLAUDE.md](CLAUDE.md) (spec and test rules), [AGENTS.md](AGENTS.md) (Next.js version warning), [untested-requirements.md](untested-requirements.md), [.github/pull_request_template.md](.github/pull_request_template.md) and [.github/workflows/pages.yml](.github/workflows/pages.yml).

## How changes are made

- The owner, David (`dblevins-3dgfx`), reviews and merges PRs himself, as merge commits. Agents never merge and never push to `main`.
- Usual flow: log a GitHub issue for the change (assigned to David), then one PR that says `Closes #N`. Big features are split into numbered parts, one PR each (high scores #33–#35, sync #36–#37).
- **One open PR at a time.** David chose this over parallel branches (2026-10-12) and repeated it (2026-10-23). Open the next PR only after the last one merges, and start it from fresh `main`.
- Branch names come from the tool that made them: `claude/project-thread-<id>` for Claude sessions, `cursor/<topic>` for the early Cursor PRs (#1, #2). There is no other convention.
- Fill in the PR template's Spec and Tests sections every time. A PR that changes nothing a player sees says so under Spec.
- If David asks a question in a PR review, answer it on the PR and, when it reveals a non-obvious idiom, add a code comment too (as on #58).
- Write comments, PR text and explanations for a veteran C/C++ programmer who is new to the web: explain browser, React, Next.js and TypeScript idioms, skip programming basics. C/C++ analogies are welcome (`// like a scoped #pragma` in `eslint.config.mjs`).
- There are no releases or tags. Every merge to `main` deploys the live site.

## Checks

- Before a PR: `npm run lint` and `npm test` (what CI runs), plus `npm run build`.
- CI does **not** build on PR branches. The `build` and `deploy` jobs run only on `main`, so a broken build or a broken CSP step is first seen after merge. `npm run build` also runs `postbuild` (`scripts/add-csp.ts`), which throws if a page has no `<head>`.
- The function size limits in `eslint.config.mjs` are errors, so they fail CI (#82, PR #83). A function over the limit needs a refactor or an `// eslint-disable-next-line <rule> -- <reason>` comment, and an unused disable comment is itself an error, so remove it once the function shrinks.
- Run by an AI agent, `next build` may stop once with exit 1 and a `SecurityFatalError` upgrade notice when Next.js has a newer security release (`node_modules/next/dist/lib/upgrade/nudge.js`). Running it again builds normally. It only stops for detected agents, not in CI. Seen 2026-11-24 on Next 16.4.3, so a Next.js security upgrade is due.
- There is no code formatter (no Prettier). Match the style of the file you edit.
- `next dev` rewrites the block between the markers in `AGENTS.md`. Commit that diff rather than fighting it.

## Running and testing locally

- `npm run dev`, or `npm run build` then serve `out/`. To preview the Pages paths, build with `BASE_PATH=/sudoku4david`.
- Open the dev server at `localhost`, or at `127.0.0.1` (allowed in `next.config.ts`). Any other host name leaves the page stuck as server-rendered HTML.
- Dev builds show a round "N" badge in a corner. It is Next.js's dev indicator and is not in the exported site.
- Everything the app stores is in `localStorage` (see the `*_STORAGE_KEY` constants in `src/lib/storage.ts`, `src/lib/prefs.ts`, `src/lib/records.ts`; `sudoku.signin-pending` in `src/components/sudoku/dialogs.tsx`). Clear site data in the browser to start over.
- Browser checks were done with Playwright's Chromium at phone sizes (iPhone 15, iPhone SE) and desktop. It is not Safari, so iOS fonts and shadows may differ slightly.
- If `api.mtsudoku.com` is unreachable (for example from a sandbox), the app falls back to its own generator after the 8 s timeout in `src/lib/mtsudoku.ts`, and says "Mt. Sudoku didn't answer, so this puzzle was dealt here."
- Sync can be checked with `curl` against the Supabase REST API using the public key in `src/lib/remote-config.ts`. Sign-in can't: the email link must be opened by David on his own devices. Don't trigger sign-in emails while testing (see the rate limit below).
- Photo reader fixtures: `src/lib/fixtures/sample-puzzle.pgm.gz` (straight scan) and `sample-puzzle-photo.pgm.gz` (tilted, shaded). The printed sample has six solutions, so the app correctly refuses it. To rebuild the digit templates, see the header of `scripts/digit-templates/render_fonts.py`.

## Gotchas

- **CSP lives in a `<meta>` tag**, because GitHub Pages can't send headers (#7, PR #28). `scripts/add-csp.ts` hashes every inline script after the build, plus the theme script (`THEME_SCRIPT` in `src/lib/theme.ts`), which Next.js injects at runtime and so isn't in the HTML. Any new inline script, or new origin the page fetches from, needs `src/lib/csp.ts` updated, or the browser silently blocks it.
- **The theme script runs before React** to avoid a flash of the wrong theme. It is a minified string built from `THEME_STORAGE_KEY` (#9, PR #23) and wrapped in `try`, because `localStorage` throws in some private modes (#8, PR #18).
- **Pages actions and dot-files.** `upload-pages-artifact` v4+ drops dot-files unless `include-hidden-files: true`, which would lose `public/.nojekyll` (PR #65). Actions are pinned to commit SHAs with the version in a comment (#4, PR #20); bump both together.
- **Node 20 deprecation warnings** in CI logs come from the actions' own runtime, not from the project's Node 22 (PR #65).
- **Deploys can stall.** On 2026-10-12 a `deploy` job sat "waiting" on the `github-pages` environment and every later deploy was cancelled, so the site stayed old while CI was green. After a merge, check the `deploy` job finished, not just `check`.
- **iPhone home-screen app** keeps storage separate from Safari, and a tapped Mail link opens in Safari. So sign-in there works by pasting the copied link into the app (PRs #38, #39). The pending sign-in survives the switch to Mail via `sudoku.signin-pending`. A typed one-time code was tried and dropped: showing it needs an edited email template, which the free Supabase sender doesn't allow.
- **Undo restores make new grid objects** (`cloneGrid`), so comparing grids with `===` compares pointers, not digits. This was the cause of #51.
- **ESLint counts `?.` and `??` as branches**, so TypeScript complexity scores run higher than the same C would.
- **Rules in hooks can't be unit-tested.** `src/components/sudoku/use-game.ts` is one large hook (lint-exempt for length). Move each decision into `src/lib` and have the hook call it (PRs #53, #85).

## Decisions

- **No lock-in for sync** (#32): Supabase (open source, plain Postgres), all calls through `src/lib/remote.ts` only, plain JSON rows in the app's existing formats, and Backup files as an escape hatch. The newest save wins for the current game; high scores merge. Sign-in is by email link only.
- **Photo import is on-device** (PR #90): no upload, no API key, no CSP opening. A photo whose givens don't have exactly one solution is refused with an explanation, because Hint, Check, Explain and winning all assume one answer.
- **No LLM advisor.** #40 was closed after measuring that an LLM couldn't fill the cases the step finder misses. The remaining gap would need ALS or forcing chains.
- **Explain counts as one hint**, unless the finder finds no step (PR #42). Commentary does not count yet (#92).
- **Helpers never leak the solution.** Fill all notes fills even with a wrong digit on the board. Explain and Commentary name wrong notes by box and digit, never the cell. Commentary names mistakes only while Error checking is on.
- **Helper penalties**: Fill all notes costs 1 s per mark changed, never refunded (PR #76). The penalty is kept apart and shown as "12:34 + 2:02" (PR #88). David ruled the undo-to-pristine and Clear entries clock resets won't-fix (#75).
- **Fill style "With pointing" trusts the player's own marks**, even wrong ones (PR #79), to match David's own play style.
- **Themes are a registry** (`THEMES` in `src/themes/index.ts`, one file per theme) because David asked for the open/closed principle (PR #29).
- **Conflict wording**: "N conflicting cells", with no singular forms (#54, PR #59). A `.` is still accepted as an empty cell from Mt. Sudoku (kept on David's call, PR #52).
- **App name**: "David's own private Sudoku" (PR #30).
- **Wording and tone**: plain, short sentences in UI text and docs, as in `README.md` and `SPEC.md`.

## Setup outside the repository

- **GitHub Pages**: built and deployed by `pages.yml` through the `github-pages` environment; site at `https://dblevins-3dgfx.github.io/sudoku4david/`. Pages source setting (GitHub Actions) is inferred from the workflow, unverified.
- **Supabase** (owned by David; free tier): project URL and public key in `src/lib/remote-config.ts`. Never ask for or commit the `service_role`/secret key.
  - Table `public.sync_state` (`user_id`, `game`, `game_saved_at`, `records`, `updated_at`) with row-level security: each user reads and writes only their own row.
  - Authentication → URL Configuration: Site URL is the Pages address; Redirect URLs add the same address and `http://localhost:3000/**` for local tests (the localhost entry is unverified).
  - Email uses Supabase's built-in sender: only a few sign-in emails per hour for the whole project, and templates can't be edited without custom SMTP. "Rate limit exceeded" on Send link means wait about an hour.
- **Mt. Sudoku API** (`https://api.mtsudoku.com`): the default puzzle source. No key. Its puzzles were never measured for step-finder coverage, because it was unreachable from the cloud sandbox.
- **Scheduled tasks** (Claude Code routines in David's claude.ai account, America/Los_Angeles; they stop if the subscription ends):
  - Weekly CI health check, Mondays 8:47: reports lint and test status on `main` and open PRs, and PRs behind `main` or idle 7+ days.
  - Monthly dependency check, the 1st at 8:47: runs `npm outdated` and `npm audit`, and opens a draft PR with patch and minor upgrades only if lint and tests pass (for example #89). Major upgrades (ESLint 10, TypeScript 7, `@types/node` 26, `cn` 0.5) were deliberately skipped.
- No analytics or custom domain is set up in the repo (no tracking code, no `CNAME`). Search console: unverified.

## Things to watch for

- `npm audit` still lists lower-severity advisories in dev tooling (ESLint, shadcn) that clear only with major upgrades (as of #89, 2026-11).
- `use-game.ts` keeps growing. New behaviour belongs in `src/lib` with tests.
- The step finder (`src/lib/steps/`) still gets stuck at least once on about 1–5% of Hard to Extreme generated puzzles (measured 2026-10-22). Check any new technique against a large batch of generated puzzles to be sure it never removes a correct digit.
- Explain's "same board" check (`countedGridRef` in `use-game.ts`) still compares by reference. #51 was closed on 2026-10-22 without a linked PR, and `untested-requirements.md` still calls it a bug. Whether that's intended is unverified.

## Open work

- [#92](https://github.com/dblevins-3dgfx/sudoku4david/issues/92): Commentary can confirm a guessed digit without counting as a hint. Four options are listed and David hasn't chosen one. Any change touches `src/lib/commentary.ts`, `enterDigit` in `use-game.ts`, and SPEC.md → Commentary.
