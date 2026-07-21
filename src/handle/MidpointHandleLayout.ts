// Fresh code - the position of a segment's virtual midpoint marker, computed the same
// transform-then-combine way as computePointHandlePositions (PointHandleLayout.ts): transform both
// endpoints into map.reference, then average. Both hit-testing and drawing (and promotion to a
// real vertex, on drag) call this same function, so none of the three can ever drift apart.
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {add, scale, toPoint} from "../math/Vector3Util.js";

export function computeSegmentMidpointPosition(map: WebGLMap, vertexA: Point, vertexB: Point): Point {
  const aInMapRef = createTransformation(vertexA.reference!, map.reference).transform(vertexA);
  const bInMapRef = createTransformation(vertexB.reference!, map.reference).transform(vertexB);
  return toPoint(map.reference, scale(add(aInMapRef, bInMapRef), 0.5));
}
