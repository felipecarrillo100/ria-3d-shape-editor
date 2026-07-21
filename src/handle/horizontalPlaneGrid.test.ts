import {describe, expect, it} from "vitest";
import {horizontalPlaneGridLines} from "./horizontalPlaneGrid.js";
import {distance, dot, sub} from "../math/Vector3Util.js";

describe("horizontalPlaneGridLines", () => {
  const center = {x: 10, y: 20, z: 30};
  const up = {x: 0, y: 0, z: 1};
  const halfSize = 5;
  const divisions = 5;

  it("returns 2 lines per division position, including the center and both edges - 22 for 5 divisions", () => {
    const lines = horizontalPlaneGridLines(center, up, halfSize, divisions);
    expect(lines).toHaveLength(2 * (2 * divisions + 1));
  });

  it("every line spans the full width (2 * halfSize) end to end", () => {
    const lines = horizontalPlaneGridLines(center, up, halfSize, divisions);
    for (const [a, b] of lines) {
      expect(distance(a, b)).toBeCloseTo(2 * halfSize, 6);
    }
  });

  it("every endpoint stays tangent to up - no drift off the flat plane through center", () => {
    const lines = horizontalPlaneGridLines(center, up, halfSize, divisions);
    for (const [a, b] of lines) {
      expect(dot(sub(a, center), up)).toBeCloseTo(0, 6);
      expect(dot(sub(b, center), up)).toBeCloseTo(0, 6);
    }
  });

  it("includes a pair of lines crossing exactly through the center (the i=0 division)", () => {
    const lines = horizontalPlaneGridLines(center, up, halfSize, divisions);
    const midpoints = lines.map(([a, b]) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2}));
    const centerCrossings = midpoints.filter((m) => distance(m, center) < 1e-6);
    expect(centerCrossings.length).toBe(2);
  });

  it("the outermost division on each side sits exactly halfSize from center - same footprint as the old filled square", () => {
    const lines = horizontalPlaneGridLines(center, up, halfSize, divisions);
    const midpoints = lines.map(([a, b]) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2}));
    const maxOffset = Math.max(...midpoints.map((m) => distance(m, center)));
    expect(maxOffset).toBeCloseTo(halfSize, 6);
  });
});
