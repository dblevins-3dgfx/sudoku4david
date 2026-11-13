import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { gunzipSync } from "node:zlib";
import { DIGIT_TEMPLATES, TEMPLATE_SIZE } from "./digit-templates";
import {
  applyHomography,
  cellGlyph,
  classifyGlyph,
  findGrid,
  fitSize,
  homography,
  normalizeGlyph,
  readPuzzlePhoto,
  threshold,
  toGray,
  type GrayImage,
  type Mask,
} from "./photo";

// The sample David photographed, as 81 characters in reading order (0 = empty).
const SAMPLE = "970000021052000470008207600000356000000198000001402900025000360430000087100000002";

// The fixtures are grayscale PGM files (a tiny header, then one byte per
// pixel), gzipped. Node can read both without extra packages; a JPEG would
// need a decoder, which is the browser's job in the app.
function loadFixture(name: string): GrayImage {
  const bytes = gunzipSync(readFileSync(new URL(`./fixtures/${name}.pgm.gz`, import.meta.url)));
  const [magic, width, height, max] = bytes.subarray(0, 32).toString("latin1").split(/\s+/);
  assert.equal(magic, "P5");
  assert.equal(max, "255");
  const w = Number(width);
  const h = Number(height);
  return { width: w, height: h, data: bytes.subarray(bytes.length - w * h) };
}

const digits = (reading: NonNullable<ReturnType<typeof readPuzzlePhoto>>) =>
  reading.cells.flat().map((cell) => cell.digit).join("");

describe("Setting up a puzzle from a photo: reading the grid", () => {
  it("reads every given of the sample puzzle, all of them sure", () => {
    const reading = readPuzzlePhoto(loadFixture("sample-puzzle"));
    assert.ok(reading);
    assert.equal(digits(reading), SAMPLE);
    assert.ok(reading.cells.flat().every((cell) => cell.sure));
  });

  it("reads the sample photographed at a tilt, in perspective, under uneven light", () => {
    const reading = readPuzzlePhoto(loadFixture("sample-puzzle-photo"));
    assert.ok(reading);
    assert.equal(digits(reading), SAMPLE);
    // The page sits rotated on a table: the grid's top-left corner is well
    // inside the frame and its top edge slopes down to the right.
    const [tl, tr, br, bl] = reading.corners;
    assert.ok(tl.x > 80 && tl.y > 20);
    assert.ok(tr.y > tl.y && br.x < tr.x && bl.x < tl.x);
  });

  it("finds no grid in a blank page or a single box", () => {
    const blank: GrayImage = { width: 200, height: 200, data: new Uint8Array(200 * 200).fill(240) };
    assert.equal(readPuzzlePhoto(blank), null);

    // A square outline with nothing inside is not a Sudoku grid.
    const box = new Uint8Array(200 * 200).fill(240);
    for (let i = 20; i < 180; i++) {
      for (let t = 0; t < 4; t++) {
        box[(20 + t) * 200 + i] = box[(176 + t) * 200 + i] = box[i * 200 + 20 + t] = box[i * 200 + 176 + t] = 0;
      }
    }
    assert.equal(findGrid({ width: 200, height: 200, data: box }), null);
  });
});

describe("Setting up a puzzle from a photo: the steps", () => {
  it("scales a photo down to the reading size, never up", () => {
    assert.deepEqual(fitSize(4000, 3000), { width: 1000, height: 750 });
    assert.deepEqual(fitSize(3000, 4000, 500), { width: 375, height: 500 });
    assert.deepEqual(fitSize(640, 480), { width: 640, height: 480 });
  });

  it("turns canvas RGBA into brightness", () => {
    const gray = toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]), 3, 1);
    assert.deepEqual([...gray.data], [255, 0, 76]);
  });

  it("marks ink against its neighbourhood, so shading and tinted cells are not ink", () => {
    const width = 60;
    const data = new Uint8Array(width * width);
    for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) data[y * width + x] = 120 + x * 2; // light from the right
    for (let x = 0; x < width; x++) data[30 * width + x] = 20 + x; // a dark line across
    const mask = threshold({ width, height: width, data }, 6);
    assert.equal(mask.data[30 * width + 5], 1);
    assert.equal(mask.data[30 * width + 55], 1);
    assert.equal(mask.data[10 * width + 5], 0);
    assert.equal(mask.data[10 * width + 55], 0);
  });

  it("maps four corners exactly with a perspective transform", () => {
    const from = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const to = [
      { x: 12, y: 30 },
      { x: 140, y: 18 },
      { x: 150, y: 160 },
      { x: 5, y: 120 },
    ];
    const h = homography(from, to);
    assert.ok(h);
    from.forEach((p, i) => {
      const q = applyHomography(h, p);
      assert.ok(Math.abs(q.x - to[i]!.x) < 1e-6 && Math.abs(q.y - to[i]!.y) < 1e-6);
    });
  });

  it("finds the digit in the middle of a cell and ignores grid lines at its edge", () => {
    const cell = 36;
    const mask: Mask = { width: cell, height: cell, data: new Uint8Array(cell * cell) };
    // A grid line that slipped inside the cell's margin, along its left side.
    for (let y = 0; y < cell; y++) mask.data[y * cell + 5] = 1;
    assert.equal(cellGlyph(mask, 0, 0, cell), null);
    // A digit-sized stroke in the middle.
    for (let y = 9; y < 27; y++) for (let x = 16; x < 20; x++) mask.data[y * cell + x] = 1;
    const glyph = cellGlyph(mask, 0, 0, cell);
    assert.ok(glyph);
    assert.equal(glyph.minX, 16);
    assert.equal(glyph.maxY, 26);
    // A speck of dust is too small to be a digit.
    const speck: Mask = { width: cell, height: cell, data: new Uint8Array(cell * cell) };
    speck.data[18 * cell + 18] = speck.data[18 * cell + 19] = 1;
    assert.equal(cellGlyph(speck, 0, 0, cell), null);
  });

  it("shrinks a glyph to fill the height, centered, keeping a narrow 1 narrow", () => {
    const bar = normalizeGlyph(new Uint8Array(4 * 16).fill(1), 4, 16);
    const n = TEMPLATE_SIZE;
    const column = (x: number) => Array.from({ length: n }, (_, y) => bar[y * n + x]!);
    assert.ok(column(n / 2).every((v) => v === 1));
    assert.ok(column(0).every((v) => v === 0));
    assert.ok(column(n - 1).every((v) => v === 0));
  });

  it("recognizes each template as its own digit", () => {
    for (const t of DIGIT_TEMPLATES) {
      const pixels = Float32Array.from(t.pixels, (ch) => parseInt(ch, 16) / 15);
      assert.equal(classifyGlyph(pixels, t.aspect).digit, t.digit);
    }
  });

  it("marks a reading unsure when two digits fit nearly as well", () => {
    const three = DIGIT_TEMPLATES.find((t) => t.digit === 3)!;
    const eight = DIGIT_TEMPLATES.find((t) => t.digit === 8)!;
    const blend = Float32Array.from(three.pixels, (ch, i) => (parseInt(ch, 16) + parseInt(eight.pixels[i]!, 16)) / 30);
    const result = classifyGlyph(blend, (three.aspect + eight.aspect) / 2);
    assert.ok([3, 8].includes(result.digit));
    assert.equal(result.sure, false);
  });
});
