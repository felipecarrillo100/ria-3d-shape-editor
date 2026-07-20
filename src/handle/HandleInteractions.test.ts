import {describe, expect, it} from "vitest";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {verticalMovePointInteraction} from "./HandleInteractions.js";

describe("verticalMovePointInteraction", () => {
  it("is a no-op on a non-geocentric (2D) map", () => {
    const fake2DMap = {reference: getReference("EPSG:4326")} as unknown as WebGLMap;
    const modelPoint = createPoint(getReference("EPSG:4326"), [10, 20, 5]);
    const viewPoint = createPoint(null, [100, 100]);

    const interaction = verticalMovePointInteraction(fake2DMap, viewPoint, modelPoint);
    const result = interaction(createPoint(null, [999, 999]));

    expect(result).toBe(modelPoint);
  });
});
