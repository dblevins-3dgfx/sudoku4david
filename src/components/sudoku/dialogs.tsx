"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Preferences } from "@/lib/prefs";
import { DIFFICULTIES, type Difficulty } from "@/lib/sudoku";
import { PrefSelect, type PrefOption } from "./pref-select";
import { ThemePicker } from "./theme-picker";
import type { Pending } from "./use-game";

// Base UI moves focus into the dialog, keeps it there while open, and returns
// it to whatever had focus before (usually the button that opened it).
export function DeskDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-background/75" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-30 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card px-5 py-5 text-card-foreground shadow-lg outline-none">
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const ENTRY_OPTIONS: PrefOption<Preferences["entry"]>[] = [
  { value: "button", label: "Notes button", detail: "The pencil switches the keypad between marks and numbers." },
  { value: "tap", label: "One tap, two taps", detail: "One tap marks the cell. A second tap writes the digit." },
];

const CONFLICT_OPTIONS: PrefOption<"shown" | "hidden">[] = [
  { value: "shown", label: "Shown", detail: "Repeated digits are highlighted." },
  { value: "hidden", label: "Hidden", detail: "Check still finds repeats when you ask." },
];

export function PrefsDialog({
  open,
  prefs,
  onEntry,
  onShowConflicts,
  onResetRecords,
  onClose,
}: {
  open: boolean;
  prefs: Preferences;
  onEntry: (entry: Preferences["entry"]) => void;
  onShowConflicts: (show: boolean) => void;
  onResetRecords: () => void;
  onClose: () => void;
}) {
  return (
    <DeskDialog open={open} onClose={onClose}>
      <Dialog.Title className="font-heading text-2xl tracking-tight">Preferences</Dialog.Title>
      <PrefSelect
        label="Digits"
        value={prefs.entry}
        options={ENTRY_OPTIONS}
        onChange={onEntry}
      />
      <PrefSelect
        label="Conflicts"
        value={prefs.showConflicts ? "shown" : "hidden"}
        options={CONFLICT_OPTIONS}
        onChange={(choice) => onShowConflicts(choice === "shown")}
      />
      <ThemePicker />
      <RecordsReset onReset={onResetRecords} />
      <Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={onClose}>
        Done
      </Button>
    </DeskDialog>
  );
}

/**
 * "Reset records" with an inline confirmation step. The dialog's contents are
 * removed from the page when it closes, so this state starts fresh (at
 * "idle") every time Preferences opens.
 */
function RecordsReset({ onReset }: { onReset: () => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  return (
    <div role="group" aria-label="High scores" className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">High scores</p>
        <Button
          type="button"
          variant="outline"
          className="h-10 min-w-[11rem]"
          disabled={step !== "idle"}
          onClick={() => setStep("confirm")}
        >
          {step === "done" ? "Records cleared" : "Reset records"}
        </Button>
      </div>
      {step === "confirm" ? (
        <>
          <p className="mt-2 text-sm">Clear every high score? This can&apos;t be undone.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setStep("idle")}>
              Keep them
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => {
                onReset();
                setStep("done");
              }}
            >
              Reset records
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function pendingCopy(pending: Pending, started: boolean): string {
  if (pending.kind === "restart") {
    return "Clear every number you wrote? The given digits stay.";
  }
  if (started) return "Deal a new puzzle? This grid will be replaced.";
  return "Choose a difficulty.";
}

export function PendingDialog({
  pending,
  started,
  difficulty,
  onDeal,
  onConfirm,
  onCancel,
}: {
  pending: Pending | null;
  started: boolean;
  difficulty: Difficulty | undefined;
  onDeal: (difficulty: Difficulty) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DeskDialog open={pending !== null} onClose={onCancel}>
      {pending ? (
        <>
          <Dialog.Title render={<p />} className="text-base leading-6">
            {pendingCopy(pending, started)}
          </Dialog.Title>
          {pending.kind === "new" ? (
            <div role="group" aria-label="Difficulty" className="mt-4 grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((level) => (
                <Button
                  key={level.id}
                  type="button"
                  variant={difficulty === level.id ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={difficulty === level.id}
                  onClick={() => onDeal(level.id)}
                >
                  {level.label}
                </Button>
              ))}
            </div>
          ) : null}
          <div className={pending.kind === "new" ? "mt-3" : "mt-4 flex gap-2"}>
            {pending.kind === "restart" ? (
              <Button type="button" className="h-11 flex-1" onClick={onConfirm}>
                Clear entries
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={pending.kind === "new" ? "h-11 w-full" : "h-11 flex-1"}
              onClick={onCancel}
            >
              Keep playing
            </Button>
          </div>
        </>
      ) : null}
    </DeskDialog>
  );
}
