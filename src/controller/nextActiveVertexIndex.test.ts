import {describe, expect, it} from "vitest";
import {nextActiveVertexIndex} from "./nextActiveVertexIndex.js";

describe("nextActiveVertexIndex", () => {
  it("shifts the active index down by one when a vertex before it is removed", () => {
    expect(nextActiveVertexIndex(3, 1, 4)).toBe(2);
  });

  it("falls to whatever now occupies the active index's old slot when the active vertex itself (not last) is removed", () => {
    // [A, B(active,1), C, D] -> remove B -> [A, C, D], C now at index 1 becomes active
    expect(nextActiveVertexIndex(1, 1, 3)).toBe(1);
  });

  it("clamps to the new last index when the active vertex removed was the last one", () => {
    // [A, B, C(active,2)] -> remove C -> [A, B], new last index is 1
    expect(nextActiveVertexIndex(2, 2, 2)).toBe(1);
  });

  it("leaves the active index unchanged when a vertex after it is removed", () => {
    expect(nextActiveVertexIndex(1, 3, 4)).toBe(1);
  });
});
