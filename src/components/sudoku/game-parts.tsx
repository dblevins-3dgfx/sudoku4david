"use client";

// The pieces of the game screen, split out of Game so each stays short. Each
// is a React component: a function from its props to the markup to draw.
// The decisions about what is enabled, pressed, or labelled live in
// src/lib (controlStatus, headerStatus, keypadKey), where they are tested;
// these only lay the results out.

import {
  BookmarkCheck,
  BookmarkPlus,
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
import {
  deskColumns,
  headerStatus,
  keypadKey,
  type ControlId,
  type ControlSpec,
  type ControlStatus,
  type KeypadContext,
} from "@/lib/controls";
import { deadEndCells, hasDeadEnd } from "@/lib/deadends";
import { sourceLabel, type GameState } from "@/lib/game";
import { errorsText, phaseText, winDetail } from "@/lib/labels";
import { puzzleKey } from "@/lib/records";
import { formatTime, type Digit } from "@/lib/sudoku";
import { Board, BoardSkeleton } from "./board";
import { PendingDialog, PrefsDialog } from "./dialogs";
import { HighScoresDialog } from "./high-scores";
import { adviceMarks } from "./step-panel";
import type { useGame } from "./use-game";

/**
 * Everything useGame returns. ReturnType<typeof f> names the type of f's
 * result, so this follows the hook without restating its fields, much like
 * decltype(f()) in C++.
 */
export type Desk = ReturnType<typeof useGame>;

const CONTROL_ICONS: Record<ControlId, LucideIcon> = {
  notes: Pencil,
  fill: WandSparkles,
  erase: Eraser,
  undo: Undo2,
  redo: Redo2,
  hint: Lightbulb,
  explain: GraduationCap,
  check: SearchCheck,
  save: BookmarkPlus,
  restore: BookmarkCheck,
  clear: RotateCcw,
};

// From 720 pixels wide the controls sit in rows under the keypad (see
// deskColumns for how many to a row). Tailwind
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

const HEADER_BUTTON = "size-8 min-[400px]:size-9";

/** The title, the clock, and the Pause, Preferences, High scores, and New puzzle buttons. */
export function GameHeader({ desk, busy }: { desk: Desk; busy: boolean }) {
  const { game } = desk;
  const status = headerStatus(game, busy, desk.pending !== null);
  return (
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
          className={HEADER_BUTTON}
          onClick={desk.pause}
          disabled={status.pause.disabled}
          aria-label={status.pause.paused ? "Resume" : "Pause"}
          aria-pressed={status.pause.paused}
        >
          {status.pause.paused ? <Play /> : <Pause />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={HEADER_BUTTON}
          onClick={desk.openPrefs}
          disabled={status.prefs.disabled}
          aria-label="Preferences"
          title="Preferences"
          aria-pressed={desk.prefsOpen}
        >
          <Settings />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={HEADER_BUTTON}
          onClick={desk.openScores}
          disabled={status.scores.disabled}
          aria-label="High scores"
          title="High scores"
          aria-pressed={desk.scoresOpen}
        >
          <Trophy />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={HEADER_BUTTON}
          onClick={desk.requestNew}
          disabled={status.newPuzzle.disabled}
          aria-label="New puzzle"
          title="New puzzle"
        >
          <Plus />
        </Button>
      </div>
    </header>
  );
}

/** The gray board shown while a puzzle loads, with the loading or error line under it. */
export function BoardLoading({ desk }: { desk: Desk }) {
  const { error, chosen } = desk;
  return (
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
          <Button type="button" onClick={() => desk.deal(chosen)}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The live board, with the paused cover or the solved card over it. */
export function BoardInPlay({ desk, game, highlighting }: { desk: Desk; game: GameState; highlighting: boolean }) {
  const { advice, deadEnds } = desk;
  return (
    <div className="board-slot">
      <div className="board-frame relative">
        <div className="isolate h-full w-full" inert={game.paused || game.won ? true : undefined}>
          <Board
            game={game}
            conflicts={desk.conflicts}
            marks={advice ? adviceMarks(advice) : null}
            highlighting={highlighting}
            deadEnds={deadEnds && hasDeadEnd(deadEnds) ? deadEndCells(game.grid, deadEnds) : null}
            flash={desk.hintFlash}
            onFlashEnd={desk.clearHintFlash}
            onSelect={desk.select}
          />
        </div>
        {game.paused ? <PausedCover onResume={desk.pause} /> : null}
        {game.won ? <SolvedCard desk={desk} game={game} /> : null}
      </div>
    </div>
  );
}

function PausedCover({ onResume }: { onResume: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-card p-4 text-center">
      <div>
        <p className="font-heading text-3xl tracking-tight">Paused</p>
        <p className="mt-2 text-sm text-muted-foreground">The grid is covered.</p>
        <Button type="button" className="mt-4 h-9 px-4" onClick={onResume}>
          <Play />
          Resume
        </Button>
      </div>
    </div>
  );
}

function SolvedCard({ desk, game }: { desk: Desk; game: GameState }) {
  const { lastWin } = desk;
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-background via-background/85 to-background/25 p-3 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card px-4 py-4 text-center shadow-lg">
        <p className="font-heading text-3xl tracking-tight">Solved</p>
        <p className="mt-2 text-sm text-muted-foreground">{winDetail(game.hintsUsed, game.elapsedMs, game.difficulty)}</p>
        {/* Only for the win just played: after a reload, lastWin is empty. */}
        {lastWin && lastWin.puzzle === puzzleKey(game.puzzle) ? (
          <p className="mt-1 flex items-center justify-center gap-1 text-sm font-medium">
            {lastWin.placement ? (
              <>
                {lastWin.hinted ? <Lightbulb className="size-3.5" role="img" aria-label="Solved with hints" /> : null}
                {lastWin.placement}
              </>
            ) : (
              "Replayed puzzle, so it doesn't count toward records."
            )}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={desk.openScores}>
            <Trophy />
            High scores
          </Button>
          <Button type="button" variant="outline" className="h-9" onClick={desk.requestRestart}>
            <RotateCcw />
            Same puzzle
          </Button>
          <Button type="button" className="h-9" onClick={desk.requestNew}>
            New puzzle
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The status line, the progress bar, and the phase, source, and error count under it. */
export function StatusBox({ game, text, filled }: { game: GameState | null; text: string; filled: number }) {
  const showMistakes = game?.showMistakes ?? true;
  return (
    <div className="desk-status shrink-0 rounded-xl border border-border bg-card px-2.5 py-1 min-[720px]:px-3 min-[720px]:py-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm" aria-live="polite">
          {text}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">{game ? `${filled}/81` : "—"}</p>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden bg-muted min-[720px]:mt-2" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(filled / 81) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs tracking-wide text-muted-foreground min-[720px]:mt-2">
        {game ? (
          <>
            <span className="uppercase">{phaseText(game)}</span>
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
  );
}

/** The 3×3 digit keypad. */
export function DigitPad({
  counts,
  ctx,
  onInput,
}: {
  counts: readonly number[];
  ctx: KeypadContext;
  onInput: (digit: Digit) => void;
}) {
  return (
    <div className="digit-slot flex items-start justify-start max-[719px]:aspect-square max-[719px]:h-full max-[719px]:min-h-0 max-[719px]:max-w-[calc(100%-5.5rem)] min-[720px]:aspect-square min-[720px]:w-full min-[720px]:flex-none min-[720px]:items-center min-[720px]:justify-center">
      <div className="digit-pad grid grid-cols-3 grid-rows-3 gap-1" aria-label="Digits">
        {([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).map((digit) => {
          const key = keypadKey(digit, counts[digit] ?? 0, ctx);
          return (
            <Button
              key={digit}
              type="button"
              variant={key.pressed ? "default" : "outline"}
              className={cn(
                "relative h-full w-full min-h-0 min-w-0 text-base font-semibold tabular-nums min-[720px]:text-lg",
                key.exhausted && "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
              )}
              aria-label={key.label}
              aria-pressed={key.pressed}
              disabled={key.disabled}
              onClick={() => onInput(digit)}
            >
              {digit}
              {key.count !== null ? (
                <span
                  className={cn(
                    "absolute top-0.5 right-1 text-[0.6rem] font-medium tabular-nums opacity-70 min-[720px]:top-1 min-[720px]:right-1.5 min-[720px]:text-[0.65rem]",
                    key.over && "text-destructive opacity-100",
                  )}
                >
                  {key.count}
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** The icon controls beside or under the keypad. */
export function ControlPad({
  controls,
  status,
  actions,
}: {
  controls: readonly ControlSpec[];
  status: Record<ControlId, ControlStatus>;
  actions: Record<ControlId, () => void>;
}) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 w-full min-w-0 auto-rows-fr grid-cols-2 gap-1 max-[719px]:min-w-[5.5rem] max-[719px]:flex-1 min-[720px]:h-auto min-[720px]:flex-none min-[720px]:auto-rows-auto",
        DESK_COLUMNS[deskColumns(controls.length)],
      )}
    >
      {controls.map((control) => {
        const live = status[control.id];
        const Icon = CONTROL_ICONS[control.id];
        const label = live.label ?? control.label;
        return (
          <Button
            key={control.id}
            type="button"
            size="icon"
            variant={live.pressed ? "default" : "outline"}
            className={cn("w-full px-0 max-[719px]:h-full min-[720px]:h-8", live.badge !== undefined && "relative")}
            aria-label={label}
            title={label}
            aria-pressed={live.pressed}
            disabled={live.disabled}
            onClick={actions[control.id]}
          >
            <Icon />
            {live.badge !== undefined ? (
              <span className="absolute top-0.5 right-0.5 text-[0.55rem] leading-none tabular-nums">{live.badge}</span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}

/** The Preferences, High scores, and confirmation dialogs; each draws nothing while closed. */
export function GameDialogs({ desk }: { desk: Desk }) {
  const { game, prefs, lastWin } = desk;
  return (
    <>
      <PrefsDialog
        open={desk.prefsOpen}
        prefs={prefs}
        onEntry={desk.setEntry}
        onFillStyle={desk.setFillStyle}
        onHelper={desk.setHelper}
        onResetRecords={desk.resetRecords}
        onRestoreBackup={desk.restoreBackup}
        sync={desk.sync}
        onClose={desk.closePrefs}
      />
      <HighScoresDialog
        open={desk.scoresOpen}
        difficulty={game?.difficulty ?? desk.chosen}
        highlightId={lastWin?.recordId ?? null}
        onClose={desk.closeScores}
      />
      <PendingDialog
        pending={desk.pending}
        started={Boolean(game?.started && !game.won)}
        difficulty={game?.difficulty}
        onDeal={desk.deal}
        onConfirm={desk.confirmPending}
        onCancel={desk.cancelPending}
      />
    </>
  );
}
