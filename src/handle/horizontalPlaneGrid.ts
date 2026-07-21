// Fresh code - supersedes the earlier filled-quad approach (a solid plane was replaced with a
// minimalistic wireframe grid, per feedback). Same "tangent-to-up, two arbitrary orthogonal
// directions via cross products" technique as before (also used for camera-right in
// PointHandleLayout.ts), just producing grid line segments instead of 4 corners.
import {Vector3} from "@luciad/ria/util/Vector3.js";
import {add, cross, normalize, scale} from "../math/Vector3Util.js";

/**
 * Returns the line segments of a square, horizontal (tangent-to-`up`) reference grid of the given
 * half-size, centered on `center`, with `divisions` evenly-spaced grid lines on each side of the
 * center along both axes (so the outermost division coincides with the square's own edge - the
 * overall footprint matches what a `divisions`-less filled square of the same `halfSize` would
 * cover). `up` must be the local "up" (ellipsoid normal) at that point.
 */
export function horizontalPlaneGridLines(center: Vector3, up: Vector3, halfSize: number, divisions: number): Array<[Vector3, Vector3]> {
  // Picking whichever world axis is least parallel to `up` avoids the degenerate (near-zero
  // cross product) case where the naive choice happens to align with `up` itself.
  const arbitrary: Vector3 = Math.abs(up.x) < 0.9 ? {x: 1, y: 0, z: 0} : {x: 0, y: 1, z: 0};
  const dir1 = normalize(cross(up, arbitrary));
  const dir2 = normalize(cross(up, dir1));

  const lines: Array<[Vector3, Vector3]> = [];
  for (let i = -divisions; i <= divisions; i++) {
    const offset = (i / divisions) * halfSize;
    // A line parallel to dir2, offset along dir1 - spans the full extent along dir2.
    const onDir1 = add(center, scale(dir1, offset));
    lines.push([add(onDir1, scale(dir2, -halfSize)), add(onDir1, scale(dir2, halfSize))]);
    // A line parallel to dir1, offset along dir2 - spans the full extent along dir1.
    const onDir2 = add(center, scale(dir2, offset));
    lines.push([add(onDir2, scale(dir1, -halfSize)), add(onDir2, scale(dir1, halfSize))]);
  }
  return lines;
}
