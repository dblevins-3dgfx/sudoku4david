import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cellsName } from ".";

describe("cellsName", () => {
  it("groups cells that share a row or column", () => {
    assert.equal(cellsName([{ r: 1, c: 4 }, { r: 1, c: 7 }]), "row 2, columns 5 and 8");
    assert.equal(cellsName([{ r: 0, c: 2 }, { r: 3, c: 2 }, { r: 5, c: 2 }]), "column 3, rows 1, 4, and 6");
    assert.equal(cellsName([{ r: 0, c: 0 }, { r: 1, c: 1 }]), "row 1, column 1; row 2, column 2");
  });
});
