import {describe, expect, it} from "vitest";
import {createPoint, createPolygon, createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {RIAMap} from "@luciad/ria/view/RIAMap.js";
import {EVENT_HANDLED, EVENT_IGNORED} from "@luciad/ria/view/controller/HandleEventResult.js";
import {Shape3DEditController} from "./Shape3DEditController.js";

const REFERENCE = getReference("EPSG:4978");
const WGS_84 = getReference("CRS:84");

/** Normalizes any angle in degrees into (-180, 180] - mirrors HandleInteractions.ts's own helper. */
const normalizeSignedDegrees = (degrees: number): number => ((degrees % 360) + 540) % 360 - 180;

// A real FeatureLayer needs a real FeatureModel/Store; these tests only ever read
// `layer.model.reference`, so a minimal stand-in is enough and keeps the tests independent of any
// backend.
const fakeLayer = {model: {reference: REFERENCE}} as unknown as FeatureLayer;
// Same stand-in, for the tests whose shape must live in a geographic reference: applyHeightInput
// reprojects the active vertex through WGS84, and an EPSG:4978 vertex near [0,0,0] sits at Earth's
// centre, where that reprojection is degenerate.
const wgs84Layer = {model: {reference: WGS_84}} as unknown as FeatureLayer;
// computeSegmentMidpointPosition (and therefore applyHeightInput) reads nothing off the map but its
// reference, so this is all a midpoint promotion needs - no camera, no DOM, no WebGL.
const fakeMap = {reference: REFERENCE} as unknown as RIAMap;

describe("Shape3DEditController constructor", () => {
  it("starts in the creating phase with no existing shape", () => {
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer);
    expect(controller.phase).toBe("creating");
    expect(controller.shape).toBeNull();
  });

  it("starts in the editing phase immediately when given an existing shape", () => {
    const point = createPoint(REFERENCE, [1, 2, 3]);
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer, {existingShape: point});
    expect(controller.phase).toBe("editing");
    expect(controller.shape).toBe(point);
  });

  it("throws when the existing shape's type does not match the requested shape type", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0]]);
    expect(() => new Shape3DEditController(ShapeType.POINT, fakeLayer, {existingShape: polygon as any})).toThrow();
  });
});

describe("Shape3DEditController.cancel()", () => {
  it("reverts a vertex moved mid-session back to its original position", () => {
    const point = createPoint(REFERENCE, [1, 2, 3]);
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer, {existingShape: point});
    controller.setVertexPosition(0, createPoint(REFERENCE, [100, 200, 300]));

    controller.cancel();

    expect(point.x).toBeCloseTo(1);
    expect(point.y).toBeCloseTo(2);
    expect(point.z).toBeCloseTo(3);
  });

  it("re-inserts a vertex removed mid-session, restoring full count and order - not just positions", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});

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

  // The opposite direction from the test above: a vertex can also be ADDED mid-session, by promoting
  // a virtual midpoint into a real one. Simulated here the same way the removal test above simulates
  // its own gesture - cancel() is the unit under test, and how the vertex got there is incidental to
  // it (the real promotion path gets its own test just below).
  it("removes a vertex added mid-session by a midpoint promotion, restoring the original count", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});
    (controller as any)._strategy.insertVertex(polygon, 1, createPoint(REFERENCE, [5, 0, 0]));
    (controller as any)._activeVertexIndex = 1;
    expect(polygon.pointCount).toBe(5);

    controller.cancel();

    expect(polygon.pointCount).toBe(4);
    const expectedXY: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expectedXY.forEach(([x, y], i) => {
      const vertex = polygon.getPoint(i);
      expect(vertex.x).toBeCloseTo(x);
      expect(vertex.y).toBeCloseTo(y);
    });
  });

  // Drives the controller's OWN promotion code rather than simulating the resulting shape state:
  // applyHeightInput is the htmlToolbar height-commit path, and it promotes a selected midpoint
  // exactly as a drag on one of its handles does. `map` has a getter but its setter throws
  // ("map property is not mutable"), so defineProperty is the only way to supply one without
  // activating the controller on a real WebGLMap - which is what this repo's tests deliberately
  // avoid needing. Worth the one unusual idiom: it proves the production path is what grows the
  // vertex count, not just a hand-built shape.
  it("undoes a promotion made through applyHeightInput, the real htmlToolbar height-commit path", () => {
    const line = createPolyline(WGS_84, [[4.0, 50.0, 0], [4.001, 50.0, 0], [4.002, 50.0, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYLINE, wgs84Layer, {existingShape: line});
    Object.defineProperty(controller, "map", {get: () => fakeMap, configurable: true});
    (controller as any)._activeSegmentIndex = 1;

    (controller as any).applyHeightInput(300);
    expect(line.pointCount).toBe(4);

    controller.cancel();

    expect(line.pointCount).toBe(3);
    const expectedX = [4.0, 4.001, 4.002];
    expectedX.forEach((x, i) => {
      expect(line.getPoint(i).x).toBeCloseTo(x);
      expect(line.getPoint(i).z).toBeCloseTo(0);
    });
  });

  // The reason this bug mattered in practice: the shape is mutated in place and outlives the
  // cancelled session, so a leaked vertex is baked into the NEXT session's snapshot. The demo builds
  // a fresh controller per edit session (demo/src/main.ts), so that is what this mirrors - without
  // truncation the count climbs 3 -> 4 -> 5 -> 6 -> 7 across these four cancelled sessions.
  it("does not accumulate vertices across repeated promote-then-cancel sessions on the same shape", () => {
    const line = createPolyline(REFERENCE, [[0, 0, 0], [10, 0, 0], [20, 0, 0]]);

    for (let session = 0; session < 4; session++) {
      const controller = new Shape3DEditController(ShapeType.POLYLINE, fakeLayer, {existingShape: line});
      (controller as any)._strategy.insertVertex(line, 1, createPoint(REFERENCE, [5, 0, 0]));
      (controller as any)._activeVertexIndex = 1;
      controller.cancel();
      expect(line.pointCount).toBe(3);
    }
  });

  // Nothing validates existingShape's vertex COUNT (the constructor only checks its type), and a
  // Polygon is a closed ring - so a 2-point one still exposes a promotable closing-segment midpoint.
  // Truncating 3 -> 2 there would fail canRemoveVertex's `pointCount > minVertexCount` (3 > 3), so
  // cancel() must use the unguarded removeLastVertex: removeVertex would throw out of endEditing()
  // and leave an editing session that can never be closed.
  it("truncates without throwing even when the original shape was below its minimum vertex count", () => {
    const degenerate = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: degenerate});
    (controller as any)._strategy.insertVertex(degenerate, 2, createPoint(REFERENCE, [5, 0, 0]));
    (controller as any)._activeVertexIndex = 2;

    expect(() => controller.cancel()).not.toThrow();

    expect(degenerate.pointCount).toBe(2);
  });

  // Promoting a Polygon's CLOSING segment (segmentIndex === count - 1) sets _activeVertexIndex to
  // segmentIndex + 1 === count, which the truncation then puts out of range. The clamp that fixes
  // this used to be unreachable/defensive; it is load-bearing now, and _activeVertexIndex is read
  // unguarded by drawEditHandles' htmlToolbar height sync on every frame.
  it("clamps the active vertex index back into range after truncating a closing-segment promotion", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});
    (controller as any)._strategy.insertVertex(polygon, 4, createPoint(REFERENCE, [0, 5, 0]));
    (controller as any)._activeVertexIndex = 4;

    controller.cancel();

    expect(polygon.pointCount).toBe(4);
    expect((controller as any)._activeVertexIndex).toBe(3);
  });

  // A second, separate defect on the same lines: Polyline/Polygon.insertPoint stores the Point BY
  // REFERENCE (unlike move3DPoint, which copies raw x/y/z), so restoring a removed vertex from the
  // snapshot without .copy() aliases the snapshot INTO the live shape. Editing that vertex afterwards
  // silently rewrites the snapshot, and a second cancel() can no longer restore it.
  it("keeps the snapshot detached, so a second cancel() still reverts a re-inserted vertex", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});
    // Remove a vertex, then revert - index 3 is the one cancel() restores via insertVertex.
    polygon.removePoint(1);
    controller.cancel();
    expect(polygon.getPoint(3).y).toBeCloseTo(10);

    controller.setVertexPosition(3, createPoint(REFERENCE, [999, 999, 999]));
    controller.cancel();

    const restored = polygon.getPoint(3);
    expect(restored.x).toBeCloseTo(0);
    expect(restored.y).toBeCloseTo(10);
  });
});

// removeVertexAtIndex is the shared logic behind both the click-only "remove" handle and
// double-click/double-tap removal (removeVertexNear) - exercised directly here rather than
// through a simulated gesture, since hit-testing/positioning already has its own coverage
// elsewhere (PointHandleLayout) and isn't what this behavior is about.
// Whole-shape mode needs a vertex other than the dragged one to carry along, so the shiftToggle
// handle is withheld on a single-vertex shape. Tested through wholeShapeModeAvailable and the
// candidate list rather than the draw pass: GeoCanvas isn't mocked anywhere in this repo, and the
// candidate list is the single source hover, click AND drag all read, so it is what actually decides
// whether the handle is reachable at all.
describe("Shape3DEditController whole-shape mode availability", () => {
  it("is unavailable for a Point, which only ever has one vertex", () => {
    const point = createPoint(REFERENCE, [1, 2, 3]);
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer, {existingShape: point});

    expect((controller as any).wholeShapeModeAvailable).toBe(false);
  });

  it("is available for a Polyline and a Polygon at their minimum vertex counts", () => {
    const line = createPolyline(REFERENCE, [[0, 0, 0], [10, 0, 0]]);
    const lineController = new Shape3DEditController(ShapeType.POLYLINE, fakeLayer, {existingShape: line});
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0]]);
    const polygonController = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});

    expect((lineController as any).wholeShapeModeAvailable).toBe(true);
    expect((polygonController as any).wholeShapeModeAvailable).toBe(true);
  });

  // The case a `shapeType !== POINT` check would have missed: nothing validates existingShape's
  // vertex count, so a degenerate one-vertex Polyline can be handed in.
  it("is unavailable for a degenerate single-vertex Polyline", () => {
    const line = createPolyline(REFERENCE, [[0, 0, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYLINE, fakeLayer, {existingShape: line});

    expect((controller as any).wholeShapeModeAvailable).toBe(false);
  });

  it("withholds the shiftToggle position when whole-shape mode is unavailable", () => {
    const degenerate = createPolyline(REFERENCE, [[0, 0, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYLINE, fakeLayer, {existingShape: degenerate});

    expect(offeredKinds(controller)).not.toContain("shiftToggle");
  });

  it("offers the shiftToggle position when whole-shape mode is available", () => {
    const line = createPolyline(REFERENCE, [[0, 0, 0], [1, 1, 1]]);
    const controller = new Shape3DEditController(ShapeType.POLYLINE, fakeLayer, {existingShape: line});

    expect(offeredKinds(controller)).toContain("shiftToggle");
  });
});

// effectiveHandlePositions is the one place that decides which handles exist at all, for hover,
// click, drag AND drawing alike - so these assert the gating rules directly rather than trying to
// simulate gestures. It only reads properties off `positions`, so a plain literal stands in for a
// real PointHandlePositions.
const allPositionsPresent = () => {
  const p = createPoint(REFERENCE, [0, 0, 0]);
  return {free: p, move: p, height: p, finish: p, cancel: p, shiftToggle: p, remove: p, rotate: p};
};

/** The handle kinds left with a non-null position, i.e. the ones actually on offer. */
const offeredKinds = (
    controller: Shape3DEditController,
    {canRemove = false, rotateAllowed = false} = {},
): string[] => {
  const effective = (controller as any)
      .effectiveHandlePositions(allPositionsPresent(), canRemove, rotateAllowed);
  return Object.entries(effective)
      .filter(([, position]) => position !== null)
      .map(([kind]) => kind);
};

/** A two-vertex Polyline controller, optionally latched into 2D mode and/or with whole-shape armed. */
const controllerFor2DTests = ({is2D = false, armed = false} = {}) => {
  const line = createPolyline(REFERENCE, [[0, 0, 0], [1, 1, 1]]);
  const controller = new Shape3DEditController(ShapeType.POLYLINE, fakeLayer, {existingShape: line});
  // Both are normally set by onActivate / a shiftToggle click, neither of which is reachable without
  // a real map and gesture stream.
  (controller as any)._is2D = is2D;
  (controller as any)._shiftWholeShapeToggled = armed;
  return controller;
};

describe("Shape3DEditController 2D handle gating", () => {
  it("offers move unconditionally in 3D, armed or not", () => {
    expect(offeredKinds(controllerFor2DTests({is2D: false, armed: false}))).toContain("move");
    expect(offeredKinds(controllerFor2DTests({is2D: false, armed: true}))).toContain("move");
  });

  // In 2D the vertex icon itself already moves in-plane with the height frozen, so an unarmed move
  // handle would just duplicate it - it exists there purely as the "translate every vertex" grip.
  it("withholds move in 2D until whole-shape mode is armed", () => {
    expect(offeredKinds(controllerFor2DTests({is2D: true, armed: false}))).not.toContain("move");
    expect(offeredKinds(controllerFor2DTests({is2D: true, armed: true}))).toContain("move");
  });

  it("still offers the vertex, toggle, finish and cancel handles in an unarmed 2D session", () => {
    const kinds = offeredKinds(controllerFor2DTests({is2D: true, armed: false}), {canRemove: true});
    expect(kinds).toEqual(expect.arrayContaining(["free", "shiftToggle", "remove", "finish", "cancel"]));
  });

  // Rotate's per-frame maths reads EditHandle.allVerticesStartWGS84, which is only populated when a
  // drag starts with whole-shape mode armed - so offering rotate unarmed would throw on the first
  // drag frame. This is the assertion that keeps those two in lockstep.
  it("only offers rotate while armed, in both 2D and 3D", () => {
    for (const is2D of [false, true]) {
      expect(offeredKinds(controllerFor2DTests({is2D, armed: false}), {rotateAllowed: true}))
          .not.toContain("rotate");
      expect(offeredKinds(controllerFor2DTests({is2D, armed: true}), {rotateAllowed: true}))
          .toContain("rotate");
    }
  });

  // A virtual midpoint isn't a committed pivot, so its call site passes rotateAllowed: false.
  it("never offers rotate for a midpoint, even while armed", () => {
    expect(offeredKinds(controllerFor2DTests({is2D: true, armed: true}), {rotateAllowed: false}))
        .not.toContain("rotate");
  });
});

// The htmlToolbar height input is expressed in the uom family's BASE unit (m or ft), so a typed
// value has to be converted before it becomes a WGS84 ellipsoidal height. Exercised through the
// controller's own applyHeightInput rather than the toolbar itself: HtmlToolbar needs a real DOM,
// which this repo's node-environment tests deliberately don't provide - but this is the half where
// a mistake would silently persist a vertex at the wrong altitude.
describe("Shape3DEditController.applyHeightInput()", () => {
  const lineAtZeroHeight = () => createPolyline(WGS_84, [[4.0, 50.0, 0], [4.001, 50.0, 0]]);

  const controllerFor = (uom: "metric" | "imperial" | "nautical") => {
    const line = lineAtZeroHeight();
    const controller = new Shape3DEditController(ShapeType.POLYLINE, wgs84Layer, {existingShape: line, uom});
    Object.defineProperty(controller, "map", {get: () => fakeMap, configurable: true});
    return {line, controller};
  };

  it("treats a typed value as meters for the metric family", () => {
    const {line, controller} = controllerFor("metric");

    (controller as any).applyHeightInput(100);

    expect(line.getPoint(0).z).toBeCloseTo(100, 6);
  });

  it("treats a typed value as feet for the imperial and nautical families", () => {
    for (const uom of ["imperial", "nautical"] as const) {
      const {line, controller} = controllerFor(uom);

      (controller as any).applyHeightInput(100);

      // 100ft * 0.3048 = 30.48m
      expect(line.getPoint(0).z).toBeCloseTo(30.48, 6);
    }
  });
});

describe("Shape3DEditController.removeVertexAtIndex()", () => {
  it("removes the targeted vertex when the shape has more than its minimum vertex count", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});

    const result = (controller as any).removeVertexAtIndex(1);

    expect(result).toBe(EVENT_HANDLED);
    expect((controller.shape as Polygon).pointCount).toBe(3);
  });

  it("is a no-op when the shape is already at its minimum vertex count", () => {
    const point = createPoint(REFERENCE, [1, 2, 3]);
    const controller = new Shape3DEditController(ShapeType.POINT, fakeLayer, {existingShape: point});

    const result = (controller as any).removeVertexAtIndex(0);

    expect(result).toBe(EVENT_IGNORED);
    expect(controller.shape).toBe(point);
  });
});

// rotateOtherVerticesAround is the whole-shape-rotate handle's shared math, exercised directly
// here (rather than through a simulated drag gesture) since it's pure geodesy with no map/view
// dependency - the cursor-to-angle plumbing (horizontalRotateAzimuthInteraction) is deliberately
// left to manual/demo verification, matching this codebase's existing precedent for the other
// interaction functions in HandleInteractions.ts, which also aren't unit-tested beyond their
// non-geocentric no-op guards.
describe("Shape3DEditController.rotateOtherVerticesAround()", () => {
  it("rotates a non-pivot vertex around the pivot, preserving distance/height and shifting azimuth by the delta", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});
    const geodesy = createEllipsoidalGeodesy(WGS_84);

    const pivotWGS84 = createPoint(WGS_84, [10, 20, 100]);
    const otherWGS84 = createPoint(WGS_84, [10.001, 20, 150]);
    const originalDistance = geodesy.distance(pivotWGS84, otherWGS84);
    const originalAzimuth = geodesy.forwardAzimuth(pivotWGS84, otherWGS84);

    (controller as any).rotateOtherVerticesAround(pivotWGS84, 90, 0, [pivotWGS84, otherWGS84]);

    const rotatedInShapeRef = (controller.shape as Polygon).getPoint(1);
    const rotatedWGS84 = createTransformation(REFERENCE, WGS_84).transform(rotatedInShapeRef);

    expect(geodesy.distance(pivotWGS84, rotatedWGS84)).toBeCloseTo(originalDistance, 1);
    expect(rotatedWGS84.z).toBeCloseTo(150, 3);
    const actualAzimuthDelta = normalizeSignedDegrees(geodesy.forwardAzimuth(pivotWGS84, rotatedWGS84) - originalAzimuth);
    expect(actualAzimuthDelta).toBeCloseTo(90, 0);
  });

  it("leaves the pivot vertex itself unchanged", () => {
    const polygon = createPolygon(REFERENCE, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]);
    const controller = new Shape3DEditController(ShapeType.POLYGON, fakeLayer, {existingShape: polygon});
    const pivotWGS84 = createPoint(WGS_84, [10, 20, 100]);
    const otherWGS84 = createPoint(WGS_84, [10.001, 20, 150]);

    (controller as any).rotateOtherVerticesAround(pivotWGS84, 45, 0, [pivotWGS84, otherWGS84]);

    const pivotAfter = (controller.shape as Polygon).getPoint(0);
    expect(pivotAfter.x).toBeCloseTo(0);
    expect(pivotAfter.y).toBeCloseTo(0);
    expect(pivotAfter.z).toBeCloseTo(0);
  });
});

// The 2D whole-shape translate. Asserted directly rather than through a drag gesture, for the same
// reason the rotate tests above are: the maths is where a mistake would silently move real geometry,
// and reaching it via a gesture would need a real map/camera/WebGL.
describe("Shape3DEditController.translateAllVerticesGeodetic()", () => {
  const geodesy = createEllipsoidalGeodesy(WGS_84);

  // Vertices at DIFFERENT heights, spread far enough apart that a rigid Cartesian translation would
  // measurably disturb them - that's the failure this whole method exists to avoid.
  const startPositions = () => [
    createPoint(WGS_84, [4.0, 50.0, 0]),
    createPoint(WGS_84, [4.5, 50.2, 137.5]),
    createPoint(WGS_84, [4.2, 50.4, -12.25]),
  ];

  const controllerWithThreeVertices = () => {
    const polygon = createPolygon(WGS_84, [[4.0, 50.0, 0], [4.5, 50.2, 137.5], [4.2, 50.4, -12.25]]);
    return new Shape3DEditController(ShapeType.POLYGON, wgs84Layer, {existingShape: polygon});
  };

  it("moves every vertex by the same bearing and distance", () => {
    const controller = controllerWithThreeVertices();
    const starts = startPositions();

    (controller as any).translateAllVerticesGeodetic(starts, 45, 500);

    const shape = controller.shape as Polygon;
    for (let i = 0; i < starts.length; i++) {
      const moved = shape.getPoint(i);
      expect(geodesy.distance(starts[i], moved)).toBeCloseTo(500, 1);
      expect(normalizeSignedDegrees(geodesy.forwardAzimuth(starts[i], moved) - 45)).toBeCloseTo(0, 1);
    }
  });

  // The whole point of the method: this is what a rigid EPSG:4978 delta would get wrong.
  it("leaves every vertex's height exactly untouched", () => {
    const controller = controllerWithThreeVertices();
    const starts = startPositions();

    (controller as any).translateAllVerticesGeodetic(starts, 137, 25000);

    const shape = controller.shape as Polygon;
    expect(shape.getPoint(0).z).toBeCloseTo(0, 6);
    expect(shape.getPoint(1).z).toBeCloseTo(137.5, 6);
    expect(shape.getPoint(2).z).toBeCloseTo(-12.25, 6);
  });

  // A drag's first frame reports zero movement, and forwardAzimuth between two identical points has
  // no defined bearing - writing that through would put NaN coordinates on the shape.
  it("is a no-op for a zero-distance or non-finite shift, rather than writing NaN", () => {
    for (const [azimuth, dist] of [[45, 0], [NaN, 500], [45, NaN]] as Array<[number, number]>) {
      const controller = controllerWithThreeVertices();

      (controller as any).translateAllVerticesGeodetic(startPositions(), azimuth, dist);

      const shape = controller.shape as Polygon;
      expect(shape.getPoint(1).x).toBeCloseTo(4.5, 9);
      expect(shape.getPoint(1).y).toBeCloseTo(50.2, 9);
      expect(shape.getPoint(1).z).toBeCloseTo(137.5, 9);
    }
  });
});
