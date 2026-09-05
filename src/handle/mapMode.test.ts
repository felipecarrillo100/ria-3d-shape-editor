import {describe, expect, it} from "vitest";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {isGeocentricMap} from "./mapMode.js";

// isGeocentricMap reads nothing off the map but its reference, so a minimal stand-in is enough.
const mapWith = (identifier: string) =>
    ({reference: getReference(identifier)}) as unknown as WebGLMap;

describe("isGeocentricMap", () => {
  it("is true for the geocentric 3D reference", () => {
    expect(isGeocentricMap(mapWith("EPSG:4978"))).toBe(true);
  });

  // The two references the demo and most 2D apps actually use.
  it("is false for a projected 2D reference", () => {
    expect(isGeocentricMap(mapWith("EPSG:3857"))).toBe(false);
    expect(isGeocentricMap(mapWith("EPSG:32662"))).toBe(false);
  });

  // A geodetic reference carries a height, but still has no per-location "up" in the sense the
  // height/rotate maths needs - so it counts as 2D here, and always has (this matches the guard
  // HandleInteractions.verticalMovePointInteraction has used since before this helper existed).
  it("is false for a geodetic reference", () => {
    expect(isGeocentricMap(mapWith("CRS:84"))).toBe(false);
    expect(isGeocentricMap(mapWith("EPSG:4326"))).toBe(false);
  });
});
