"use client";

import {
  Eraser,
  GraduationCap,
  Lightbulb,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  SearchCheck,
  Settings,
  Trophy,
  Undo2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { visibleControls, type ControlId } from "@/lib/controls";
import { helperOn } from "@/lib/helpers";
import { sourceLabel } from "@/lib/game";
import { errorsText, keypadBadge, phaseText, statusText, winDetail } from "@/lib/labels";
import { puzzleKey } from "@/lib/records";
import { formatTime, type Digit } from "@/lib/sudoku";
import { Board, BoardSkeleton } from "./board";
import { PendingDialog, PrefsDialog } from "./dialogs";
import { HighScoresDialog } from "./high-scores";
import { adviceMarks, StepPanel } from "./step-panel";
import { useGame } from "./use-game";

const CONTROL_ICONS: Record<ControlId, LucideIcon> = {
  notes: Pencil,
  fill: WandSparkles,
  erase: Eraser,
  undo: Undo2,
  redo: Redo2,
  hint: Lightbulb,
  explain: GraduationCap,
  check: SearchCheck,
  clear: RotateCcw,
};

// From 720 pixels wide the controls sit in one row, one column each. Tailwind
// only generates CSS for class names it finds spelled out in the source, so a
// computed `grid-cols-${n}` would have no style; this table spells them out.
const DESK_COLUMNS: Record<number, string> = {
  1: "min-[720px]:grid-cols-1",
  2: "min-[720px]:grid-cols-2",
  3: "min-[720px]:grid-cols-3",
  4: "min-[720px]:grid-cols-4",
  5: "min-[720px]:grid-cols-5",
  6: "min-[720px]:grid-cols-6",
  7: "min-[720px]:grid-cols-7",
  8: "min-[720px]:grid-cols-8",
  9: "min-[720px]:grid-cols-9",
  10: "min-[720px]:grid-cols-10",
  11: "min-[720px]:grid-cols-11",
  12: "min-[720px]:grid-cols-12",
};

/** The parts of a control that change with the game. */
type ControlState = {
  disabled: boolean;
  onClick: () => void;
  pressed?: boolean;
  /** Replaces the table's label, e.g. "Hint, 2 used". */
  label?: string;
  /** A small count in the button's corner. */
  badge?: number;
};

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
    prefs,
    prefsOpen,
    conflicts,
    conflictTotal,
    counts,
    filled,
    deal,
    requestNew,
    requestRestart,
    confirmPending,
    cancelPending,
    openPrefs,
    closePrefs,
    scoresOpen,
    lastWin,
    openScores,
    closeScores,
    resetRecords,
    restoreBackup,
    sync,
    setEntry,
    setHelper,
    select,
    input,
    eraseCell,
    fillAllNotes,
    undoMove,
    redoMove,
    toggleNotes,
    pause,
    giveHint,
    hintFlash,
    clearHintFlash,
    advice,
    explain,
    closeAdvice,
    showAdviceStep,
    fillCell,
    check,
  } = desk;

  const busy = booting || dealing;
  const lockedPlay = !game || game.paused || game.won || busy;
  const selectedValue = game ? game.grid[game.selected.r][game.selected.c] : 0;
  const noteMask = game ? game.notes[game.selected.r][game.selected.c] : 0;
  const open = 81 - filled;
  const showMistakes = game?.showMistakes ?? true;
  const status = statusText(game, conflictTotal, open);
  // Board highlighting also covers the keypad's "still missing" counts.
  const highlighting = helperOn(prefs, "highlighting");

  const canHint =
    !!game &&
    !game.paused &&
    !game.won &&
    game.grid.some((row, r) => row.some((value, c) => !game.locked[r][c] && value !== game.solution[r][c]));

  // What each control looks like right now. The table of controls itself,
  // with their order and labels, is CONTROLS in src/lib/controls.ts; this
  // supplies the parts that depend on the current game.
  const hintsUsed = game?.hintsUsed ?? 0;
  const controlState: Record<ControlId, ControlState> = {
    notes: {
      pressed: game?.notesMode ?? false,
      disabled: !game || game.paused || game.won || busy,
      onClick: toggleNotes,
    },
    fill: { disabled: lockedPlay, onClick: fillAllNotes },
    erase: { disabled: lockedPlay, onClick: eraseCell },
    undo: { disabled: !game || game.paused || busy || game.history.length === 0, onClick: undoMove },
    redo: { disabled: !game || game.paused || busy || game.future.length === 0, onClick: redoMove },
    hint: {
      label: hintsUsed > 0 ? `Hint, ${hintsUsed} used` : undefined,
      badge: hintsUsed > 0 ? hintsUsed : undefined,
      disabled: !canHint || busy,
      onClick: giveHint,
    },
    explain: { pressed: advice !== null, disabled: lockedPlay, onClick: advice ? closeAdvice : explain },
    check: { disabled: !game || busy || game.paused, onClick: check },
    clear: { disabled: !game || !game.started || busy, onClick: requestRestart },
  };
  const controls = visibleControls(prefs);

  return (
    <div className="desk-page mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col gap-1.5 px-1.5 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] min-[720px]:gap-3 min-[720px]:px-5 min-[720px]:py-3">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-medium tracking-[0.22em] text-muted-foreground uppercase">
            David&apos;s own private
          </p>
          <h1 className="font-heading text-2xl leading-none tracking-tight min-[720px]:text-4xl">Sudoku</h1>
          <p className="desk-lede mt-1 hidden truncate text-sm text-muted-foreground min-[720px]:block">
            Fill each row, column, and 3×3 box with 1–9. Nothing repeats.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 min-[400px]:gap-2">
          <p className="min-w-[3.5rem] text-right font-heading text-2xl tabular-nums leading-none min-[720px]:min-w-[4.25rem] min-[720px]:text-3xl" aria-label="Elapsed time">
            {formatTime(game?.elapsedMs ?? 0)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 min-[400px]:size-9"
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
            className="size-8 min-[400px]:size-9"
            onClick={openPrefs}
            disabled={!game || busy || pending !== null}
            aria-label="Preferences"
            title="Preferences"
            aria-pressed={prefsOpen}
          >
            <Settings />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 min-[400px]:size-9"
            onClick={openScores}
            disabled={pending !== null}
            aria-label="High scores"
            title="High scores"
            aria-pressed={scoresOpen}
          >
            <Trophy />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 min-[400px]:size-9"
            onClick={requestNew}
            disabled={busy}
            aria-label="New puzzle"
            title="New puzzle"
          >
            <Plus />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden min-[720px]:flex-row min-[720px]:items-stretch min-[720px]:gap-3">
        <section className="flex min-h-0 min-w-0 flex-col max-[719px]:shrink-0 min-[720px]:flex-1" aria-busy={busy}>
          {game?.notesMode && prefs.entry === "button" && !busy && !game.paused && !game.won ? (
            <p className="mb-1 hidden shrink-0 text-center text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase min-[720px]:block">
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
                {error ?? `Asking Mt. Sudoku for a ${chosen} puzzle…`}
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
                  <Board
                    game={game}
                    conflicts={conflicts}
                    marks={advice ? adviceMarks(advice) : null}
                    highlighting={highlighting}
                    flash={hintFlash}
                    onFlashEnd={clearHintFlash}
                    onSelect={select}
                  />
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
                      {/* Only for the win just played: after a reload, lastWin is empty. */}
                      {lastWin && lastWin.puzzle === puzzleKey(game.puzzle) ? (
                        <p className="mt-1 flex items-center justify-center gap-1 text-sm font-medium">
                          {lastWin.placement ? (
                            <>
                              {lastWin.hinted ? (
                                <Lightbulb className="size-3.5" role="img" aria-label="Solved with hints" />
                              ) : null}
                              {lastWin.placement}
                            </>
                          ) : (
                            "Replayed puzzle, so it doesn't count toward records."
                          )}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button type="button" variant="outline" className="h-9" onClick={openScores}>
                          <Trophy />
                          High scores
                        </Button>
                        <Button type="button" variant="outline" className="h-9" onClick={requestRestart}>
                          <RotateCcw />
                          Same puzzle
                        </Button>
                        <Button type="button" className="h-9" onClick={requestNew}>
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
            {prefs.entry === "tap"
              ? "Arrows move · 1–9 note, again to fill · Delete erase · P pause · ⌘Z undo"
              : "Arrows move · 1–9 fill · N notes · Delete erase · P pause · ⌘Z undo"}
          </p>
        </section>

        <aside className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto min-[720px]:w-[18.75rem] min-[720px]:shrink-0 min-[720px]:flex-none min-[720px]:self-stretch min-[720px]:[scrollbar-gutter:stable]">
          {advice ? (
            <StepPanel
              shown={advice}
              onStep={showAdviceStep}
              onFill={fillCell}
              onSelect={select}
              onClose={closeAdvice}
            />
          ) : (
            <div className="desk-status shrink-0 rounded-xl border border-border bg-card px-2.5 py-1 min-[720px]:px-3 min-[720px]:py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm" aria-live="polite">
                  {notice ?? status}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {game ? `${filled}/81` : "—"}
                </p>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden bg-muted min-[720px]:mt-2" aria-hidden="true">
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${(filled / 81) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs tracking-wide text-muted-foreground min-[720px]:mt-2">
                {game ? (
                  <>
                    <span className="uppercase">
                      {phaseText(game)}
                    </span>
                    {" · "}
                    {sourceLabel(game.source)}
                    {showMistakes ? (
                      <>
                        {" · "}
                        <span className={cn("tabular-nums", game.errors > 0 && "text-destructive")} aria-live="polite">
                          {errorsText(game.errors)}
                        </span>
                      </>
                    ) : null}
                  </>
                ) : (
                  "Dealing"
                )}
              </p>
            </div>
          )}

          {error && game ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="play-tools flex w-full min-w-0 items-stretch gap-1 max-[719px]:min-h-[9rem] max-[719px]:flex-1 max-[719px]:flex-row min-[720px]:flex-none min-[720px]:flex-col">
            <div className="digit-slot flex items-start justify-start max-[719px]:aspect-square max-[719px]:h-full max-[719px]:min-h-0 max-[719px]:max-w-[calc(100%-5.5rem)] min-[720px]:aspect-square min-[720px]:w-full min-[720px]:flex-none min-[720px]:items-center min-[720px]:justify-center">
              <div className="digit-pad grid grid-cols-3 grid-rows-3 gap-1" aria-label="Digits">
                {([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).map((digit) => {
                  const { remaining, exhausted, over } = keypadBadge(counts[digit] ?? 0);
                  const marked = selectedValue === 0 && (noteMask & (1 << digit)) !== 0;
                  const pressed =
                    !exhausted &&
                    (prefs.entry === "tap"
                      ? selectedValue === digit || marked
                      : game?.notesMode
                        ? marked
                        : selectedValue === digit);
                  return (
                    <Button
                      key={digit}
                      type="button"
                      variant={pressed ? "default" : "outline"}
                      className={cn(
                        "relative h-full w-full min-h-0 min-w-0 text-base font-semibold tabular-nums min-[720px]:text-lg",
                        exhausted &&
                          "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
                      )}
                      aria-label={
                        exhausted
                          ? `Enter ${digit}, all nine placed`
                          : highlighting
                            ? `Enter ${digit}, ${remaining} still missing`
                            : `Enter ${digit}`
                      }
                      aria-pressed={pressed}
                      disabled={lockedPlay || exhausted}
                      onClick={() => input(digit)}
                    >
                      {digit}
                      {highlighting ? (
                        <span
                          className={cn(
                            "absolute top-0.5 right-1 text-[0.6rem] font-medium tabular-nums opacity-70 min-[720px]:top-1 min-[720px]:right-1.5 min-[720px]:text-[0.65rem]",
                            over && "text-destructive opacity-100",
                          )}
                        >
                          {remaining}
                        </span>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div
              className={cn(
                "grid h-full min-h-0 w-full min-w-0 auto-rows-fr grid-cols-2 gap-1 max-[719px]:min-w-[5.5rem] max-[719px]:flex-1 min-[720px]:h-auto min-[720px]:flex-none min-[720px]:auto-rows-auto min-[720px]:grid-rows-1",
                DESK_COLUMNS[controls.length],
              )}
            >
              {controls.map((control) => {
                const live = controlState[control.id];
                const Icon = CONTROL_ICONS[control.id];
                const label = live.label ?? control.label;
                return (
                  <Button
                    key={control.id}
                    type="button"
                    size="icon"
                    variant={live.pressed ? "default" : "outline"}
                    className={cn(
                      "w-full px-0 max-[719px]:h-full min-[720px]:h-8",
                      live.badge !== undefined && "relative",
                    )}
                    aria-label={label}
                    title={label}
                    aria-pressed={live.pressed}
                    disabled={live.disabled}
                    onClick={live.onClick}
                  >
                    <Icon />
                    {live.badge !== undefined ? (
                      <span className="absolute top-0.5 right-0.5 text-[0.55rem] leading-none tabular-nums">{live.badge}</span>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <PrefsDialog
        open={prefsOpen}
        prefs={prefs}
        onEntry={setEntry}
        onHelper={setHelper}
        onResetRecords={resetRecords}
        onRestoreBackup={restoreBackup}
        sync={sync}
        onClose={closePrefs}
      />
      <HighScoresDialog
        open={scoresOpen}
        difficulty={game?.difficulty ?? chosen}
        highlightId={lastWin?.recordId ?? null}
        onClose={closeScores}
      />
      <PendingDialog
        pending={pending}
        started={Boolean(game?.started && !game.won)}
        difficulty={game?.difficulty}
        onDeal={deal}
        onConfirm={confirmPending}
        onCancel={cancelPending}
      />
    </div>
  );
}
