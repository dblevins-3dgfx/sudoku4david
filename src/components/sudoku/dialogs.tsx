"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Preferences } from "@/lib/prefs";
import { DIFFICULTIES, type Difficulty } from "@/lib/sudoku";
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

export function PrefsDialog({
  open,
  prefs,
  onEntry,
  onShowConflicts,
  onClose,
}: {
  open: boolean;
  prefs: Preferences;
  onEntry: (entry: Preferences["entry"]) => void;
  onShowConflicts: (show: boolean) => void;
  onClose: () => void;
}) {
  return (
    <DeskDialog open={open} onClose={onClose}>
      <Dialog.Title className="font-heading text-2xl tracking-tight">Preferences</Dialog.Title>
      <div role="group" aria-label="How digits are entered" className="mt-4 grid gap-2">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Digits</p>
        <Button
          type="button"
          variant={prefs.entry === "button" ? "default" : "outline"}
          className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal"
          aria-pressed={prefs.entry === "button"}
          onClick={() => onEntry("button")}
        >
          <span className="font-medium">Notes button</span>
          <span className="text-xs font-normal opacity-80">
            The pencil switches the keypad between marks and numbers.
          </span>
        </Button>
        <Button
          type="button"
          variant={prefs.entry === "tap" ? "default" : "outline"}
          className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal"
          aria-pressed={prefs.entry === "tap"}
          onClick={() => onEntry("tap")}
        >
          <span className="font-medium">One tap, two taps</span>
          <span className="text-xs font-normal opacity-80">
            One tap marks the cell. A second tap writes the digit.
          </span>
        </Button>
      </div>
      <div role="group" aria-label="Conflicts" className="mt-4">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Conflicts</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={prefs.showConflicts ? "default" : "outline"}
            className="h-11"
            aria-pressed={prefs.showConflicts}
            onClick={() => onShowConflicts(true)}
          >
            Shown
          </Button>
          <Button
            type="button"
            variant={prefs.showConflicts ? "outline" : "default"}
            className="h-11"
            aria-pressed={!prefs.showConflicts}
            onClick={() => onShowConflicts(false)}
          >
            Hidden
          </Button>
        </div>
      </div>
      <ThemePicker />
      <Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={onClose}>
        Done
      </Button>
    </DeskDialog>
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
