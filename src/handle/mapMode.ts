// Fresh code - the single definition of "is this map 3D or 2D" for this package. Extracted because
// four separate places now need the answer (PointHandleLayout's handle layout, HandleInteractions'
// vertical-drag guard, Shape3DEditController's own latched _is2D, and CreationSession's z=0 rule),
// and four independent copies of the same reference comparison would be four chances to disagree.
//
// Uses `WebGLMap` (not `RIAMap`) to match every other module here, for compatibility with older
// LuciadRIA versions where the 3D map class had not yet been renamed/unified.
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";

const EPSG_4978 = getReference("EPSG:4978");

/**
 * Whether `map` is a 3D (geocentric, EPSG:4978) map, as opposed to a 2D projected/grid one.
 *
 * This is what "3D" means throughout this package: not "has a perspective camera" and not "has an
 * elevation layer," but specifically a geocentric world reference, since that is the only thing that
 * gives "up" a well-defined direction that varies correctly per location on the globe.
 */
export function isGeocentricMap(map: WebGLMap): boolean {
  return map.reference.equals(EPSG_4978);
}
