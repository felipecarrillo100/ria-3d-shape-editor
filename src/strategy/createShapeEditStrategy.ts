import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {ProgrammingError} from "@luciad/ria/error/ProgrammingError.js";
import {ShapeEditStrategy} from "./ShapeEditStrategy.js";
import {PointEditStrategy} from "./PointEditStrategy.js";
import {LineStringEditStrategy} from "./LineStringEditStrategy.js";
import {PolygonEditStrategy} from "./PolygonEditStrategy.js";

export type SupportedShapeType = ShapeType.POINT | ShapeType.POLYLINE | ShapeType.POLYGON;

export function createShapeEditStrategy(shapeType: SupportedShapeType): ShapeEditStrategy {
  switch (shapeType) {
    case ShapeType.POINT:
      return new PointEditStrategy();
    case ShapeType.POLYLINE:
      return new LineStringEditStrategy();
    case ShapeType.POLYGON:
      return new PolygonEditStrategy();
    default:
      throw new ProgrammingError(`Unsupported shape type for Shape3DEditController: ${shapeType}`);
  }
}
