import {describe, expect, it} from "vitest";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {computeSegmentMidpointPosition} from "./MidpointHandleLayout.js";

const REFERENCE = getReference("EPSG:4978");
const fakeMap = {reference: REFERENCE} as unknown as WebGLMap;

describe("computeSegmentMidpointPosition", () => {
  it("returns the arithmetic midpoint of two points already in map.reference", () => {
    const a = createPoint(REFERENCE, [0, 0, 0]);
    const b = createPoint(REFERENCE, [10, 20, 30]);

    const midpoint = computeSegmentMidpointPosition(fakeMap, a, b);

    expect(midpoint.x).toBeCloseTo(5);
    expect(midpoint.y).toBeCloseTo(10);
    expect(midpoint.z).toBeCloseTo(15);
  });

  it("is symmetric regardless of argument order", () => {
    const a = createPoint(REFERENCE, [4, -6, 8]);
    const b = createPoint(REFERENCE, [-2, 10, 0]);

    const midpointAB = computeSegmentMidpointPosition(fakeMap, a, b);
    const midpointBA = computeSegmentMidpointPosition(fakeMap, b, a);

    expect(midpointAB.x).toBeCloseTo(midpointBA.x);
    expect(midpointAB.y).toBeCloseTo(midpointBA.y);
    expect(midpointAB.z).toBeCloseTo(midpointBA.z);
  });
});
