"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadRecords, topRecords, type Period, type ScoreRecord } from "@/lib/records";
import { DIFFICULTIES, formatTime, type Difficulty } from "@/lib/sudoku";
import { DeskDialog } from "./dialogs";

const PERIODS: readonly { id: Period; label: string; empty: string }[] = [
  { id: "week", label: "Weekly", empty: "No finished games this week yet." },
  { id: "month", label: "Monthly", empty: "No finished games this month yet." },
  { id: "all", label: "All time", empty: "No finished games yet." },
];

const HOW_MANY = 10;

// toLocaleDateString formats in the viewer's own language and time zone.
// `undefined` as the locale means "whatever the browser is set to".
function finishDate(record: ScoreRecord, withYear: boolean): string {
  return new Date(record.finishedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  });
}

function hintLabel(hints: number): string {
  return hints === 1 ? "1 hint" : `${hints} hints`;
}

/**
 * The High scores dialog. A React component is a function that returns a
 * description of the UI (the JSX markup below); React calls it again whenever
 * its props (arguments) or its state change and updates the page to match.
 */
export function HighScoresDialog({
  open,
  difficulty,
  highlightId,
  onClose,
}: {
  open: boolean;
  /** Difficulty shown first: the current game's, so its table is one click away. */
  difficulty: Difficulty;
  /** The record of the game just won, if any; its row is highlighted. */
  highlightId: string | null;
  onClose: () => void;
}) {
  // useState keeps a value across calls of this function, like a member
  // variable; calling the setter stores a new value and re-renders.
  const [period, setPeriod] = useState<Period>("week");
  const [chosen, setChosen] = useState<Difficulty | null>(null);
  const shown = chosen ?? difficulty;

  // Records are read from storage each time the dialog opens, so a game won
  // since the last look is included. useMemo caches the result until `open`
  // changes, so switching tabs does not re-read storage.
  const store = useMemo(() => (open ? loadRecords() : null), [open]);
  const rows = store ? topRecords(store, shown, period, new Date(), HOW_MANY) : [];
  const empty = PERIODS.find((p) => p.id === period)?.empty;

  const close = () => {
    setChosen(null);
    onClose();
  };

  return (
    <DeskDialog open={open} onClose={close}>
      <Dialog.Title className="font-heading text-2xl tracking-tight">High scores</Dialog.Title>
      <p className="mt-1 text-sm text-muted-foreground">Fastest first. Games solved with hints are marked.</p>

      <div role="group" aria-label="Period" className="mt-4 grid grid-cols-3 gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant={period === p.id ? "default" : "outline"}
            className="h-9"
            aria-pressed={period === p.id}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div role="group" aria-label="Difficulty" className="mt-2 grid grid-cols-3 gap-2">
        {DIFFICULTIES.map((level) => (
          <Button
            key={level.id}
            type="button"
            size="sm"
            variant={shown === level.id ? "default" : "outline"}
            aria-pressed={shown === level.id}
            onClick={() => setChosen(level.id)}
          >
            {level.label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="mt-4 divide-y divide-border" aria-label={`${PERIODS.find((p) => p.id === period)?.label} ${shown} scores`}>
          {rows.map((record, i) => (
            <li
              key={record.id}
              className={cn("flex items-center gap-3 py-2 text-sm", record.id === highlightId && "-mx-2 rounded-md bg-muted px-2")}
              aria-current={record.id === highlightId ? "true" : undefined}
            >
              <span className="w-6 text-right text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="font-medium tabular-nums">{formatTime(record.elapsedMs)}</span>
              {record.hintsUsed > 0 ? (
                <span
                  className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums"
                  title={`Solved with ${hintLabel(record.hintsUsed)}`}
                  aria-label={`with ${hintLabel(record.hintsUsed)}`}
                >
                  <Lightbulb className="size-3.5" aria-hidden="true" />
                  {record.hintsUsed}
                </span>
              ) : null}
              <span className="ml-auto text-muted-foreground">{finishDate(record, period === "all")}</span>
            </li>
          ))}
        </ol>
      )}

      <Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={close}>
        Done
      </Button>
    </DeskDialog>
  );
}
