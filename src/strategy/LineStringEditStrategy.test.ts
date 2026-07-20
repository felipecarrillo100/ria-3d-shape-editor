import {describe, expect, it} from "vitest";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {LineStringEditStrategy} from "./LineStringEditStrategy.js";

const REFERENCE = getReference("EPSG:4978");

describe("LineStringEditStrategy", () => {
  const strategy = new LineStringEditStrategy();

  it("starts with one vertex and cannot finish creation yet", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    expect(strategy.vertexCount(shape)).toBe(1);
    expect(strategy.canFinishCreation(shape)).toBe(false);
  });

  it("can finish creation once it has the minimum vertex count", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    strategy.appendVertex(shape, createPoint(REFERENCE, [10, 0, 0]));
    expect(strategy.vertexCount(shape)).toBe(2);
    expect(strategy.canFinishCreation(shape)).toBe(true);
  });

  it("refuses to remove a vertex right at the minimum, allows it above the minimum", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    strategy.appendVertex(shape, createPoint(REFERENCE, [10, 0, 0]));
    expect(strategy.canRemoveVertex(shape, 0)).toBe(false);

    strategy.appendVertex(shape, createPoint(REFERENCE, [20, 0, 0]));
    expect(strategy.canRemoveVertex(shape, 0)).toBe(true);
    strategy.removeVertex(shape, 0);
    expect(strategy.vertexCount(shape)).toBe(2);
  });

  it("moveVertex updates only the targeted vertex", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    strategy.appendVertex(shape, createPoint(REFERENCE, [10, 0, 0]));
    strategy.moveVertex(shape, 1, createPoint(REFERENCE, [10, 99, 42]));

    expect(strategy.getVertex(shape, 0).x).toBeCloseTo(0);
    expect(strategy.getVertex(shape, 1).y).toBeCloseTo(99);
    expect(strategy.getVertex(shape, 1).z).toBeCloseTo(42);
  });

  it("has no preview closing segment", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    strategy.appendVertex(shape, createPoint(REFERENCE, [10, 0, 0]));
    expect(strategy.getPreviewClosingSegment(shape)).toBeNull();
  });

  it("insertVertex inserts at the start, middle, or end without disturbing the others", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    strategy.appendVertex(shape, createPoint(REFERENCE, [20, 0, 0]));

    strategy.insertVertex(shape, 1, createPoint(REFERENCE, [10, 0, 0]));
    expect(strategy.vertexCount(shape)).toBe(3);
    expect(strategy.getVertex(shape, 0).x).toBeCloseTo(0);
    expect(strategy.getVertex(shape, 1).x).toBeCloseTo(10);
    expect(strategy.getVertex(shape, 2).x).toBeCloseTo(20);

    strategy.insertVertex(shape, 0, createPoint(REFERENCE, [-5, 0, 0]));
    strategy.insertVertex(shape, 4, createPoint(REFERENCE, [30, 0, 0]));
    expect(strategy.vertexCount(shape)).toBe(5);
    const xs = [-5, 0, 10, 20, 30];
    xs.forEach((x, i) => expect(strategy.getVertex(shape, i).x).toBeCloseTo(x));
  });
});
