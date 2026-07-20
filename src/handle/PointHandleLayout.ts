// Fresh code - computes the world positions of the three simultaneous handles around one vertex
// (free/move/height). Both onDraw (to place the icons) and hit-testing call this same function,
// so placement and hit-testing can never drift apart.
//
// The move and height handles are offset along real world directions - camera-right-ish
// horizontal for move, local "up" (normalize(vertexInMapRef), since in EPSG:4978 "up" varies by
// location on the globe) for height - not raw screen pixels. A screen-pixel offset would look
// wrong for the height handle specifically: it wouldn't track true world-up as the camera tilts.
// The offset magnitude scales with distance from the camera, so both handles stay a roughly
// constant, comfortable size on screen regardless of zoom, rather than a fixed meter value that
// would be invisible zoomed out or huge zoomed in.
//
// Only meaningful on a geocentric (EPSG:4978) map - move/height are both null otherwise, since
// there's no well-defined "up"/"camera-right" to offset along, and height-dragging itself is
// 3D-only anyway (see HandleInteractions.ts's verticalMovePointInteraction guard).
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {add, cross, distance, normalize, scale, toPoint} from "../math/Vector3Util.js";

const EPSG_4978 = getReference("EPSG:4978");

export const DEFAULT_HANDLE_OFFSET_FACTOR = 0.04;

// `finish`/`cancel` are placed as a pair below the vertex (negative "up" direction), symmetric
// left/right around the vertical line through the vertex - cancel down-left, finish down-right -
// rather than sharing `move`'s axis. This deliberately separates "handles that adjust the shape"
// (up = height, right = move) from "handles that end the session" (the pair below), and reads as
// a grouped confirm/cancel action rather than two more move-adjacent handles. This replaces an
// earlier "click empty space to end editing" approach, which turned out to be unreliable in
// practice (a real click almost always has a pixel or two of movement between mouse-down/up,
// which can register as the start of a camera drag before it's ever seen as "nothing hovered").
const BELOW_VERTICAL_OFFSET_MULTIPLIER = 1.6;
const BELOW_HORIZONTAL_OFFSET_MULTIPLIER = 1.1;

export interface PointHandlePositions {
  /** The vertex's own position, in map.reference. */
  free: Point;
  /** Offset along a camera-right-ish horizontal direction, or null on a non-geocentric map. */
  move: Point | null;
  /** Offset along local "up", or null on a non-geocentric map. */
  height: Point | null;
  /** Offset below and to the right of the vertex - click to confirm and end editing. */
  finish: Point | null;
  /** Offset below and to the left of the vertex - click to discard changes and end editing. */
  cancel: Point | null;
}

export function computePointHandlePositions(
    map: WebGLMap,
    vertexPoint: Point,
    offsetFactor: number = DEFAULT_HANDLE_OFFSET_FACTOR,
): PointHandlePositions {
  const vertexInMapRef = createTransformation(vertexPoint.reference!, map.reference).transform(vertexPoint);

  if (!map.reference.equals(EPSG_4978)) {
    return {free: vertexInMapRef, move: null, height: null, finish: null, cancel: null};
  }

  const up = normalize(vertexInMapRef);
  const cameraRight = normalize(cross(map.camera.forward, map.camera.up));
  const offset = distance(map.camera.eye, vertexInMapRef) * offsetFactor;

  const move = toPoint(map.reference, add(vertexInMapRef, scale(cameraRight, offset)));
  const height = toPoint(map.reference, add(vertexInMapRef, scale(up, offset)));

  const belowCenter = add(vertexInMapRef, scale(up, -offset * BELOW_VERTICAL_OFFSET_MULTIPLIER));
  const horizontalStep = scale(cameraRight, offset * BELOW_HORIZONTAL_OFFSET_MULTIPLIER);
  const cancel = toPoint(map.reference, add(belowCenter, scale(horizontalStep, -1)));
  const finish = toPoint(map.reference, add(belowCenter, horizontalStep));

  return {free: vertexInMapRef, move, height, finish, cancel};
}
