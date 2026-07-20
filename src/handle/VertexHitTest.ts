// Fresh code - inspired by the technique in
// @luciad/ria-toolbox-controller/handle/ControllerHandleInteractionFactory.js's closeToPointCheck
// (transform a vertex to view space, compare pixel distance), but written as a single batch
// function that finds the closest of N vertices rather than a one-closure-per-point hit test - not
// harvested, since the logic itself is a five-line loop with plain Math.hypot, not worth attribution.
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {ShapeEditStrategy} from "../strategy/ShapeEditStrategy.js";

/**
 * Returns the index of the vertex of `shape` that is closest to `viewPoint` in screen space, if it
 * is within `maxPixelDistance` pixels; otherwise returns -1.
 */
export function findClosestVertexIndex(
    map: WebGLMap,
    viewPoint: Point,
    shape: Point | Polyline | Polygon,
    strategy: ShapeEditStrategy,
    maxPixelDistance: number,
): number {
  const vertexCount = strategy.vertexCount(shape);
  if (vertexCount === 0) {
    return -1;
  }

  const shapeToMapTransformation = createTransformation(shape.reference!, map.reference);

  let closestIndex = -1;
  let closestDistance = maxPixelDistance;

  for (let index = 0; index < vertexCount; index++) {
    const vertexInMapRef = shapeToMapTransformation.transform(strategy.getVertex(shape, index));
    let vertexInView: Point;
    try {
      vertexInView = map.mapToViewTransformation.transform(vertexInMapRef);
    } catch (e) {
      continue;
    }
    const pixelDistance = Math.hypot(vertexInView.x - viewPoint.x, vertexInView.y - viewPoint.y);
    if (pixelDistance <= closestDistance) {
      closestDistance = pixelDistance;
      closestIndex = index;
    }
  }

  return closestIndex;
}
