import {describe, expect, it} from "vitest";
import {PerspectiveCamera} from "@luciad/ria/view/camera/PerspectiveCamera.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {calculatePointingDirection, PerspectiveMapLike} from "./PerspectiveCameraUtil.js";
import {cross, distance, dot, normalize} from "./Vector3Util.js";

function createTestMap(width: number, height: number): PerspectiveMapLike {
  const camera = new PerspectiveCamera(
      {x: 0, y: 0, z: 0},
      {x: 0, y: 0, z: -1},
      {x: 0, y: 1, z: 0},
      1,
      1000,
      width,
      height,
      60,
      getReference("EPSG:4978"),
  );
  return {camera, viewSize: [width, height]};
}

describe("calculatePointingDirection", () => {
  it("points straight along the camera's forward vector at the center of the view", () => {
    const map = createTestMap(800, 600);
    const direction = normalize(calculatePointingDirection(map, {x: 400, y: 300}));
    const forward = normalize(map.camera.forward);
    expect(distance(direction, forward)).toBeCloseTo(0, 5);
  });

  it("deviates towards the right of the view for a viewpoint right of center", () => {
    const map = createTestMap(800, 600);
    const centerDirection = calculatePointingDirection(map, {x: 400, y: 300});
    const rightDirection = calculatePointingDirection(map, {x: 700, y: 300});
    const cameraRight = normalize(cross(map.camera.forward, map.camera.up));
    // The rightward viewpoint's direction should have a larger component along cameraRight.
    expect(dot(rightDirection, cameraRight)).toBeGreaterThan(dot(centerDirection, cameraRight));
  });
});
