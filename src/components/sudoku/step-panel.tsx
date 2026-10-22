"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Advice, Step } from "@/lib/steps";
import type { CellMark } from "@/lib/tint";

type Shown = { advice: Advice; index: number };

// The keys are the technique strings. A key needs quotes only when it isn't a
// valid identifier: "x-wing" has a hyphen, so it is quoted; swordfish is not.
// Both spellings make the same string key; this file leaves out quotes it
// doesn't need. Record<K, V> requires an entry for every technique, so a new
// one that is missing here fails to compile.
const TECHNIQUE_NAMES: Record<Step["technique"], string> = {
  "hidden-single": "Hidden single",
  "naked-single": "Naked single",
  pointing: "Pointing",
  claiming: "Claiming",
  "naked-pair": "Naked pair",
  "hidden-pair": "Hidden pair",
  "naked-triple": "Naked triple",
  "hidden-triple": "Hidden triple",
  "x-wing": "X-Wing",
  swordfish: "Swordfish",
  "xy-wing": "XY-Wing",
  "x-chain": "X-chain",
  "xy-chain": "XY-chain",
  "w-wing": "W-Wing",
  aic: "Chain (AIC)",
};

/** The board marks for the step on show, or null when there is nothing to point at. */
export function adviceMarks({ advice, index }: Shown): (CellMark | null)[][] | null {
  const marks: (CellMark | null)[][] = Array.from({ length: 9 }, () => Array<CellMark | null>(9).fill(null));
  if (advice.kind === "mistake") {
    marks[advice.cell.r][advice.cell.c] = "target";
    return marks;
  }
  if (advice.kind !== "steps") return null;
  const step = advice.steps[index];
  // Later assignments win, so the most specific mark is written last.
  for (const { r, c } of step.unit?.cells ?? []) marks[r][c] = "unit";
  for (const { r, c } of step.removals) marks[r][c] = "removal";
  for (const { r, c } of step.cells) marks[r][c] = "pattern";
  if (step.place) marks[step.place.r][step.place.c] = "target";
  return marks;
}

type StepPanelProps = {
  shown: Shown;
  onStep: (index: number) => void;
  onFill: (r: number, c: number) => void;
  onSelect: (r: number, c: number) => void;
  onClose: () => void;
};

/**
 * The explanation card that stands in for the status card while a step is
 * shown. The board highlights the cells it talks about.
 */
export function StepPanel({ shown, onStep, onFill, onSelect, onClose }: StepPanelProps) {
  const { advice, index } = shown;
  const step = advice.kind === "steps" ? advice.steps[index] : null;
  const count = advice.kind === "steps" ? advice.steps.length : 0;
  const heading =
    advice.kind === "mistake"
      ? "A wrong digit"
      : advice.kind === "stuck"
        ? "No step found"
        : advice.kind === "solved"
          ? "Solved"
          : step
            ? TECHNIQUE_NAMES[step.technique]
            : "";
  const text =
    advice.kind === "mistake" || advice.kind === "stuck"
      ? advice.text
      : advice.kind === "solved"
        ? "Every cell is filled."
        : (step?.text ?? "");

  return (
    // aria-live asks screen readers to read the new text out when it changes.
    <section
      className="desk-status flex max-h-[11rem] shrink-0 flex-col rounded-xl border border-border bg-card px-2.5 py-1.5 min-[720px]:max-h-none min-[720px]:px-3 min-[720px]:py-2"
      aria-label="Next step"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {heading}
          {count > 1 ? (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              step {index + 1} of {count}
            </span>
          ) : null}
        </p>
        <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Close explanation" onClick={onClose}>
          <X />
        </Button>
      </div>
      <p className="mt-1 min-h-0 overflow-y-auto text-sm leading-snug">{text}</p>
      {advice.kind === "steps" || advice.kind === "mistake" ? (
        <p className="mt-1 text-xs text-muted-foreground">Worked out from the digits on the board, not your notes.</p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
        {count > 1 ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={index === 0}
              onClick={() => onStep(index - 1)}
            >
              <ChevronLeft />
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={index === count - 1}
              onClick={() => onStep(index + 1)}
            >
              Next
              <ChevronRight />
            </Button>
          </>
        ) : null}
        {advice.kind === "mistake" ? (
          <Button type="button" size="sm" className="h-7" onClick={() => onSelect(advice.cell.r, advice.cell.c)}>
            Select it
          </Button>
        ) : null}
        {step?.place ? (
          <Button type="button" size="sm" className="h-7" onClick={() => onFill(step.place!.r, step.place!.c)}>
            Fill it in
          </Button>
        ) : null}
      </div>
    </section>
  );
}
