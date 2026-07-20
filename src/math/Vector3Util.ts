/*
 *
 * Copyright (c) 1999-2026 Luciad All Rights Reserved.
 *
 * Luciad grants you ("Licensee") a non-exclusive, royalty free, license to use,
 * modify and redistribute this software in source and binary code form,
 * provided that i) this copyright notice and license appear on all copies of
 * the software; and ii) Licensee does not utilize the software in a manner
 * which is disparaging to Luciad.
 *
 * This software is provided "AS IS," without a warranty of any kind. ALL
 * EXPRESS OR IMPLIED CONDITIONS, REPRESENTATIONS AND WARRANTIES, INCLUDING ANY
 * IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR
 * NON-INFRINGEMENT, ARE HEREBY EXCLUDED. LUCIAD AND ITS LICENSORS SHALL NOT BE
 * LIABLE FOR ANY DAMAGES SUFFERED BY LICENSEE AS A RESULT OF USING, MODIFYING
 * OR DISTRIBUTING THE SOFTWARE OR ITS DERIVATIVES. IN NO EVENT WILL LUCIAD OR ITS
 * LICENSORS BE LIABLE FOR ANY LOST REVENUE, PROFIT OR DATA, OR FOR DIRECT,
 * INDIRECT, SPECIAL, CONSEQUENTIAL, INCIDENTAL OR PUNITIVE DAMAGES, HOWEVER
 * CAUSED AND REGARDLESS OF THE THEORY OF LIABILITY, ARISING OUT OF THE USE OF
 * OR INABILITY TO USE SOFTWARE, EVEN IF LUCIAD HAS BEEN ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGES.
 */
// Adapted from @luciad/ria-toolbox-core/util/Vector3Util.js, trimmed to only the functions this
// package actually calls (no rotation/angle/plane-projection/box-face-intersection helpers).
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";

/**
 * Returns a copy of the given vector
 */
export function copy(a: Vector3): Vector3 {
  return {x: a.x, y: a.y, z: a.z}
}

/**
 * Returns the addition of the two given vectors
 */
export function add(a: Vector3, b: Vector3): Vector3 {
  return addArray([a, b]);
}

/**
 * Returns the addition of the given vectors
 */
export function addArray(array: Vector3[]): Vector3 {
  let result = {
    x: 0,
    y: 0,
    z: 0
  };

  for (const vector of array) {
    result = {
      x: result.x + vector.x,
      y: result.y + vector.y,
      z: result.z + vector.z
    }
  }

  return result;
}

/**
 * Returns the subtraction of the second given vector from the first
 */
export function sub(a: Vector3, b: Vector3) {
  return subArray([a, b]);
}

/**
 * Returns the subtraction of the non-first vectors from the first
 */
export function subArray(array: Vector3[]): Vector3 {
  let result = {
    x: array[0].x,
    y: array[0].y,
    z: array[0].z
  };
  for (let i = 1; i < array.length; i++) {
    const vector = array[i];
    result = {
      x: result.x - vector.x,
      y: result.y - vector.y,
      z: result.z - vector.z
    }
  }
  return result;
}

/**
 * Returns the given vector, scaled with a given value
 */
export function scale(vec: Vector3, scalar: number): Vector3 {
  return {
    x: vec.x * scalar,
    y: vec.y * scalar,
    z: vec.z * scalar
  }
}

/**
 * Returns the cross product of the two given vectors
 */
export function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
}

/**
 * Returns the dot (scalar) product of the two given vectors.
 */
export function dot(a: Vector3, b: Vector3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Returns the square of the length of the given vector.
 */
export function length2(a: Vector3): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

/**
 * Returns the length of the given vector
 */
export function length(a: Vector3): number {
  return Math.sqrt(length2(a));
}

/**
 * Returns the distance between the two given vectors
 */
export function distance(a: Vector3, b: Vector3): number {
  return length(sub(a, b));
}

/**
 * Returns the distance between the given origin and the orthogonal projection of the given vector on the line starting
 * at the origin, with given direction
 */
export function distanceAlongDirection(point: Vector3, origin: Vector3, direction: Vector3): number {
  const originToPoint = sub(point, origin);
  return dot(originToPoint, normalize(direction))
}

/**
 * Returns the intersection point (if any) between the given ray and plane.
 */
export function rayPlaneIntersection(rayOrigin: Vector3, rayDirection: Vector3, planeNormal: Vector3,
                                     pointOnPlane: Vector3): Vector3 | null {
  const numerator = dot(sub(pointOnPlane, rayOrigin), planeNormal);
  const denominator = dot(rayDirection, planeNormal);
  if (denominator !== 0) {
    //the plane and ray are not parallel
    const rayToPlaneDistance = numerator / denominator;
    if (rayToPlaneDistance < 0) {
      return null; //the intersection is behind the ray
    }
    return add(rayOrigin, scale(rayDirection, rayToPlaneDistance));
  } else if (numerator === 0) {
    //the origin of the ray is on the plane
    return copy(rayOrigin);
  } else {
    return null;
  }
}

/**
 * Returns a normalized version of the given vector
 */
export const normalize = (vec: Vector3): Vector3 => scale(vec, 1 / length(vec));

/**
 * Returns a LuciadRIA point with given reference, using the given vector for the coordinates
 */
export const toPoint = (reference: CoordinateReference | null, vec: Vector3): Point => createPoint(reference,
    [vec.x, vec.y, vec.z]);
