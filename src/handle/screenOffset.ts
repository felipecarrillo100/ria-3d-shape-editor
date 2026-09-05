// Fresh code - extracted from what used to be Shape3DEditController.offsetPointUpOnScreen (a
// touch-drag-only, upward-only helper) once PointHandleLayout's 2D branch needed the same
// view-space round trip in all four directions. One implementation, so the touch-drag lift and the
// 2D handle layout can't drift apart in how they interpret a pixel offset.
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";

/**
 * Offsets `point` by a pixel delta on screen: transforms it to view coordinates, shifts it there,
 * and transforms the result back into `map.reference`.
 *
 * `dyPixels` follows the screen's own convention - POSITIVE IS DOWN - so a handle meant to sit
 * above the vertex passes a negative value.
 *
 * Returns `null` if either transformation throws, which is the normal outcome for a point that
 * isn't currently on screen (e.g. a vertex panned out of view, or one behind the globe). Callers
 * treat `null` as "this handle has no position right now" rather than as an error - the same way
 * every other position in PointHandlePositions is already nullable.
 */
export function offsetPointOnScreen(map: WebGLMap, point: Point, dxPixels: number, dyPixels: number): Point | null {
  try {
    const view = map.mapToViewTransformation.transform(point);
    const offsetView = createPoint(null, [view.x + dxPixels, view.y + dyPixels]);
    return map.viewToMapTransformation.transform(offsetView);
  } catch (e) {
    return null;
  }
}
