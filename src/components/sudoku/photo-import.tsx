"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Delete } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pendingCopy } from "@/lib/labels";
import { checkGivens, editKey, setGiven } from "@/lib/own-puzzle";
import { conflictGrid, DIFFICULTIES, emptyGrid, type Cell, type Difficulty, type Grid } from "@/lib/sudoku";
import { cn } from "@/lib/utils";
import { DeskDialog } from "./dialogs";

/** What reading the photo gave: the digits and which were hard to read, or a reason it failed. */
type Read =
  | { kind: "reading" }
  | { kind: "failed"; message: string }
  | { kind: "read"; givens: Grid; unsure: boolean[][] };

/**
 * Decodes the chosen photo and reads the puzzle from it.
 *
 * createImageBitmap is the browser's image decoder (JPEG, PNG, HEIC where
 * supported); `imageOrientation: "from-image"` applies the rotation a phone
 * camera records in the file's EXIF data, so a portrait shot is upright.
 * The bitmap is drawn, scaled down, onto an off-screen <canvas>, whose
 * getImageData hands back the raw RGBA bytes.
 *
 * The reader and its digit templates (about 60 KB) are fetched with a dynamic
 * import(): the bundler puts them in a separate file that the browser loads
 * only the first time someone reads a photo, much like dlopen() on demand
 * instead of linking them into the main program.
 */
async function readPhotoFile(file: File): Promise<Read> {
  const photo = await import("@/lib/photo");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { kind: "failed", message: "Couldn't open that file as a picture." };
  }
  const { width, height } = photo.fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { kind: "failed", message: "Couldn't open that file as a picture." };
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const reading = photo.readPuzzlePhoto(photo.toGray(context.getImageData(0, 0, width, height).data, width, height));
  if (!reading) {
    return {
      kind: "failed",
      message: "Couldn't find a Sudoku grid in that photo. Try again with the whole grid in view, as straight on as you can.",
    };
  }
  return {
    kind: "read",
    givens: reading.cells.map((row) => row.map((cell) => cell.digit)),
    unsure: reading.cells.map((row) => row.map((cell) => !cell.sure)),
  };
}

/**
 * The dialog that checks a puzzle read from a photo. The player can correct
 * any cell, choose the difficulty it counts under in high scores, and play it
 * once its givens have exactly one solution.
 */
export function PhotoDialog({
  open,
  file,
  difficulty,
  onPhoto,
  onPlay,
  onCancel,
}: {
  open: boolean;
  file: File | null;
  difficulty: Difficulty;
  onPhoto: (file: File) => void;
  onPlay: (puzzle: Grid, solution: Grid, difficulty: Difficulty) => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <DeskDialog open={open} onClose={onCancel}>
      <Dialog.Title render={<p />} className="text-base leading-6">
        {pendingCopy({ kind: "photo" }, false)}
      </Dialog.Title>
      {/* `key` makes React build a fresh PhotoCheck, with fresh state, for each new photo. */}
      {file ? (
        <PhotoCheck
          key={`${file.name}-${file.lastModified}-${file.size}`}
          file={file}
          initialDifficulty={difficulty}
          onAnother={() => fileRef.current?.click()}
          onPlay={onPlay}
          onCancel={onCancel}
        />
      ) : null}
      <PhotoInput inputRef={fileRef} onPhoto={onPhoto} />
    </DeskDialog>
  );
}

/**
 * The hidden file picker. On a phone, `accept="image/*"` offers the camera as
 * well as the photo library; on a computer it opens the file chooser. A page
 * can only open it from a click the player made (a browser rule against pop-up
 * abuse), so buttons call .click() on it from their own click handler.
 */
export function PhotoInput({
  inputRef,
  onPhoto,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPhoto: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        // Clear the picker so choosing the same file again still fires onChange.
        event.target.value = "";
        if (file) onPhoto(file);
      }}
    />
  );
}

function PhotoCheck({
  file,
  initialDifficulty,
  onAnother,
  onPlay,
  onCancel,
}: {
  file: File;
  initialDifficulty: Difficulty;
  onAnother: () => void;
  onPlay: (puzzle: Grid, solution: Grid, difficulty: Difficulty) => void;
  onCancel: () => void;
}) {
  const [read, setRead] = useState<Read>({ kind: "reading" });
  const [givens, setGivens] = useState<Grid>(emptyGrid);
  const [difficulty, setDifficulty] = useState(initialDifficulty);

  // An effect runs after React has drawn the dialog, so "Reading the photo…"
  // shows while the work happens. `live` drops a result that arrives after
  // the dialog has closed or moved on to another photo.
  useEffect(() => {
    let live = true;
    readPhotoFile(file).then(
      (result) => {
        if (!live) return;
        setRead(result);
        if (result.kind === "read") setGivens(result.givens);
      },
      () => live && setRead({ kind: "failed", message: "Couldn't read that photo." }),
    );
    return () => {
      live = false;
    };
  }, [file]);

  // useMemo keeps the check (a solver run) until the givens change.
  const check = useMemo(() => checkGivens(givens), [givens]);

  const footer = (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Button type="button" variant="outline" className="h-11" onClick={onAnother}>
        Another photo
      </Button>
      <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
        Keep playing
      </Button>
    </div>
  );

  if (read.kind === "reading") {
    return (
      <p className="mt-3 text-sm text-muted-foreground" role="status">
        Reading the photo…
      </p>
    );
  }
  if (read.kind === "failed") {
    return (
      <>
        <p className="mt-3 text-sm" role="alert">
          {read.message}
        </p>
        {footer}
      </>
    );
  }

  return (
    <>
      <p className="mt-1 text-xs text-muted-foreground">
        Tap a cell to fix it. Cells with a dotted outline were hard to read.
      </p>
      <GivensEditor givens={givens} unsure={read.unsure} onChange={setGivens} />
      <p className={cn("mt-2 text-sm", !check.ok && "text-destructive")} role="status">
        {check.message}
      </p>
      <div role="group" aria-label="Difficulty" className="mt-3">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Counts as</p>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {DIFFICULTIES.map((level) => (
            <Button
              key={level.id}
              type="button"
              variant={difficulty === level.id ? "default" : "outline"}
              className="h-9"
              aria-pressed={difficulty === level.id}
              onClick={() => setDifficulty(level.id)}
            >
              {level.label}
            </Button>
          ))}
        </div>
      </div>
      <Button
        type="button"
        className="mt-3 h-11 w-full"
        disabled={!check.ok}
        onClick={() => check.ok && onPlay(givens, check.solution, difficulty)}
      >
        Play this puzzle
      </Button>
      {footer}
    </>
  );
}

/** A small 9 by 9 grid of the givens, with a keypad, for correcting the reading. */
function GivensEditor({
  givens,
  unsure,
  onChange,
}: {
  givens: Grid;
  unsure: boolean[][];
  onChange: (givens: Grid) => void;
}) {
  const [selected, setSelected] = useState({ r: 0, c: 0 });
  const conflicts = conflictGrid(givens);
  const write = (digit: Cell) => onChange(setGiven(givens, selected.r, selected.c, digit));

  return (
    <div className="mt-2">
      <div
        role="group"
        aria-label="Digits read from the photo"
        tabIndex={0}
        className="mx-auto grid aspect-square w-full max-w-[18rem] grid-cols-9 border-2 border-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(event) => {
          const action = editKey(event.key);
          if (!action) return;
          event.preventDefault();
          if (action.kind === "digit") write(action.digit);
          else setSelected(({ r, c }) => ({ r: (r + action.dr + 9) % 9, c: (c + action.dc + 9) % 9 }));
        }}
      >
        {givens.map((row, r) =>
          row.map((value, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              tabIndex={-1}
              aria-label={`Row ${r + 1}, column ${c + 1}: ${value || "empty"}${unsure[r]![c] ? ", hard to read" : ""}`}
              aria-current={selected.r === r && selected.c === c ? "true" : undefined}
              onClick={() => setSelected({ r, c })}
              className={cn(
                "flex aspect-square items-center justify-center border-border text-base font-medium tabular-nums",
                c % 3 === 2 && c < 8 ? "border-r-2 border-r-foreground" : c < 8 && "border-r",
                r % 3 === 2 && r < 8 ? "border-b-2 border-b-foreground" : r < 8 && "border-b",
                conflicts[r]![c] && "bg-destructive/20 text-destructive",
                unsure[r]![c] && "outline-2 -outline-offset-4 outline-dotted outline-destructive",
                selected.r === r && selected.c === c && "bg-primary/25",
              )}
            >
              {value || ""}
            </button>
          )),
        )}
      </div>
      <div className="mx-auto mt-2 grid max-w-[18rem] grid-cols-10 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Button key={digit} type="button" variant="outline" className="h-9 px-0" onClick={() => write(digit as Cell)}>
            {digit}
          </Button>
        ))}
        <Button type="button" variant="outline" className="h-9 px-0" aria-label="Clear cell" onClick={() => write(0)}>
          <Delete className="size-4" />
        </Button>
      </div>
    </div>
  );
}
