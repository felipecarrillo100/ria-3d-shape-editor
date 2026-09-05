import {describe, expect, it} from "vitest";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {computePointHandlePositions, DEFAULT_HANDLE_OFFSET_PIXELS} from "./PointHandleLayout.js";

const MERCATOR = getReference("EPSG:3857");

// The 2D branch only ever touches map.reference plus the two view transformations, so a stand-in
// pair is enough - no camera, no DOM, no WebGL. This is an exactly invertible 1 map-unit == 1 pixel
// projection with the y axis flipped (screen y grows DOWNWARD, as it does for real), which makes the
// expected pixel offsets readable directly off the resulting coordinates.
const fake2DMap = {
  reference: MERCATOR,
  mapToViewTransformation: {
    transform: (point: Point) => createPoint(null, [point.x, -point.y]),
  },
  viewToMapTransformation: {
    transform: (view: Point) => createPoint(MERCATOR, [view.x, -view.y, 0]),
  },
} as unknown as WebGLMap;

const vertex = () => createPoint(MERCATOR, [1000, 2000, 55]);

describe("computePointHandlePositions on a 2D map", () => {
  const px = DEFAULT_HANDLE_OFFSET_PIXELS;

  it("puts the free handle exactly on the vertex", () => {
    const positions = computePointHandlePositions(fake2DMap, vertex());
    expect(positions.free.x).toBeCloseTo(1000);
    expect(positions.free.y).toBeCloseTo(2000);
  });

  // Height dragging needs a geocentric map to make sense of "up", so the slot directly above the
  // vertex stays permanently empty in 2D. null (not "a position nobody draws") is what withdraws it
  // from hit-testing as well - see effectiveHandlePositions' null-means-withdrawn contract.
  it("never offers a height handle", () => {
    expect(computePointHandlePositions(fake2DMap, vertex()).height).toBeNull();
  });

  it("offers every other handle", () => {
    const positions = computePointHandlePositions(fake2DMap, vertex());
    expect(positions.move).not.toBeNull();
    expect(positions.shiftToggle).not.toBeNull();
    expect(positions.remove).not.toBeNull();
    expect(positions.rotate).not.toBeNull();
    expect(positions.finish).not.toBeNull();
    expect(positions.cancel).not.toBeNull();
  });

  // Mirrors the 3D slot layout so muscle memory transfers between the two modes: move right,
  // toggle left, remove top-left, rotate top-right, cancel/finish as a pair below.
  it("places each handle in its expected slot, offset by whole pixels", () => {
    const p = computePointHandlePositions(fake2DMap, vertex());

    expect(p.move!.x).toBeCloseTo(1000 + px);
    expect(p.move!.y).toBeCloseTo(2000);

    expect(p.shiftToggle!.x).toBeCloseTo(1000 - px);
    expect(p.shiftToggle!.y).toBeCloseTo(2000);

    // Screen y grows downward, so "above the vertex" is a LARGER map y here.
    expect(p.remove!.x).toBeCloseTo(1000 - px);
    expect(p.remove!.y).toBeCloseTo(2000 + px);

    expect(p.rotate!.x).toBeCloseTo(1000 + px);
    expect(p.rotate!.y).toBeCloseTo(2000 + px);

    // The confirm/cancel pair sits below the vertex, symmetric left/right of it.
    expect(p.cancel!.x).toBeLessThan(1000);
    expect(p.finish!.x).toBeGreaterThan(1000);
    expect(p.cancel!.y).toBeLessThan(2000);
    expect(p.finish!.y).toBeCloseTo(p.cancel!.y);
    expect(1000 - p.cancel!.x).toBeCloseTo(p.finish!.x - 1000);
  });

  // A fixed pixel offset is the whole point of the 2D branch: no camera-distance factor, so the
  // icons keep the same on-screen spacing at every zoom level. Nothing in the maths can vary with
  // the vertex's position, which this pins down.
  it("uses the same pixel offsets wherever the vertex is", () => {
    const near = computePointHandlePositions(fake2DMap, createPoint(MERCATOR, [0, 0, 0]));
    const far = computePointHandlePositions(fake2DMap, createPoint(MERCATOR, [5_000_000, 8_000_000, 900]));

    expect(near.move!.x - near.free.x).toBeCloseTo(far.move!.x - far.free.x);
    expect(near.rotate!.y - near.free.y).toBeCloseTo(far.rotate!.y - far.free.y);
  });

  // The normal outcome for a vertex that isn't currently on screen. Every satellite slot degrades to
  // "no handle" while the vertex itself still reports a position, so nothing throws mid-frame.
  it("returns null satellite positions when the view transformation throws", () => {
    const throwingMap = {
      reference: MERCATOR,
      mapToViewTransformation: {transform: () => { throw new Error("out of bounds"); }},
      viewToMapTransformation: {transform: () => { throw new Error("out of bounds"); }},
    } as unknown as WebGLMap;

    const p = computePointHandlePositions(throwingMap, vertex());

    expect(p.free).not.toBeNull();
    expect(p.move).toBeNull();
    expect(p.rotate).toBeNull();
    expect(p.finish).toBeNull();
  });
});
