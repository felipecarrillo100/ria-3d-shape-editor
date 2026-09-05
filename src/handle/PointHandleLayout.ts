// Fresh code - computes the world positions of the handles around one vertex. Both onDraw (to place
// the icons) and hit-testing call this same function, so placement and hit-testing can never drift
// apart.
//
// There are two layouts, picked by the map's own mode (see isGeocentricMap):
//
// 3D (geocentric, EPSG:4978) - the full set, offset along real WORLD directions: camera-right-ish
// horizontal for move, local "up" (normalize(vertexInMapRef), since in EPSG:4978 "up" varies by
// location on the globe) for height. Deliberately not screen pixels: a pixel offset would look
// wrong for the height handle specifically, since it wouldn't track true world-up as the camera
// tilts. The offset magnitude scales with distance from the camera, so the handles stay a roughly
// constant, comfortable size on screen regardless of zoom, rather than a fixed meter value that
// would be invisible zoomed out or huge zoomed in.
//
// 2D (any projected/grid reference) - the same slots, but offset in SCREEN PIXELS via
// offsetPointOnScreen. The world-direction argument above simply doesn't apply here: there is no
// tilt to track, no well-defined per-location "up" in a projected reference (normalize() of a
// Mercator coordinate is meaningless), and no height handle to get wrong. A fixed pixel offset also
// removes the need for a zoom-dependent scale factor entirely. `height` is the one slot that is
// always null in 2D - height dragging needs a geocentric map to make sense of "up" at all (see
// HandleInteractions.ts's verticalMovePointInteraction guard), so the slot directly above the
// vertex stays permanently empty there.
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {add, cross, distance, normalize, scale, toPoint} from "../math/Vector3Util.js";
import {isGeocentricMap} from "./mapMode.js";
import {offsetPointOnScreen} from "./screenOffset.js";

export const DEFAULT_HANDLE_OFFSET_FACTOR = 0.04;

// The 2D equivalent of DEFAULT_HANDLE_OFFSET_FACTOR. Chosen to land in the same visual ballpark the
// 3D factor produces at a typical editing distance - far enough out that the satellite icons don't
// overlap the vertex marker (16-18px) or each other, close enough to still read as belonging to it.
export const DEFAULT_HANDLE_OFFSET_PIXELS = 34;

// `finish`/`cancel` are placed as a pair below the vertex (negative "up" direction), symmetric
// left/right around the vertical line through the vertex - cancel down-left, finish down-right -
// rather than sharing `move`'s axis. This deliberately separates "handles that adjust the shape"
// (up = height, right = move) from "handles that end the session" (the pair below), and reads as
// a grouped confirm/cancel action rather than two more move-adjacent handles. This replaces an
// earlier "click empty space to end editing" approach, which turned out to be unreliable in
// practice (a real click almost always has a pixel or two of movement between mouse-down/up,
// which can register as the start of a camera drag before it's ever seen as "nothing hovered").
//
// Both layouts share these two multipliers, so the confirm/cancel pair sits in the same relative
// place in 2D as in 3D.
const BELOW_VERTICAL_OFFSET_MULTIPLIER = 1.6;
const BELOW_HORIZONTAL_OFFSET_MULTIPLIER = 1.1;

export interface PointHandlePositions {
  /** The vertex's own position, in map.reference. */
  free: Point;
  /** Offset to the right of the vertex - camera-right in 3D, screen-right in 2D. */
  move: Point | null;
  /**
   * Offset along local "up". Always null in 2D: a projected reference has no meaningful per-location
   * "up" to offset along, and height dragging is geocentric-only anyway.
   */
  height: Point | null;
  /** Offset below and to the right of the vertex - click to confirm and end editing. */
  finish: Point | null;
  /** Offset below and to the left of the vertex - click to discard changes and end editing. */
  cancel: Point | null;
  /**
   * The exact mirror of `move` (same offset magnitude, same zero vertical component, opposite
   * side) - click to toggle whole-shape move/height mode.
   */
  shiftToggle: Point | null;
  /**
   * Top-left of the vertex - same horizontal offset magnitude as `move` (mirrored to the left,
   * like `shiftToggle`), same vertical offset magnitude as `height`. The diagonal corner opposite
   * `finish`. Click to remove this vertex.
   */
  remove: Point | null;
  /**
   * Top-right of the vertex - the mirror of `remove` (same offset magnitudes, opposite
   * horizontal side). Drag to rotate the whole shape around this vertex, which stays fixed as the
   * pivot - only meaningful (and only ever offered) while whole-shape mode is armed, since rotating
   * a single vertex around itself is a no-op.
   */
  rotate: Point | null;
}

export function computePointHandlePositions(
    map: WebGLMap,
    vertexPoint: Point,
    offsetFactor: number = DEFAULT_HANDLE_OFFSET_FACTOR,
): PointHandlePositions {
  const vertexInMapRef = createTransformation(vertexPoint.reference!, map.reference).transform(vertexPoint);

  if (!isGeocentricMap(map)) {
    return computeScreenSpacePositions(map, vertexInMapRef);
  }

  const up = normalize(vertexInMapRef);
  const cameraRight = normalize(cross(map.camera.forward, map.camera.up));
  const offset = distance(map.camera.eye, vertexInMapRef) * offsetFactor;

  const move = toPoint(map.reference, add(vertexInMapRef, scale(cameraRight, offset)));
  const height = toPoint(map.reference, add(vertexInMapRef, scale(up, offset)));
  const shiftToggle = toPoint(map.reference, add(vertexInMapRef, scale(cameraRight, -offset)));
  const remove = toPoint(map.reference, add(add(vertexInMapRef, scale(up, offset)), scale(cameraRight, -offset)));
  const rotate = toPoint(map.reference, add(add(vertexInMapRef, scale(up, offset)), scale(cameraRight, offset)));

  const belowCenter = add(vertexInMapRef, scale(up, -offset * BELOW_VERTICAL_OFFSET_MULTIPLIER));
  const horizontalStep = scale(cameraRight, offset * BELOW_HORIZONTAL_OFFSET_MULTIPLIER);
  const cancel = toPoint(map.reference, add(belowCenter, scale(horizontalStep, -1)));
  const finish = toPoint(map.reference, add(belowCenter, horizontalStep));

  return {free: vertexInMapRef, move, height, finish, cancel, shiftToggle, remove, rotate};
}

/**
 * The 2D layout: the same slots as the geocentric branch above, positioned by pixel offsets on
 * screen instead of world directions. Screen y grows DOWNWARD, so the "above the vertex" slots pass
 * a negative dy and the confirm/cancel pair below passes a positive one.
 *
 * `height` is deliberately null rather than "directly above": nothing in 2D can drag it (see the
 * file header), and returning a position for a handle that is never drawn or hit-tested would
 * silently reintroduce an invisible-but-live hit zone - exactly what effectiveHandlePositions'
 * null-means-withdrawn contract exists to prevent.
 */
function computeScreenSpacePositions(map: WebGLMap, vertexInMapRef: Point): PointHandlePositions {
  const px = DEFAULT_HANDLE_OFFSET_PIXELS;
  const belowY = px * BELOW_VERTICAL_OFFSET_MULTIPLIER;
  const belowX = px * BELOW_HORIZONTAL_OFFSET_MULTIPLIER;
  const at = (dx: number, dy: number): Point | null => offsetPointOnScreen(map, vertexInMapRef, dx, dy);

  return {
    free: vertexInMapRef,
    move: at(px, 0),
    height: null,
    shiftToggle: at(-px, 0),
    remove: at(-px, -px),
    rotate: at(px, -px),
    cancel: at(-belowX, belowY),
    finish: at(belowX, belowY),
  };
}
