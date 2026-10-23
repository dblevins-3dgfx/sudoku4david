"use client";

import { controlStatus, keypadContext, visibleControls } from "@/lib/controls";
import { deadEndText } from "@/lib/deadends";
import { helperOn } from "@/lib/helpers";
import { statusText } from "@/lib/labels";
import { BoardInPlay, BoardLoading, ControlPad, DigitPad, GameDialogs, GameHeader, StatusBox } from "./game-parts";
import { StepPanel } from "./step-panel";
import { useGame } from "./use-game";

/** The whole game screen: header, board, status or explanation, keypad, controls, and dialogs. */
export function Game() {
  const desk = useGame();
  const { game, prefs, advice, deadEnds, error } = desk;

  const busy = desk.booting || desk.dealing;
  const status = (deadEnds && deadEndText(deadEnds)) ?? statusText(game, desk.conflictTotal, 81 - desk.filled);
  // Board highlighting also covers the keypad's "still missing" counts.
  const highlighting = helperOn(prefs, "highlighting");

  // The table of controls, with their order and labels, is CONTROLS in
  // src/lib/controls.ts; controlStatus supplies the parts that depend on the
  // current game, and this the function each one runs.
  const actions = {
    notes: desk.toggleNotes,
    fill: desk.fillAllNotes,
    erase: desk.eraseCell,
    undo: desk.undoMove,
    redo: desk.redoMove,
    hint: desk.giveHint,
    explain: advice ? desk.closeAdvice : desk.explain,
    check: desk.check,
    save: desk.saveCheck,
    restore: desk.restoreCheck,
    clear: desk.requestRestart,
  };

  return (
    <div className="desk-page mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col gap-1.5 px-1.5 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] min-[720px]:gap-3 min-[720px]:px-5 min-[720px]:py-3">
      <GameHeader desk={desk} busy={busy} />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden min-[720px]:flex-row min-[720px]:items-stretch min-[720px]:gap-3">
        <section className="flex min-h-0 min-w-0 flex-col max-[719px]:shrink-0 min-[720px]:flex-1" aria-busy={busy}>
          {game?.notesMode && prefs.entry === "button" && !busy && !game.paused && !game.won ? (
            <p className="mb-1 hidden shrink-0 text-center text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase min-[720px]:block">
              Notes
            </p>
          ) : null}

          {busy || !game ? <BoardLoading desk={desk} /> : <BoardInPlay desk={desk} game={game} highlighting={highlighting} />}

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
              onStep={desk.showAdviceStep}
              onFill={desk.fillCell}
              onSelect={desk.select}
              onExplainWithoutNotes={desk.explainWithoutNotes}
              onClose={desk.closeAdvice}
            />
          ) : (
            <StatusBox game={game} text={desk.notice ?? status} filled={desk.filled} />
          )}

          {error && game ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="play-tools flex w-full min-w-0 items-stretch gap-1 max-[719px]:min-h-[9rem] max-[719px]:flex-1 max-[719px]:flex-row min-[720px]:flex-none min-[720px]:flex-col">
            <DigitPad
              counts={desk.counts}
              ctx={keypadContext(game, prefs.entry, highlighting, busy)}
              onInput={desk.input}
            />
            <ControlPad
              controls={visibleControls(prefs)}
              status={controlStatus({ game, busy, explaining: advice !== null })}
              actions={actions}
            />
          </div>
        </aside>
      </div>

      <GameDialogs desk={desk} />
    </div>
  );
}
