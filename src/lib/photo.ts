// Reads the givens of a printed Sudoku from a photo, entirely on this device.
//
// Everything here works on a plain grayscale bitmap (one byte per pixel, row
// by row), so it runs in the unit tests as well as in the browser. Turning the
// chosen photo file into that bitmap needs the browser's image decoder and a
// <canvas>; that small step lives in src/components/sudoku/photo-import.tsx.
//
// The steps:
//   1. Mark dark pixels against their neighbourhood (adaptive threshold), so
//      uneven light and tinted cells don't matter.
//   2. Find the grid: the large connected blob of ink whose interior lines
//      fall where a 9 by 9 grid's should. Its four outermost points are the
//      grid's corners.
//   3. Undo the camera's tilt with a perspective transform (a homography)
//      that maps those corners onto a square, giving a straight-on view.
//   4. In each cell, take the largest ink blob that sits in the middle of the
//      cell. No blob means an empty cell.
//   5. Shrink that blob to a 16 by 16 picture and compare it with digits
//      rendered from common printed fonts (src/lib/digit-templates.ts). The
//      closest one wins. When the runner-up is a different digit and nearly as
//      close, the cell is marked as unsure so the player can check it.
//
// The player always sees the result and can correct it before playing, so the
// reader aims to be right on clean printed puzzles rather than perfect.

import type { Cell, Digit } from "./sudoku";
import { DIGIT_TEMPLATES, TEMPLATE_SIZE } from "./digit-templates";

/** A grayscale bitmap: data[y * width + x], 0 black to 255 white. */
export type GrayImage = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

/** A 0/1 mask the same shape as a GrayImage; 1 is ink. */
export type Mask = { width: number; height: number; data: Uint8Array };

export type Point = { x: number; y: number };

export type ReadCell = { digit: Cell; sure: boolean };

export type PhotoReading = {
  /** 9 rows of 9 cells. */
  cells: ReadCell[][];
  /** The grid's corners in the photo: top-left, top-right, bottom-right, bottom-left. */
  corners: [Point, Point, Point, Point];
};

/** The longest side, in pixels, the photo is scaled down to before reading. */
export const READ_SIZE = 1000;

/** Pixels per cell in the straightened grid. */
const CELL = 36;

/** Scale (width, height) down so neither side exceeds `max`; never up. */
export function fitSize(width: number, height: number, max = READ_SIZE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Converts the RGBA bytes a canvas hands back (4 per pixel, as in
 * CanvasRenderingContext2D.getImageData) to gray, weighting the channels by
 * how bright they look (the Rec. 601 luma weights).
 */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = (rgba[p]! * 299 + rgba[p + 1]! * 587 + rgba[p + 2]! * 114) / 1000;
  }
  return { width, height, data };
}

/**
 * Adaptive threshold (Bradley and Roth): a pixel is ink when it is darker
 * than `ratio` times the mean of the square of side 2 * radius + 1 around it.
 * The mean comes from a summed-area table, so each pixel costs four lookups.
 */
export function threshold(image: GrayImage, radius: number, ratio = 0.8): Mask {
  const { width, height, data } = image;
  const stride = width + 1;
  // Float64 because a large photo's sums overflow 32 bits.
  const sums = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += data[y * width + x]!;
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1]! + row;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const total = sums[y1 * stride + x1]! - sums[y0 * stride + x1]! - sums[y1 * stride + x0]! + sums[y0 * stride + x0]!;
      const mean = total / ((x1 - x0) * (y1 - y0));
      out[y * width + x] = data[y * width + x]! < mean * ratio ? 1 : 0;
    }
  }
  return { width, height, data: out };
}

export type Blob = {
  /** Indexes (y * width + x) of the blob's pixels. */
  pixels: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * Splits the ink inside the rectangle [x0, x1) by [y0, y1) into blobs of
 * pixels that touch, including diagonally (8-connected). An explicit stack
 * keeps a large blob from overflowing the call stack.
 */
export function findBlobs(mask: Mask, x0 = 0, y0 = 0, x1 = mask.width, y1 = mask.height): Blob[] {
  const { width, data } = mask;
  const seen = new Uint8Array(data.length);
  const blobs: Blob[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const start = y * width + x;
      if (data[start] && !seen[start]) blobs.push(floodFill(mask, seen, start, { x0, y0, x1, y1 }));
    }
  }
  return blobs;
}

/** Collects the blob containing pixel `start`, marking its pixels in `seen`. */
function floodFill(
  mask: Mask,
  seen: Uint8Array,
  start: number,
  box: { x0: number; y0: number; x1: number; y1: number },
): Blob {
  const { width, data } = mask;
  const blob: Blob = { pixels: [], minX: start % width, minY: Math.floor(start / width), maxX: 0, maxY: 0 };
  blob.maxX = blob.minX;
  blob.maxY = blob.minY;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    blob.pixels.push(p);
    const px = p % width;
    const py = (p - px) / width;
    blob.minX = Math.min(blob.minX, px);
    blob.maxX = Math.max(blob.maxX, px);
    blob.minY = Math.min(blob.minY, py);
    blob.maxY = Math.max(blob.maxY, py);
    for (let k = 0; k < 9; k++) {
      const nx = px + (k % 3) - 1;
      const ny = py + Math.floor(k / 3) - 1;
      if (nx < box.x0 || nx >= box.x1 || ny < box.y0 || ny >= box.y1) continue;
      const q = ny * width + nx;
      if (data[q] && !seen[q]) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  return blob;
}

/**
 * The four outermost points of a blob: the corners of the quadrilateral it
 * fills, as long as it is turned less than 45 degrees. Top-left has the least
 * x + y, bottom-right the most; top-right has the most x - y, bottom-left the
 * least.
 */
export function blobCorners(blob: Blob, width: number): [Point, Point, Point, Point] {
  let tl = blob.pixels[0]!;
  let tr = tl;
  let br = tl;
  let bl = tl;
  const sum = (p: number) => (p % width) + Math.floor(p / width);
  const diff = (p: number) => (p % width) - Math.floor(p / width);
  for (const p of blob.pixels) {
    if (sum(p) < sum(tl)) tl = p;
    if (sum(p) > sum(br)) br = p;
    if (diff(p) > diff(tr)) tr = p;
    if (diff(p) < diff(bl)) bl = p;
  }
  const point = (p: number): Point => ({ x: p % width, y: Math.floor(p / width) });
  return [point(tl), point(tr), point(br), point(bl)];
}

/** Solves A x = b for a small dense system by Gaussian elimination with partial pivoting. */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let k = col; k <= n; k++) m[r]![k]! -= f * m[col]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/**
 * The 3 by 3 perspective transform (homography, with its last entry fixed at
 * 1) that takes each `from` point to the matching `to` point. Returns the
 * eight free entries in row order, or null if the points are degenerate.
 */
export function homography(from: readonly Point[], to: readonly Point[]): number[] | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]!;
    const { x: u, y: v } = to[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return solveLinear(a, b);
}

export function applyHomography(h: readonly number[], p: Point): Point {
  const w = h[6]! * p.x + h[7]! * p.y + 1;
  return { x: (h[0]! * p.x + h[1]! * p.y + h[2]!) / w, y: (h[3]! * p.x + h[4]! * p.y + h[5]!) / w };
}

/**
 * A straight-on square view of the quadrilateral `corners` (clockwise from
 * top-left), `size` pixels a side. Each output pixel is mapped back into the
 * photo and read with bilinear interpolation.
 */
export function warpSquare(image: GrayImage, corners: readonly Point[], size: number): GrayImage {
  const square = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  const h = homography(square, corners);
  const out = new Uint8Array(size * size);
  if (!h) return { width: size, height: size, data: out.fill(255) };
  const { width, height, data } = image;
  const at = (x: number, y: number) =>
    data[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = applyHomography(h, { x: x + 0.5, y: y + 0.5 });
      const fx = p.x - 0.5;
      const fy = p.y - 0.5;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const top = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
      const bottom = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      out[y * size + x] = Math.round(top * (1 - ty) + bottom * ty);
    }
  }
  return { width: size, height: size, data: out };
}

/**
 * How much a straightened square looks like a Sudoku grid: the share of the
 * eight inner grid lines (four per direction checked along each line) that
 * are inked, from 0 to 1.
 */
export function gridLineScore(mask: Mask): number {
  const size = mask.width;
  const cell = size / 9;
  let hits = 0;
  let checks = 0;
  for (let i = 1; i < 9; i++) {
    const line = Math.round(i * cell);
    for (let j = 0; j < 9; j++) {
      const along = Math.round((j + 0.5) * cell);
      checks += 2;
      // Allow the line to sit a few pixels off where it should be.
      const near = Math.max(2, Math.round(cell * 0.12));
      let vertical = false;
      let horizontal = false;
      for (let d = -near; d <= near; d++) {
        const k = Math.min(size - 1, Math.max(0, line + d));
        if (mask.data[along * size + k]) vertical = true;
        if (mask.data[k * size + along]) horizontal = true;
      }
      if (vertical) hits++;
      if (horizontal) hits++;
    }
  }
  return hits / checks;
}

/** Below this share of inner lines found, a blob isn't taken for the grid. */
const MIN_GRID_SCORE = 0.8;

/**
 * Finds the Sudoku grid in a photo and returns its corners, or null. The
 * candidates are the largest blobs of ink; the first whose straightened view
 * has inked lines where a 9 by 9 grid's are is the grid.
 */
export function findGrid(image: GrayImage, mask?: Mask): [Point, Point, Point, Point] | null {
  const ink = mask ?? threshold(image, Math.max(8, Math.round(Math.min(image.width, image.height) / 30)));
  const minSide = Math.min(image.width, image.height) * 0.25;
  const candidates = findBlobs(ink)
    .filter((b) => b.maxX - b.minX >= minSide && b.maxY - b.minY >= minSide)
    .sort((a, b) => (b.maxX - b.minX) * (b.maxY - b.minY) - (a.maxX - a.minX) * (a.maxY - a.minY))
    .slice(0, 6);
  let best: { corners: [Point, Point, Point, Point]; score: number } | null = null;
  for (const blob of candidates) {
    const corners = blobCorners(blob, image.width);
    const view = warpSquare(image, corners, CELL * 9);
    const score = gridLineScore(threshold(view, Math.round(CELL / 3)));
    if (score >= MIN_GRID_SCORE && (!best || score > best.score)) best = { corners, score };
  }
  return best?.corners ?? null;
}

/**
 * The ink blob that is the cell's digit, or null for an empty cell. `x0, y0`
 * is the cell's top-left in the straightened grid's mask. Only the middle of
 * the cell is searched, so the grid lines are left out; the digit must be at
 * least a third of the cell tall and must not be a stray bit of line.
 */
export function cellGlyph(mask: Mask, x0: number, y0: number, cell: number): Blob | null {
  const margin = Math.round(cell * 0.12);
  const inner = cell - 2 * margin;
  const blobs = findBlobs(mask, x0 + margin, y0 + margin, x0 + cell - margin, y0 + cell - margin);
  let best: Blob | null = null;
  for (const blob of blobs) {
    const w = blob.maxX - blob.minX + 1;
    const h = blob.maxY - blob.minY + 1;
    if (h < cell * 0.33) continue;
    // A grid line that slipped inside the margin is long and thin.
    if (w >= inner * 0.9 || h >= inner * 0.98) continue;
    const cx = (blob.minX + blob.maxX) / 2 - x0;
    const cy = (blob.minY + blob.maxY) / 2 - y0;
    if (Math.abs(cx - cell / 2) > cell * 0.25 || Math.abs(cy - cell / 2) > cell * 0.25) continue;
    if (!best || blob.pixels.length > best.pixels.length) best = blob;
  }
  return best;
}

/**
 * Shrinks a glyph to TEMPLATE_SIZE squared values from 0 to 1, the share of
 * each output pixel that is ink. The glyph is scaled to fill the height (or
 * the width, if wider than tall) and centered, keeping its proportions, so a
 * narrow 1 stays narrow. Each output pixel averages a 4 by 4 grid of samples.
 */
export function normalizeGlyph(bits: ArrayLike<number>, width: number, height: number): Float32Array {
  const n = TEMPLATE_SIZE;
  const out = new Float32Array(n * n);
  const scale = n / Math.max(width, height);
  const offX = (n - width * scale) / 2;
  const offY = (n - height * scale) / 2;
  const sub = 4;
  const inked = (gx: number, gy: number) => gx >= 0 && gy >= 0 && gx < width && gy < height && bits[gy * width + gx];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let ink = 0;
      for (let k = 0; k < sub * sub; k++) {
        const gx = Math.floor((x + ((k % sub) + 0.5) / sub - offX) / scale);
        const gy = Math.floor((y + (Math.floor(k / sub) + 0.5) / sub - offY) / scale);
        if (inked(gx, gy)) ink++;
      }
      out[y * n + x] = ink / (sub * sub);
    }
  }
  return out;
}

/** The glyph of a blob as 0/1 bits cropped to its bounding box. */
function blobBits(blob: Blob, imageWidth: number): { bits: Uint8Array; width: number; height: number } {
  const width = blob.maxX - blob.minX + 1;
  const height = blob.maxY - blob.minY + 1;
  const bits = new Uint8Array(width * height);
  for (const p of blob.pixels) {
    const x = (p % imageWidth) - blob.minX;
    const y = Math.floor(p / imageWidth) - blob.minY;
    bits[y * width + x] = 1;
  }
  return { bits, width, height };
}

/** Weight of the difference in width-to-height ratio against the picture difference. */
const ASPECT_WEIGHT = 0.15;

/**
 * Two candidate digits closer than this (relative to the best distance) make
 * the reading unsure.
 */
const SURE_MARGIN = 1.25;

let decoded: { digit: Digit; aspect: number; pixels: Float32Array }[] | null = null;

/** The templates, unpacked from their hex strings once and kept. */
function templates() {
  if (!decoded) {
    decoded = DIGIT_TEMPLATES.map((t) => {
      const pixels = new Float32Array(t.pixels.length);
      for (let i = 0; i < t.pixels.length; i++) pixels[i] = parseInt(t.pixels[i]!, 16) / 15;
      return { digit: t.digit, aspect: t.aspect, pixels };
    });
  }
  return decoded;
}

/**
 * The digit a normalized glyph looks most like, comparing it with every
 * template (nearest neighbour). `sure` is false when the closest template of
 * any other digit is nearly as close.
 */
export function classifyGlyph(pixels: Float32Array, aspect: number): { digit: Digit; sure: boolean } {
  const best = new Map<Digit, number>();
  for (const t of templates()) {
    let d = 0;
    for (let i = 0; i < pixels.length; i++) {
      const e = pixels[i]! - t.pixels[i]!;
      d += e * e;
    }
    d = d / pixels.length + ASPECT_WEIGHT * (aspect - t.aspect) ** 2;
    if (d < (best.get(t.digit) ?? Infinity)) best.set(t.digit, d);
  }
  const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
  const [first, second] = ranked;
  return { digit: first![0], sure: !second || second[1] > first![1] * SURE_MARGIN };
}

/** Reads every cell of an already straightened grid, `cell` pixels a side. */
export function readCells(view: GrayImage, cell = CELL): ReadCell[][] {
  const mask = threshold(view, Math.round(cell / 3));
  const cells: ReadCell[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: ReadCell[] = [];
    for (let c = 0; c < 9; c++) {
      const blob = cellGlyph(mask, c * cell, r * cell, cell);
      if (!blob) {
        row.push({ digit: 0, sure: true });
        continue;
      }
      const { bits, width, height } = blobBits(blob, mask.width);
      row.push(classifyGlyph(normalizeGlyph(bits, width, height), width / height));
    }
    cells.push(row);
  }
  return cells;
}

/** Reads a printed Sudoku from a photo, or returns null if no grid is found. */
export function readPuzzlePhoto(image: GrayImage): PhotoReading | null {
  const corners = findGrid(image);
  if (!corners) return null;
  return { cells: readCells(warpSquare(image, corners, CELL * 9)), corners };
}
