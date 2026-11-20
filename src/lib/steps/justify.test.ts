import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { followsFromSingles, whyPlaced, whyRemoved } from ".";
import { PUZZLE } from "./test-helpers";

describe("whyPlaced", () => {
  it("finds a single that places the digit straight away", () => {
    const chain = whyPlaced(PUZZLE, { r: 0, c: 5 }, 8);
    assert.deepEqual(chain?.map((step) => step.technique), ["hidden-single"]);
    assert.equal(chain?.[0].unit?.kind, "box");
  });

  it("keeps only the eliminations the single needs", () => {
    const chain = whyPlaced(PUZZLE, { r: 1, c: 8 }, 8);
    assert.deepEqual(chain?.map((step) => step.technique), ["claiming", "hidden-single"]);
  });

  it("has nothing for a digit the board rules out, or a wrong digit", () => {
    assert.equal(whyPlaced(PUZZLE, { r: 0, c: 2 }, 5), null, "row 1 already has a 5");
    assert.equal(whyPlaced(PUZZLE, { r: 0, c: 2 }, 1), null, "the solution has 4 here");
    assert.equal(whyPlaced(PUZZLE, { r: 0, c: 0 }, 5), null, "a filled cell");
  });
});

describe("whyRemoved", () => {
  it("names the elimination that takes the candidate out", () => {
    const chain = whyRemoved(PUZZLE, { r: 0, c: 7 }, 2);
    assert.deepEqual(chain?.map((step) => step.technique), ["pointing"]);
  });

  it("names a single that puts the digit in a cell this one sees", () => {
    const chain = whyRemoved(PUZZLE, { r: 0, c: 8 }, 4);
    assert.deepEqual(chain?.at(-1)?.place, { r: 6, c: 8, digit: 4 });
  });

  it("has nothing for the solution's digit, or one the board already rules out", () => {
    assert.equal(whyRemoved(PUZZLE, { r: 0, c: 7 }, 1), null);
    assert.equal(whyRemoved(PUZZLE, { r: 0, c: 2 }, 5), null);
  });
});

describe("followsFromSingles", () => {
  it("is true when filling other singles makes the digit a single", () => {
    assert.equal(followsFromSingles(PUZZLE, { r: 0, c: 2 }, 4), true);
  });

  it("is false for a wrong digit", () => {
    assert.equal(followsFromSingles(PUZZLE, { r: 0, c: 2 }, 1), false);
  });
});
