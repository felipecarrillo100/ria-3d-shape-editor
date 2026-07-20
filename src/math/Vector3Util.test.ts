import {describe, expect, it} from "vitest";
import {add, cross, distance, distanceAlongDirection, dot, length, normalize, rayPlaneIntersection, scale, sub, toPoint} from "./Vector3Util.js";

describe("Vector3Util", () => {
  it("add/sub are inverses", () => {
    const a = {x: 1, y: 2, z: 3};
    const b = {x: 4, y: -1, z: 0.5};
    expect(sub(add(a, b), b)).toEqual(a);
  });

  it("scale scales every component", () => {
    expect(scale({x: 1, y: -2, z: 3}, 2)).toEqual({x: 2, y: -4, z: 6});
  });

  it("cross of orthogonal unit axes gives the third axis", () => {
    const x = {x: 1, y: 0, z: 0};
    const y = {x: 0, y: 1, z: 0};
    expect(cross(x, y)).toEqual({x: 0, y: 0, z: 1});
  });

  it("dot of orthogonal vectors is zero", () => {
    expect(dot({x: 1, y: 0, z: 0}, {x: 0, y: 1, z: 0})).toBe(0);
  });

  it("distance from a point to itself is zero", () => {
    const p = {x: 5, y: -3, z: 10};
    expect(distance(p, p)).toBe(0);
  });

  it("distance matches the classic 3-4-5 triangle", () => {
    expect(distance({x: 0, y: 0, z: 0}, {x: 3, y: 4, z: 0})).toBeCloseTo(5);
  });

  it("normalize produces a unit-length vector pointing the same way", () => {
    const v = normalize({x: 3, y: 4, z: 0});
    expect(length(v)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
  });

  it("distanceAlongDirection measures signed projection along an axis", () => {
    const origin = {x: 0, y: 0, z: 0};
    const direction = {x: 0, y: 0, z: 1};
    expect(distanceAlongDirection({x: 5, y: 5, z: 7}, origin, direction)).toBeCloseTo(7);
    expect(distanceAlongDirection({x: 5, y: 5, z: -7}, origin, direction)).toBeCloseTo(-7);
  });

  it("rayPlaneIntersection: a vertical ray hits a horizontal plane at the expected height", () => {
    const rayOrigin = {x: 0, y: 0, z: 10};
    const rayDirection = {x: 0, y: 0, z: -1};
    const planeNormal = {x: 0, y: 0, z: 1};
    const pointOnPlane = {x: 0, y: 0, z: 3};
    const hit = rayPlaneIntersection(rayOrigin, rayDirection, planeNormal, pointOnPlane);
    expect(hit).not.toBeNull();
    expect(hit!.z).toBeCloseTo(3);
    expect(hit!.x).toBeCloseTo(0);
    expect(hit!.y).toBeCloseTo(0);
  });

  it("rayPlaneIntersection returns null when the plane is behind the ray", () => {
    const rayOrigin = {x: 0, y: 0, z: 0};
    const rayDirection = {x: 0, y: 0, z: 1};
    const planeNormal = {x: 0, y: 0, z: 1};
    const pointOnPlane = {x: 0, y: 0, z: -5};
    expect(rayPlaneIntersection(rayOrigin, rayDirection, planeNormal, pointOnPlane)).toBeNull();
  });

  it("toPoint builds a Point carrying the given coordinates", () => {
    const p = toPoint(null, {x: 1, y: 2, z: 3});
    expect(p.x).toBe(1);
    expect(p.y).toBe(2);
    expect(p.z).toBe(3);
  });
});
