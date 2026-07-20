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
// Adapted from @luciad/ria-toolbox-controller/handle/ControllerHandleInteractionFactory.js, trimmed
// to the two interactions this package needs (no rotate/directional/linear/planar variants, no
// hit-test helpers - we do our own vertex hit-testing in VertexHitTest.ts).
//
// Two deliberate deviations from the original:
// 1. `horizontalMovePointInteraction` drops the `options` parameter entirely and always behaves as
//    `fixedHeight: true` - height is the height-handle's exclusive concern in this package, so the
//    terrain-following branch and the restriction-function hook are dead weight here.
// 2. `verticalMovePointInteraction` no longer throws when `rayPlaneIntersection` returns `null`
//    mid-drag (which the original does) - throwing out of a live gesture handler would abort the
//    whole drag and leave the controller's internal state inconsistent. Instead it returns the
//    previous frame's result unchanged.
//
// Uses `WebGLMap` (not `RIAMap`) for the map parameter type, for compatibility with older
// LuciadRIA versions (e.g. 2025.0.x) where the 3D map class had not yet been renamed/unified.
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {LocationMode} from "@luciad/ria/transformation/LocationMode.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {add, cross, distanceAlongDirection, rayPlaneIntersection, sub, toPoint} from "../math/Vector3Util.js";
import {calculatePointingDirection} from "../math/PerspectiveCameraUtil.js";
import {raycastClosestSurface} from "./raycastClosestSurface.js";

const WGS_84 = getReference("CRS:84");
const EPSG_4978 = getReference("EPSG:4978");

/**
 * Creates a "free" move point interaction function: on every frame, raycasts the current view
 * point onto whatever surface is nearest (terrain or mesh) and returns that point directly -
 * X/Y/Z all follow the new surface, exactly like the initial creation click. Fresh code, not
 * adapted from the toolbox; this is simpler than the fixed-height/fixed-horizontal interactions
 * below since it has no constraint to maintain across frames. If the ray doesn't touch anything
 * (e.g. dragged off the edge of the data), the previous frame's result is kept unchanged.
 * Returns WGS84 points, matching the other two interactions below, so callers can apply/draw all
 * three handle kinds through the same code path.
 */
export const freeMovePointInteraction = (map: WebGLMap, viewPoint: Point,
                                          modelPoint: Point): (point: Point) => Point => {
  const mapToWgs84Transformation = createTransformation(map.reference, WGS_84);
  let lastResult = createTransformation(modelPoint.reference!, WGS_84).transform(modelPoint);
  return (updatedViewPoint: Point): Point => {
    const touched = raycastClosestSurface(map, updatedViewPoint);
    if (touched) {
      lastResult = mapToWgs84Transformation.transform(touched);
    }
    return lastResult;
  };
};

/**
 * Creates a horizontal move point interaction function that is valid for the duration of a single
 * interaction (usually one drag operation). Always operates at the vertex's original (fixed) height.
 */
export const horizontalMovePointInteraction = (map: WebGLMap, viewPoint: Point,
                                                modelPoint: Point): (point: Point) => Point => {
  const modelPointToWgs84 = createTransformation(modelPoint.reference!, WGS_84);
  const modelPointWGS84 = modelPointToWgs84.transform(modelPoint);
  const modelPointHeight = modelPointWGS84.z;
  const mapToWgs84Transformation = createTransformation(map.reference, WGS_84);

  const viewToMapTransformation = map.getViewToMapTransformation(LocationMode.ELLIPSOID,
      {heightOffset: modelPointWGS84.z});

  const modelPointInMapRef = createTransformation(modelPoint.reference!, map.reference).transform(modelPoint);
  const startPoint = viewToMapTransformation.transform(viewPoint);
  const offset = sub(modelPointInMapRef, startPoint);

  return (updatedViewPoint: Point): Point => {
    const newWgs84Point = mapToWgs84Transformation.transform(
        toPoint(map.reference, add(offset, viewToMapTransformation.transform(updatedViewPoint))));
    newWgs84Point.z = modelPointHeight;
    return newWgs84Point;
  }
};

/**
 * Creates a vertical move point interaction function that is valid for the duration of a single
 * interaction (usually one drag operation). Guarantees the X/Y of the returned point never change,
 * only Z. Disabled (returns a no-op) on non-geocentric (non-3D) maps.
 */
export const verticalMovePointInteraction = (map: WebGLMap, viewPoint: Point,
                                              modelPoint: Point): (point: Point) => Point => {
  if (!map.reference.equals(EPSG_4978)) {
    //Disable vertical movement on 2D maps
    return (): Point => modelPoint;
  }
  const modelPointToWgs84 = createTransformation(modelPoint.reference!, WGS_84);
  const modelPointToEpsg4978 = createTransformation(modelPoint.reference!, EPSG_4978);
  const wgs84ToEpsg4978 = createTransformation(WGS_84, EPSG_4978);
  const modelPointWGS84 = modelPointToWgs84.transform(modelPoint);
  const abovePointWGS84 = modelPointWGS84.copy();
  abovePointWGS84.z += 1;

  const modelPointEPSG4978 = modelPointToEpsg4978.transform(modelPoint);
  const abovePointEPSG4978 = wgs84ToEpsg4978.transform(abovePointWGS84);
  const upDirection = sub(abovePointEPSG4978, modelPointEPSG4978);
  const rightDirection = cross(sub(modelPointEPSG4978, map.camera.eye), upDirection);
  const planeNormal = cross(rightDirection, upDirection);

  const touchedPointAtStart = rayPlaneIntersection(map.camera.eye, calculatePointingDirection(map, viewPoint),
      planeNormal, modelPointEPSG4978)!;

  let lastResult = modelPointWGS84.copy();

  return (updatedViewPoint: Point): Point => {
    const touchedPoint = rayPlaneIntersection(map.camera.eye, calculatePointingDirection(map, updatedViewPoint),
        planeNormal, modelPointEPSG4978);
    if (touchedPoint) {
      const heightDiff = distanceAlongDirection(touchedPoint, touchedPointAtStart, upDirection);
      const updatedModelPoint = modelPointWGS84.copy();
      updatedModelPoint.z += heightDiff;
      lastResult = updatedModelPoint;
    }
    // If the ray no longer touches the plane (e.g. the camera moved mid-drag), keep the previous
    // frame's result rather than throwing out of a live gesture handler.
    return lastResult;
  }
};
