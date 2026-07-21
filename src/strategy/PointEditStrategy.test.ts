import {describe, expect, it} from "vitest";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {PointEditStrategy} from "./PointEditStrategy.js";

const REFERENCE = getReference("EPSG:4978");

describe("PointEditStrategy", () => {
  const strategy = new PointEditStrategy();

  it("creates a one-vertex shape at the given point", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [1, 2, 3]));
    expect(strategy.vertexCount(shape)).toBe(1);
    expect(shape.x).toBeCloseTo(1);
    expect(shape.y).toBeCloseTo(2);
    expect(shape.z).toBeCloseTo(3);
  });

  it("can always finish creation and never allows vertex removal", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    expect(strategy.canFinishCreation(shape)).toBe(true);
    expect(strategy.canRemoveVertex(shape, 0)).toBe(false);
  });

  it("moveVertex updates the point's coordinates", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    strategy.moveVertex(shape, 0, createPoint(REFERENCE, [5, 6, 7]));
    expect(shape.x).toBeCloseTo(5);
    expect(shape.y).toBeCloseTo(6);
    expect(shape.z).toBeCloseTo(7);
  });

  it("rejects appending, removing, inserting, or moving at an invalid index", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    expect(() => strategy.appendVertex(shape, createPoint(REFERENCE, [1, 1, 1]))).toThrow();
    expect(() => strategy.removeLastVertex(shape)).toThrow();
    expect(() => strategy.removeVertex(shape, 0)).toThrow();
    expect(() => strategy.insertVertex(shape, 0, createPoint(REFERENCE, [1, 1, 1]))).toThrow();
    expect(() => strategy.moveVertex(shape, 1, createPoint(REFERENCE, [1, 1, 1]))).toThrow();
  });

  it("has no preview closing segment", () => {
    const shape = strategy.createEmptyShape(REFERENCE, createPoint(REFERENCE, [0, 0, 0]));
    expect(strategy.getPreviewClosingSegment(shape)).toBeNull();
  });

  it("is not a closed ring", () => {
    expect(strategy.isClosedRing).toBe(false);
  });
});
