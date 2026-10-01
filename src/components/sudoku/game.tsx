"use client";

import {
  Eraser,
  Lightbulb,
  Moon,
  Pause,
  Pencil,
  Play,
  Redo2,
  RotateCcw,
  Sun,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DIFFICULTIES, formatTime, type Digit } from "@/lib/sudoku";
import { Board, BoardSkeleton } from "./board";
import { useGame, type Pending } from "./use-game";

function pendingCopy(pending: Pending): string {
  if (pending.kind === "restart") {
    return "Clear every number you wrote? The given digits stay.";
  }
  return `Deal a new ${pending.difficulty} puzzle? This grid will be replaced.`;
}

function winDetail(hintsUsed: number, elapsedMs: number, difficulty: string): string {
  const hints = hintsUsed === 0 ? "no hints" : hintsUsed === 1 ? "1 hint" : `${hintsUsed} hints`;
  return `${formatTime(elapsedMs)} on ${difficulty}, ${hints}.`;
}

export function Game() {
  const desk = useGame();
  const {
    game,
    booting,
    dealing,
    error,
    notice,
    pending,
    chosen,
    conflicts,
    counts,
    filled,
    setChosen,
    deal,
    requestNew,
    requestRestart,
    confirmPending,
    cancelPending,
    toggleTheme,
    select,
    input,
    eraseCell,
    undoMove,
    redoMove,
    toggleNotes,
    toggleMistakesShown,
    pause,
    giveHint,
    check,
  } = desk;

  const busy = booting || dealing;
  const lockedPlay = !game || game.paused || game.won || busy;
  const selectedValue = game ? game.grid[game.selected.r][game.selected.c] : 0;
  const noteMask = game ? game.notes[game.selected.r][game.selected.c] : 0;
  const conflictTotal = conflicts.reduce(
    (sum, row) => sum + row.reduce((rowSum, cell) => rowSum + (cell ? 1 : 0), 0),
    0,
  );
  const open = 81 - filled;
  const showMistakes = game?.showMistakes ?? true;
  const status = !game
    ? "Preparing a grid"
    : game.won
      ? "Solved"
      : game.paused
        ? "Paused"
        : showMistakes && conflictTotal > 0
          ? conflictTotal === 1
            ? "1 conflict"
            : `${conflictTotal} conflicts`
          : open === 1
            ? "1 cell open"
            : `${open} cells open`;

  const canHint =
    !!game &&
    !game.paused &&
    !game.won &&
    game.grid.some((row, r) => row.some((value, c) => !game.locked[r][c] && value !== game.solution[r][c]));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col gap-3 px-3 py-3 sm:px-5">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-medium tracking-[0.22em] text-muted-foreground uppercase">
            One solution
          </p>
          <h1 className="font-heading text-3xl leading-none tracking-tight sm:text-4xl">Sudoku</h1>
          <p className="desk-lede mt-1 truncate text-sm text-muted-foreground">
            Fill each row, column, and 3×3 box with 1–9. Nothing repeats.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="min-w-[4.25rem] text-right font-heading text-3xl tabular-nums leading-none" aria-label="Elapsed time">
            {formatTime(game?.elapsedMs ?? 0)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={pause}
            disabled={!game || game.won || busy}
            aria-label={game?.paused ? "Resume" : "Pause"}
            aria-pressed={game?.paused ?? false}
          >
            {game?.paused ? <Play /> : <Pause />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
          >
            <span className="relative size-4">
              <Sun className="absolute inset-0 hidden size-4 dark:block" />
              <Moon className="absolute inset-0 size-4 dark:hidden" />
            </span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden min-[720px]:flex-row min-[720px]:items-stretch">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-busy={busy}>
          {game?.notesMode && !busy && !game.paused && !game.won ? (
            <p className="mb-1 shrink-0 text-center text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Notes
            </p>
          ) : null}

          {busy || !game ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="board-slot">
                <div className="board-frame">
                  <BoardSkeleton />
                </div>
              </div>
              <p className="mt-2 shrink-0 text-center text-sm text-muted-foreground" role={error ? "alert" : "status"}>
                {error ?? "Composing a fair puzzle…"}
              </p>
              {error ? (
                <div className="mt-2 flex shrink-0 justify-center">
                  <Button type="button" onClick={() => deal(chosen)}>
                    Try again
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="board-slot">
              <div className="board-frame relative">
                <div className="isolate h-full w-full" inert={game.paused || game.won ? true : undefined}>
                  <Board game={game} conflicts={conflicts} onSelect={select} />
                </div>
                {game.paused ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-card p-4 text-center">
                    <div>
                      <p className="font-heading text-3xl tracking-tight">Paused</p>
                      <p className="mt-2 text-sm text-muted-foreground">The grid is covered.</p>
                      <Button type="button" className="mt-4 h-9 px-4" onClick={pause}>
                        <Play />
                        Resume
                      </Button>
                    </div>
                  </div>
                ) : null}
                {game.won ? (
                  <div className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-background via-background/85 to-background/25 p-3 sm:items-center">
                    <div className="w-full max-w-sm rounded-xl border border-border bg-card px-4 py-4 text-center shadow-lg">
                      <p className="font-heading text-3xl tracking-tight">Solved</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {winDetail(game.hintsUsed, game.elapsedMs, game.difficulty)}
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button type="button" variant="outline" className="h-9" onClick={requestRestart}>
                          <RotateCcw />
                          Same puzzle
                        </Button>
                        <Button type="button" className="h-9" onClick={() => requestNew(chosen)}>
                          New puzzle
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <p className="desk-hint mt-2 hidden shrink-0 text-center text-xs text-muted-foreground min-[720px]:block">
            Arrows move · 1–9 fill · N notes · Delete erase · P pause · ⌘Z undo
          </p>
        </section>

        <aside className="flex max-h-[46%] min-h-0 w-full flex-col gap-1 overflow-y-auto min-[720px]:max-h-none min-[720px]:w-[18.75rem] min-[720px]:shrink-0 min-[720px]:self-stretch">
          <div className="shrink-0 rounded-xl border border-border bg-card px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm" aria-live="polite">
                {notice ?? status}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {game ? `${filled}/81` : "—"}
              </p>
            </div>
            <div className="mt-2 h-1 overflow-hidden bg-muted" aria-hidden="true">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${(filled / 81) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
              {game ? `${game.won ? "Solved" : game.started ? "Playing" : "Ready"} · ${game.difficulty}` : "Dealing"}
            </p>
          </div>

          {error && game ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid min-h-[6.25rem] flex-1 grid-cols-3 grid-rows-3 gap-1" aria-label="Digits">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).map((digit) => {
              const placed = counts[digit] ?? 0;
              const remaining = Math.max(0, 9 - placed);
              const pressed = game
                ? game.notesMode
                  ? selectedValue === 0 && (noteMask & (1 << digit)) !== 0
                  : selectedValue === digit
                : false;
              return (
                <Button
                  key={digit}
                  type="button"
                  variant={pressed ? "default" : "outline"}
                  className="relative h-full min-h-8 text-lg font-semibold tabular-nums"
                  aria-label={
                    remaining === 0
                      ? `Enter ${digit}, all nine placed`
                      : `Enter ${digit}, ${remaining} still missing`
                  }
                  aria-pressed={pressed}
                  disabled={lockedPlay}
                  onClick={() => input(digit)}
                >
                  {digit}
                  <span
                    className={cn(
                      "absolute top-1 right-1.5 text-[0.65rem] font-medium tabular-nums opacity-70",
                      placed > 9 && "text-destructive opacity-100",
                    )}
                  >
                    {remaining}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-1">
            <Button
              type="button"
              variant={game?.notesMode ? "default" : "outline"}
              className="h-8"
              aria-pressed={game?.notesMode ?? false}
              disabled={!game || game.paused || game.won || busy}
              onClick={toggleNotes}
            >
              <Pencil />
              Notes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={lockedPlay}
              onClick={eraseCell}
            >
              <Eraser />
              Erase
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={!game || game.paused || busy || game.history.length === 0}
              onClick={undoMove}
            >
              <Undo2 />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={!game || game.paused || busy || game.future.length === 0}
              onClick={redoMove}
            >
              <Redo2 />
              Redo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={!canHint || busy}
              onClick={giveHint}
            >
              <Lightbulb />
              {game && game.hintsUsed > 0 ? `Hint · ${game.hintsUsed}` : "Hint"}
            </Button>
            <Button type="button" variant="outline" className="h-8" disabled={!game || busy || game.paused} onClick={check}>
              Check
            </Button>
            <Button
              type="button"
              variant={showMistakes ? "secondary" : "outline"}
              className="col-span-2 h-8"
              aria-pressed={showMistakes}
              disabled={!game || busy}
              onClick={toggleMistakesShown}
            >
              {showMistakes ? "Conflicts shown" : "Conflicts hidden"}
            </Button>
          </div>

          <div role="group" aria-label="Difficulty for the next puzzle" className="grid shrink-0 grid-cols-3 gap-1">
            {DIFFICULTIES.map((level) => (
              <Button
                key={level.id}
                type="button"
                variant={chosen === level.id ? "default" : "outline"}
                className="h-8"
                aria-pressed={chosen === level.id}
                disabled={busy}
                onClick={() => setChosen(level.id)}
              >
                {level.label}
              </Button>
            ))}
          </div>
          <p className="desk-detail shrink-0 text-xs leading-5 text-muted-foreground">
            {DIFFICULTIES.find((level) => level.id === chosen)?.detail}. A new puzzle keeps a single solution.
          </p>

          <div className="grid shrink-0 grid-cols-2 gap-1">
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={!game || !game.started || busy}
              onClick={requestRestart}
            >
              <RotateCcw />
              Clear entries
            </Button>
            <Button type="button" className="h-8" disabled={busy} onClick={() => requestNew(chosen)}>
              {game && chosen !== game.difficulty ? `New ${chosen}` : "New puzzle"}
            </Button>
          </div>
        </aside>
      </div>

      {pending ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-background/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pending-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card px-5 py-5 shadow-lg">
            <p id="pending-title" className="text-base leading-6">
              {pendingCopy(pending)}
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="button" className="h-11 flex-1" onClick={confirmPending}>
                {pending.kind === "restart" ? "Clear entries" : "Deal"}
              </Button>
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={cancelPending}>
                Keep playing
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
