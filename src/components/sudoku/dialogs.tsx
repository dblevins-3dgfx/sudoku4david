"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRef, useState, type ReactNode } from "react";
import { backupFileName, exportBackup } from "@/lib/backup";
import { Button } from "@/components/ui/button";
import type { Preferences } from "@/lib/prefs";
import { parseSignInProof } from "@/lib/remote";
import { DIFFICULTIES, type Difficulty } from "@/lib/sudoku";
import { PrefSelect, type PrefOption } from "./pref-select";
import { ThemePicker } from "./theme-picker";
import type { useSync } from "./use-sync";

type Sync = ReturnType<typeof useSync>;
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
  onRestoreBackup,
  sync,
  onClose,
}: {
  open: boolean;
  prefs: Preferences;
  onEntry: (entry: Preferences["entry"]) => void;
  onShowConflicts: (show: boolean) => void;
  onResetRecords: () => void;
  onRestoreBackup: (text: string) => boolean;
  sync: Sync;
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
      <BackupRow onRestore={onRestoreBackup} />
      {sync.status !== "off" ? <SyncRow sync={sync} /> : null}
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

/**
 * Starts a download of `text` as a file. Browsers only save files the user
 * asked for, so this makes a temporary link to an in-memory "blob" (a block
 * of bytes the page owns, addressed by a blob: URL) and clicks it.
 */
function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Free the blob once the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Download" and "Load" for backup files. Loading asks first, because the
 * backup's game replaces the one in progress (high scores are merged, so
 * nothing is lost there).
 */
function BackupRow({ onRestore }: { onRestore: (text: string) => boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // A ref is a handle to the real page element, like a pointer that survives
  // re-renders; here it lets the Load button open the hidden file picker.
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div role="group" aria-label="Backup" className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Backup</p>
        <div className="grid min-w-[11rem] grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              downloadText(exportBackup(), backupFileName(new Date()));
              setMessage("Backup downloaded.");
            }}
          >
            Download
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={() => fileRef.current?.click()}>
            Load
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            // Clear the picker so choosing the same file again still fires onChange.
            event.target.value = "";
            if (!file) return;
            setMessage(null);
            setPending(await file.text());
          }}
        />
      </div>
      {pending !== null ? (
        <>
          <p className="mt-2 text-sm">
            Replace the current game with the one in the backup? High scores are combined, not replaced.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11"
              onClick={() => {
                const ok = onRestore(pending);
                setPending(null);
                setMessage(ok ? "Backup loaded." : "That file isn't a Sudoku backup.");
              }}
            >
              Load backup
            </Button>
          </div>
        </>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function syncSummary(sync: Sync): string {
  if (sync.status === "syncing") return "Syncing…";
  if (sync.status === "offline") return "Can't reach the server. It will try again.";
  if (sync.lastSynced) {
    const time = new Date(sync.lastSynced).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Synced at ${time}.`;
  }
  return "Waiting to sync.";
}

/**
 * Sign-in for sync. Signed out: an email box that sends a sign-in link.
 * Signed in: who, how sync is going, and Sign out.
 */
// The address a sign-in email just went to, kept in localStorage so the
// "Paste the link" step survives the player switching to Mail and back. iOS
// often reloads a home-screen app when it returns to the foreground, which
// would otherwise wipe React state and show the email field again.
// Emailed links expire after an hour, so an older entry is ignored.
const PENDING_SIGN_IN_KEY = "sudoku.signin-pending";
const PENDING_SIGN_IN_MS = 60 * 60 * 1000;

function loadPendingSignIn(): string | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_SIGN_IN_KEY) ?? "null");
    if (typeof raw?.email === "string" && typeof raw.at === "number" && Date.now() - raw.at < PENDING_SIGN_IN_MS) {
      return raw.email;
    }
  } catch {}
  return null;
}

function savePendingSignIn(email: string | null) {
  try {
    if (email) localStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify({ email, at: Date.now() }));
    else localStorage.removeItem(PENDING_SIGN_IN_KEY);
  } catch {}
}

const PASTE_HELP =
  "Check your email. In Safari you can just tap the link. In the home-screen app, press and hold the link in the email, choose Copy Link, and paste it here.";

function SyncRow({ sync }: { sync: Sync }) {
  const [address, setAddress] = useState("");
  // The address the last email went to. While set, the row asks for the code
  // from that email instead of an address.
  // useState(fn) runs fn once, when the row first appears (the dialog opens).
  const [sentTo, setSentToState] = useState<string | null>(loadPendingSignIn);
  const setSentTo = (email: string | null) => {
    setSentToState(email);
    savePendingSignIn(email);
  };
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // `async` lets the handler wait for the network with `await`; the
  // try/finally makes sure the buttons come back even if the request fails.
  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const to = address.trim();
      await sync.sendLink(to);
      setSentTo(to);
      setCode("");
    } catch {
      setMessage("Couldn't send the email. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sentTo) return;
    const proof = parseSignInProof(code);
    if (!proof) {
      setMessage("That isn't the link or code from the sign-in email.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await sync.verify(sentTo, proof);
      setSentTo(null);
    } catch {
      // Each link or code works once and expires after a while.
      setMessage("That didn't work. It may be used up or expired, so send a new email.");
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    "h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div role="group" aria-label="Sync" className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Sync</p>
        {sync.email ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 min-w-[11rem]"
            onClick={() => {
              void sync.signOut().catch(() => setMessage("Couldn't sign out. Try again."));
            }}
          >
            Sign out
          </Button>
        ) : null}
      </div>
      {sync.email ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          Signed in as {sync.email}. {syncSummary(sync)}
        </p>
      ) : sentTo ? (
        // Step 2: the link (or code) from the email. autoComplete="one-time-code"
        // lets iOS offer a code from Mail above the keyboard; autoCapitalize and
        // autoCorrect are off so a pasted link isn't altered.
        <>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim()) void verify();
            }}
          >
            <input
              type="text"
              required
              autoComplete="one-time-code"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Paste the link"
              aria-label="Sign-in link or code from the email"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={fieldClass}
            />
            <Button type="submit" variant="outline" className="h-10" disabled={busy}>
              Sign in
            </Button>
          </form>
          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground underline"
            onClick={() => {
              setSentTo(null);
              setMessage(null);
            }}
          >
            Use a different email
          </button>
        </>
      ) : (
        // Step 1: the address. A <form> lets the phone keyboard's Go/Enter
        // key submit. preventDefault stops the browser's own form submission,
        // which would reload the page.
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (address.trim()) void send();
          }}
        >
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="Your email"
            aria-label="Email for the sign-in link"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className={fieldClass}
          />
          <Button type="submit" variant="outline" className="h-10" disabled={busy}>
            Send link
          </Button>
        </form>
      )}
      {message ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : sync.email ? null : sentTo ? (
        <p className="mt-2 text-sm text-muted-foreground">{PASTE_HELP}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in to keep your game and high scores the same on all your devices.
        </p>
      )}
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
