import {describe, expect, it} from "vitest";
import {createPoint, createPolygon} from "@luciad/ria/shape/ShapeFactory.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {Shape3DEditController} from "./Shape3DEditController.js";

const REFERENCE = getReference("EPSG:4978");

// A real FeatureLayer needs a real FeatureModel/Store; these tests only ever read
// `layer.model.reference`, so a minimal stand-in is enough and keeps the tests independent of any
// backend.
const fakeLayer = {model: {reference: REFERENCE}} as unknown as FeatureLayer;

describe("Shape3DEditController constructor", () => {
  it("starts in the creating phase with no existing shape", () => {
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer);
    expect(controller.phase).toBe("creating");
    expect(controller.shape).toBeNull();
  });

  it("starts in the editing phase immediately when given an existing shape", () => {
    const point = createPoint(REFERENCE, [1, 2, 3]);
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer, point);
    expect(controller.phase).toBe("editing");
    expect(controller.shape).toBe(point);
  });

  it("throws when the existing shape's type does not match the requested shape type", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0]]);
    expect(() => new Shape3DEditController(ShapeType.POINT, fakeLayer, polygon as any)).toThrow();
  });
});

describe("Shape3DEditController.cancel()", () => {
  it("reverts a vertex moved mid-session back to its original position", () => {
    const point = createPoint(REFERENCE, [1, 2, 3]);
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer, point);
    controller.setVertexPosition(0, createPoint(REFERENCE, [100, 200, 300]));

    controller.cancel();

    expect(point.x).toBeCloseTo(1);
    expect(point.y).toBeCloseTo(2);
    expect(point.z).toBeCloseTo(3);
  });

  it("re-inserts a vertex removed mid-session, restoring full count and order - not just positions", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, polygon);

    // Simulate what a mid-session double-click-remove (handleEditDoubleClick) leaves behind -
    // the shape itself is the same public Polygon API a real removal would have used.
    (controller.shape as Polygon).removePoint(1);
    expect((controller.shape as Polygon).pointCount).toBe(3);

    controller.cancel();

    const restored = controller.shape as Polygon;
    expect(restored.pointCount).toBe(4);
    const expectedXY: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expectedXY.forEach(([x, y], i) => {
      const vertex = restored.getPoint(i);
      expect(vertex.x).toBeCloseTo(x);
      expect(vertex.y).toBeCloseTo(y);
    });
  });
});
