// Fresh code - the single raycast used both by creation (CreationSession) and the "free" drag
// handle (HandleInteractions.freeMovePointInteraction), factored out so both stay in sync.
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";
import {OutOfBoundsError} from "@luciad/ria/error/OutOfBoundsError.js";

/**
 * Raycasts `viewPoint` onto whatever surface is nearest (terrain or 3D Tiles/mesh) and returns the
 * resulting point in `map.reference`, or `null` if the view point doesn't touch anything.
 */
export function raycastClosestSurface(map: WebGLMap, viewPoint: Point): Point | null {
  try {
    return map.getViewToMapTransformation(LocationMode.CLOSEST_SURFACE).transform(viewPoint);
  } catch (e) {
    if (e instanceof OutOfBoundsError) {
      return null;
    }
    throw e;
  }
}
