import {describe, expect, it} from "vitest";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {PolygonEditStrategy} from "./PolygonEditStrategy.js";

const REFERENCE = getReference("EPSG:4978");

function buildShape(strategy: PolygonEditStrategy, points: [number, number, number][]) {
  const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, points[0]));
  for (const point of points.slice(1)) {
    strategy.appendVertex(shape, createPoint(REFERENCE, point));
  }
  return shape;
}

describe("PolygonEditStrategy", () => {
  const strategy = new PolygonEditStrategy();

  it("cannot finish creation below 3 vertices, can at exactly 3", () => {
    const shape = buildShape(strategy, [[0, 0, 0], [10, 0, 0]]);
    expect(strategy.canFinishCreation(shape)).toBe(false);
    strategy.appendVertex(shape, createPoint(REFERENCE, [10, 10, 0]));
    expect(strategy.canFinishCreation(shape)).toBe(true);
  });

  it("refuses to remove a vertex right at the minimum, allows it above the minimum", () => {
    const shape = buildShape(strategy, [[0, 0, 0], [10, 0, 0], [10, 10, 0]]);
    expect(strategy.canRemoveVertex(shape, 0)).toBe(false);

    strategy.appendVertex(shape, createPoint(REFERENCE, [0, 10, 0]));
    expect(strategy.canRemoveVertex(shape, 0)).toBe(true);
    strategy.removeVertex(shape, 0);
    expect(strategy.vertexCount(shape)).toBe(3);
  });

  it("has no runtime closing-point bookkeeping - pointCount stays exactly as inserted", () => {
    const shape = buildShape(strategy, [[0, 0, 0], [10, 0, 0], [10, 10, 0]]);
    expect(strategy.vertexCount(shape)).toBe(3);
  });

  it("preview closing segment is null below 2 vertices, the last-to-first pair at 2+", () => {
    const oneVertex = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    expect(strategy.getPreviewClosingSegment(oneVertex)).toBeNull();

    const shape = buildShape(strategy, [[0, 0, 0], [10, 0, 0], [10, 10, 0]]);
    const segment = strategy.getPreviewClosingSegment(shape);
    expect(segment).not.toBeNull();
    expect(segment![0].x).toBeCloseTo(10);
    expect(segment![0].y).toBeCloseTo(10);
    expect(segment![1].x).toBeCloseTo(0);
    expect(segment![1].y).toBeCloseTo(0);
  });

  it("insertVertex re-inserts a removed middle vertex at its original index", () => {
    const shape = buildShape(strategy, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    strategy.removeVertex(shape, 1);
    expect(strategy.vertexCount(shape)).toBe(3);

    strategy.insertVertex(shape, 1, createPoint(REFERENCE, [10, 0, 0]));
    expect(strategy.vertexCount(shape)).toBe(4);
    const xs = [0, 10, 10, 0];
    const ys = [0, 0, 10, 10];
    xs.forEach((x, i) => expect(strategy.getVertex(shape, i).x).toBeCloseTo(x));
    ys.forEach((y, i) => expect(strategy.getVertex(shape, i).y).toBeCloseTo(y));
  });
});
